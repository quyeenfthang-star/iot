/**
 * Greengrass Deployment Status Handler
 *
 * Retrieves deployment status and details:
 * - Deployment configuration
 * - Current status (ACTIVE, COMPLETED, FAILED, CANCELED)
 * - Component deployment status
 * - Execution statistics
 * - Error details if applicable
 *
 * API: GET /greengrass/deployments/{deploymentId}
 */

const { GreengrassV2Client, GetDeploymentCommand } = require('@aws-sdk/client-greengrassv2');
const { IoTClient, DescribeJobCommand } = require('@aws-sdk/client-iot');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const greengrassClient = new GreengrassV2Client({});
const iotClient = new IoTClient({});
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE;

/**
 * Get deployment from DynamoDB
 */
async function getDeploymentRecord(deploymentId) {
  const result = await docClient.send(new GetCommand({
    TableName: DEPLOYMENTS_TABLE,
    Key: { deploymentId },
  }));

  return result.Item;
}

/**
 * Get deployment status from Greengrass
 */
async function getGreengrassDeploymentStatus(deploymentId) {
  try {
    const command = new GetDeploymentCommand({ deploymentId });
    const result = await greengrassClient.send(command);
    return result;
  } catch (error) {
    console.error('Error getting Greengrass deployment:', error);
    return null;
  }
}

/**
 * Get IoT Job status for additional details
 */
async function getIoTJobStatus(jobId) {
  try {
    const command = new DescribeJobCommand({ jobId });
    const result = await iotClient.send(command);
    return result.job;
  } catch (error) {
    console.error('Error getting IoT Job:', error);
    return null;
  }
}

/**
 * Update deployment record with latest status
 */
async function updateDeploymentStatus(deploymentId, status) {
  await docClient.send(new UpdateCommand({
    TableName: DEPLOYMENTS_TABLE,
    Key: { deploymentId },
    UpdateExpression: 'SET #status = :status, lastUpdated = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':timestamp': Date.now(),
    },
  }));
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Get Deployment Request:', JSON.stringify(event, null, 2));

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

    // Get deployment record from DynamoDB
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

    // Get current status from Greengrass
    const greengrassStatus = await getGreengrassDeploymentStatus(deploymentId);

    // Get IoT Job status for execution details
    const jobStatus = record.iotJobId
      ? await getIoTJobStatus(record.iotJobId)
      : null;

    // Update status in DynamoDB if changed
    if (greengrassStatus && greengrassStatus.deploymentStatus !== record.status) {
      await updateDeploymentStatus(deploymentId, greengrassStatus.deploymentStatus);
    }

    // Compile comprehensive deployment status
    const deploymentStatus = {
      deploymentId,
      record,
      currentStatus: greengrassStatus ? {
        status: greengrassStatus.deploymentStatus,
        components: greengrassStatus.components,
        deploymentPolicies: greengrassStatus.deploymentPolicies,
        iotJobConfiguration: greengrassStatus.iotJobConfiguration,
        creationTimestamp: greengrassStatus.creationTimestamp,
        revisionId: greengrassStatus.revisionId,
        tags: greengrassStatus.tags,
      } : null,
      jobExecution: jobStatus ? {
        jobId: jobStatus.jobId,
        status: jobStatus.status,
        targetSelection: jobStatus.targetSelection,
        jobExecutionsRolloutConfig: jobStatus.jobExecutionsRolloutConfig,
        jobProcessDetails: jobStatus.jobProcessDetails,
        timeoutConfig: jobStatus.timeoutConfig,
        createdAt: jobStatus.createdAt,
        lastUpdatedAt: jobStatus.lastUpdatedAt,
        completedAt: jobStatus.completedAt,
      } : null,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(deploymentStatus),
    };
  } catch (error) {
    console.error('Error getting deployment:', error);

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
