const { GreengrassV2Client, GetDeploymentCommand } = require('@aws-sdk/client-greengrassv2');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const greengrass = new GreengrassV2Client({});
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const GREENGRASS_DEPLOYMENTS_TABLE = process.env.GREENGRASS_DEPLOYMENTS_TABLE;

/**
 * Gets Greengrass deployment status and details
 * GET /greengrass/deployments/{deploymentId}
 */
exports.handler = async (event) => {
  console.log('Get Greengrass Deployment:', JSON.stringify(event, null, 2));

  try {
    const deploymentId = event.pathParameters?.deploymentId;

    if (!deploymentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'deploymentId is required' }),
      };
    }

    // Get deployment from AWS IoT Greengrass
    let greengrassDeployment;
    try {
      const result = await greengrass.send(
        new GetDeploymentCommand({ deploymentId })
      );
      greengrassDeployment = result;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Deployment not found' }),
        };
      }
      throw error;
    }

    // Get deployment record from DynamoDB
    const dbResult = await dynamoDb.send(
      new QueryCommand({
        TableName: GREENGRASS_DEPLOYMENTS_TABLE,
        KeyConditionExpression: 'deploymentId = :deploymentId',
        ExpressionAttributeValues: {
          ':deploymentId': deploymentId,
        },
      })
    );

    let dbRecord = null;
    if (dbResult.Items && dbResult.Items.length > 0) {
      dbRecord = dbResult.Items[0];

      // Update status in DynamoDB if it changed
      if (dbRecord.status !== greengrassDeployment.deploymentStatus) {
        await dynamoDb.send(
          new UpdateCommand({
            TableName: GREENGRASS_DEPLOYMENTS_TABLE,
            Key: {
              deploymentId: dbRecord.deploymentId,
              createdAt: dbRecord.createdAt,
            },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': greengrassDeployment.deploymentStatus,
              ':updatedAt': new Date().toISOString(),
            },
          })
        );
      }
    }

    // Combine data from Greengrass and DynamoDB
    const deployment = {
      deploymentId: greengrassDeployment.deploymentId,
      targetArn: greengrassDeployment.targetArn,
      deploymentName: greengrassDeployment.deploymentName,
      status: greengrassDeployment.deploymentStatus,
      iotJobId: greengrassDeployment.iotJobId,
      iotJobArn: greengrassDeployment.iotJobArn,
      components: greengrassDeployment.components,
      deploymentPolicies: greengrassDeployment.deploymentPolicies,
      createdAt: greengrassDeployment.creationTimestamp,
      isLatestForTarget: greengrassDeployment.isLatestForTarget,
      tags: greengrassDeployment.tags,
      // Include data from DynamoDB if available
      ...(dbRecord && {
        createdBy: dbRecord.createdBy,
        localCreatedAt: dbRecord.createdAt,
      }),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deployment,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error getting Greengrass deployment:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to get deployment',
        message: error.message,
      }),
    };
  }
};
