const { GreengrassV2Client, CancelDeploymentCommand, GetDeploymentCommand } = require('@aws-sdk/client-greengrassv2');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const greengrass = new GreengrassV2Client({});
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const GREENGRASS_DEPLOYMENTS_TABLE = process.env.GREENGRASS_DEPLOYMENTS_TABLE;

/**
 * Cancels a Greengrass deployment
 * DELETE /greengrass/deployments/{deploymentId}
 */
exports.handler = async (event) => {
  console.log('Cancel Greengrass Deployment:', JSON.stringify(event, null, 2));

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

    // Check if deployment exists and get current status
    let currentDeployment;
    try {
      currentDeployment = await greengrass.send(
        new GetDeploymentCommand({ deploymentId })
      );
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

    // Check if deployment can be canceled
    const status = currentDeployment.deploymentStatus;
    if (status === 'COMPLETED' || status === 'CANCELED' || status === 'FAILED') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Cannot cancel deployment with status: ${status}`,
          currentStatus: status,
        }),
      };
    }

    // Cancel deployment in AWS IoT Greengrass
    await greengrass.send(
      new CancelDeploymentCommand({ deploymentId })
    );

    // Update status in DynamoDB
    const dbResult = await dynamoDb.send(
      new QueryCommand({
        TableName: GREENGRASS_DEPLOYMENTS_TABLE,
        KeyConditionExpression: 'deploymentId = :deploymentId',
        ExpressionAttributeValues: {
          ':deploymentId': deploymentId,
        },
      })
    );

    if (dbResult.Items && dbResult.Items.length > 0) {
      const dbRecord = dbResult.Items[0];

      await dynamoDb.send(
        new UpdateCommand({
          TableName: GREENGRASS_DEPLOYMENTS_TABLE,
          Key: {
            deploymentId: dbRecord.deploymentId,
            createdAt: dbRecord.createdAt,
          },
          UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, canceledAt = :canceledAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'CANCELED',
            ':updatedAt': new Date().toISOString(),
            ':canceledAt': new Date().toISOString(),
          },
        })
      );
    }

    console.log(`Greengrass deployment canceled: ${deploymentId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Deployment canceled successfully',
        deploymentId,
        previousStatus: status,
        newStatus: 'CANCELED',
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error canceling Greengrass deployment:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to cancel deployment',
        message: error.message,
      }),
    };
  }
};
