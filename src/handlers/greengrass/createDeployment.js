const { GreengrassV2Client, CreateDeploymentCommand } = require('@aws-sdk/client-greengrassv2');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const greengrass = new GreengrassV2Client({});
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const GREENGRASS_DEPLOYMENTS_TABLE = process.env.GREENGRASS_DEPLOYMENTS_TABLE;

/**
 * Creates a new Greengrass deployment
 * POST /greengrass/deployments
 *
 * Request body:
 * {
 *   "targetArn": "arn:aws:iot:region:account:thing/deviceName or thinggroup/groupName",
 *   "deploymentName": "My Deployment",
 *   "components": {
 *     "componentName": {
 *       "componentVersion": "1.0.0",
 *       "configurationUpdate": {
 *         "merge": "{\"key\":\"value\"}"
 *       }
 *     }
 *   },
 *   "deploymentPolicies": {
 *     "failureHandlingPolicy": "ROLLBACK",
 *     "componentUpdatePolicy": {
 *       "timeoutInSeconds": 60,
 *       "action": "NOTIFY_COMPONENTS"
 *     }
 *   }
 * }
 */
exports.handler = async (event) => {
  console.log('Create Greengrass Deployment:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.targetArn) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'targetArn is required' }),
      };
    }

    if (!body.components || Object.keys(body.components).length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'At least one component is required' }),
      };
    }

    // Create deployment in AWS IoT Greengrass
    const deploymentParams = {
      targetArn: body.targetArn,
      deploymentName: body.deploymentName || `Deployment-${Date.now()}`,
      components: body.components,
      deploymentPolicies: body.deploymentPolicies || {
        failureHandlingPolicy: 'DO_NOTHING',
        componentUpdatePolicy: {
          timeoutInSeconds: 60,
          action: 'NOTIFY_COMPONENTS',
        },
      },
      iotJobConfiguration: body.iotJobConfiguration || {
        jobExecutionsRolloutConfig: {
          maximumPerMinute: 100,
        },
      },
      tags: {
        Service: 'iot-shadow-management',
        CreatedBy: 'API',
        ...body.tags,
      },
    };

    const createResult = await greengrass.send(new CreateDeploymentCommand(deploymentParams));

    const deploymentId = createResult.deploymentId;
    const timestamp = Date.now();

    // Store deployment record in DynamoDB
    const deploymentRecord = {
      deploymentId,
      createdAt: timestamp,
      targetArn: body.targetArn,
      deploymentName: deploymentParams.deploymentName,
      components: body.components,
      status: 'ACTIVE',
      iotJobId: createResult.iotJobId,
      iotJobArn: createResult.iotJobArn,
      deploymentPolicies: deploymentParams.deploymentPolicies,
      createdBy: body.createdBy || 'API',
      updatedAt: new Date().toISOString(),
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: GREENGRASS_DEPLOYMENTS_TABLE,
        Item: deploymentRecord,
      })
    );

    console.log(`Greengrass deployment created: ${deploymentId}`);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Deployment created successfully',
        deployment: {
          deploymentId,
          ...deploymentRecord,
        },
      }),
    };
  } catch (error) {
    console.error('Error creating Greengrass deployment:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to create deployment',
        message: error.message,
      }),
    };
  }
};
