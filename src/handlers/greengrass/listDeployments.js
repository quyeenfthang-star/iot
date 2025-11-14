/**
 * List Greengrass Deployments Handler
 *
 * Lists all deployments with filtering and pagination:
 * - Filter by target ARN
 * - Filter by status
 * - Filter by time range
 * - Pagination support
 *
 * API: GET /greengrass/deployments
 */

const { GreengrassV2Client, ListDeploymentsCommand } = require('@aws-sdk/client-greengrassv2');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const greengrassClient = new GreengrassV2Client({});
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE;

/**
 * List deployments from DynamoDB
 */
async function listDeploymentsFromDynamoDB(filters = {}) {
  const { status, targetArn, startTime, endTime, limit, lastEvaluatedKey } = filters;

  let params = {
    TableName: DEPLOYMENTS_TABLE,
    Limit: limit || 50,
  };

  // Build filter expression
  const filterExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  if (status) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;
  }

  if (targetArn) {
    filterExpressions.push('targetArn = :targetArn');
    expressionAttributeValues[':targetArn'] = targetArn;
  }

  if (startTime) {
    filterExpressions.push('createdAt >= :startTime');
    expressionAttributeValues[':startTime'] = parseInt(startTime);
  }

  if (endTime) {
    filterExpressions.push('createdAt <= :endTime');
    expressionAttributeValues[':endTime'] = parseInt(endTime);
  }

  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
  }

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  if (Object.keys(expressionAttributeValues).length > 0) {
    params.ExpressionAttributeValues = expressionAttributeValues;
  }

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = JSON.parse(
      Buffer.from(lastEvaluatedKey, 'base64').toString()
    );
  }

  const result = await docClient.send(new ScanCommand(params));

  return {
    deployments: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null,
    count: result.Count,
  };
}

/**
 * Enrich deployment data with live status
 */
async function enrichWithLiveStatus(deployments) {
  const enrichedDeployments = [];

  for (const deployment of deployments) {
    try {
      // Get live status from Greengrass (optional enhancement)
      // For performance, this is commented out but can be enabled
      /*
      const command = new GetDeploymentCommand({ deploymentId: deployment.deploymentId });
      const liveStatus = await greengrassClient.send(command);
      deployment.liveStatus = liveStatus.deploymentStatus;
      */

      enrichedDeployments.push(deployment);
    } catch (error) {
      console.error(`Error enriching deployment ${deployment.deploymentId}:`, error);
      enrichedDeployments.push(deployment);
    }
  }

  return enrichedDeployments;
}

/**
 * Get deployment statistics
 */
function calculateStatistics(deployments) {
  const stats = {
    total: deployments.length,
    byStatus: {
      ACTIVE: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELED: 0,
      INACTIVE: 0,
    },
    byTarget: {},
  };

  deployments.forEach(deployment => {
    // Count by status
    const status = deployment.status || 'UNKNOWN';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // Count by target
    const target = deployment.targetArn || 'UNKNOWN';
    stats.byTarget[target] = (stats.byTarget[target] || 0) + 1;
  });

  return stats;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('List Deployments Request:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};

    const filters = {
      status: queryParams.status,
      targetArn: queryParams.targetArn,
      startTime: queryParams.startTime,
      endTime: queryParams.endTime,
      limit: parseInt(queryParams.limit) || 50,
      lastEvaluatedKey: queryParams.nextToken,
    };

    // Validate limit
    if (filters.limit < 1 || filters.limit > 100) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Limit must be between 1 and 100',
        }),
      };
    }

    // List deployments from DynamoDB
    const result = await listDeploymentsFromDynamoDB(filters);

    // Optionally enrich with live status (disabled by default for performance)
    const includeStats = queryParams.includeStats === 'true';
    const statistics = includeStats ? calculateStatistics(result.deployments) : null;

    // Sort by creation time (newest first)
    result.deployments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deployments: result.deployments,
        nextToken: result.lastEvaluatedKey,
        count: result.count,
        statistics,
      }),
    };
  } catch (error) {
    console.error('Error listing deployments:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to list deployments',
        message: error.message,
      }),
    };
  }
};
