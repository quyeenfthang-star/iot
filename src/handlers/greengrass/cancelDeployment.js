/**
 * Cancel Greengrass Deployment Handler
 *
 * Cancels an active deployment:
 * - Stops deployment rollout
 * - Updates deployment status
 * - Cancels associated IoT Job
 *
 * API: POST /greengrass/deployments/{deploymentId}/cancel
 */

const { GreengrassV2Client, CancelDeploymentCommand } = require('@aws-sdk/client-greengrassv2');
const { IoTClient, CancelJobCommand } = require('@aws-sdk/client-iot');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const greengrassClient = new GreengrassV2Client({});
const iotClient = new IoTClient({});
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE;

/**
 * Get deployment record
 */
async function getDeploymentRecord(deploymentId) {
  const result = await docClient.send(new GetCommand({
    TableName: DEPLOYMENTS_TABLE,
    Key: { deploymentId },
  }));

  return result.Item;
}

/**
 * Cancel Greengrass deployment
 */
async function cancelGreengrassDeployment(deploymentId) {
  const command = new CancelDeploymentCommand({ deploymentId });
  const result = await greengrassClient.send(command);
  return result;
}

/**
 * Cancel associated IoT Job
 */
async function cancelIoTJob(jobId) {
  try {
    const command = new CancelJobCommand({
      jobId,
      reasonCode: 'DEPLOYMENT_CANCELED',
      comment: 'Deployment canceled by user request',
    });

    await iotClient.send(command);
    return true;
  } catch (error) {
    console.error('Error canceling IoT Job:', error);
    return false;
  }
}

/**
 * Update deployment status in DynamoDB
 */
async function updateDeploymentStatus(deploymentId, canceledBy) {
  await docClient.send(new UpdateCommand({
    TableName: DEPLOYMENTS_TABLE,
    Key: { deploymentId },
    UpdateExpression: 'SET #status = :status, canceledAt = :timestamp, canceledBy = :canceledBy',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'CANCELED',
      ':timestamp': Date.now(),
      ':canceledBy': canceledBy || 'system',
    },
  }));
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Cancel Deployment Request:', JSON.stringify(event, null, 2));

  try {
    const pathParams = event.pathParameters || {};
    const deploymentId = pathParams.deploymentId;

    if (!deploymentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'deploymentId is required',
        }),
      };
    }

    // Get deployment record
    const record = await getDeploymentRecord(deploymentId);

    if (!record) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Deployment not found',
        }),
      };
    }

    // Check if deployment can be canceled
    const cancellableStatuses = ['ACTIVE'];
    if (!cancellableStatuses.includes(record.status)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Deployment cannot be canceled. Current status: ${record.status}`,
        }),
      };
    }

    // Parse request body for canceledBy info
    const body = event.body ? JSON.parse(event.body) : {};
    const canceledBy = body.canceledBy || 'system';

    // Cancel Greengrass deployment
    await cancelGreengrassDeployment(deploymentId);

    // Cancel associated IoT Job
    if (record.iotJobId) {
      await cancelIoTJob(record.iotJobId);
    }

    // Update status in DynamoDB
    await updateDeploymentStatus(deploymentId, canceledBy);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Deployment canceled successfully',
        deploymentId,
        previousStatus: record.status,
        newStatus: 'CANCELED',
        canceledAt: new Date().toISOString(),
        canceledBy,
      }),
    };
  } catch (error) {
    console.error('Error canceling deployment:', error);

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
