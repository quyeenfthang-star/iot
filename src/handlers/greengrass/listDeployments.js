const { GreengrassV2Client, ListDeploymentsCommand } = require('@aws-sdk/client-greengrassv2');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const greengrass = new GreengrassV2Client({});
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const GREENGRASS_DEPLOYMENTS_TABLE = process.env.GREENGRASS_DEPLOYMENTS_TABLE;

/**
 * Lists Greengrass deployments
 * GET /greengrass/deployments
 *
 * Query parameters:
 * - targetArn: Filter by target ARN (optional)
 * - status: Filter by status (ACTIVE, COMPLETED, CANCELED, FAILED) (optional)
 * - historyFilter: Use local DynamoDB records instead of Greengrass API (optional, default: false)
 * - limit: Maximum number of results (optional, default: 50)
 * - nextToken: Pagination token (optional)
 */
exports.handler = async (event) => {
  console.log('List Greengrass Deployments:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const targetArn = queryParams.targetArn;
    const status = queryParams.status;
    const historyFilter = queryParams.historyFilter === 'true';
    const limit = parseInt(queryParams.limit || '50');
    const nextToken = queryParams.nextToken;

    let deployments = [];
    let paginationToken = null;

    if (historyFilter) {
      // Query from DynamoDB for historical records
      if (status) {
        // Query by status using GSI
        const result = await dynamoDb.send(
          new QueryCommand({
            TableName: GREENGRASS_DEPLOYMENTS_TABLE,
            IndexName: 'status-createdAt-index',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': status,
            },
            Limit: limit,
            ScanIndexForward: false, // Most recent first
          })
        );
        deployments = result.Items || [];
      } else {
        // Scan all records
        const result = await dynamoDb.send(
          new ScanCommand({
            TableName: GREENGRASS_DEPLOYMENTS_TABLE,
            Limit: limit,
          })
        );
        deployments = result.Items || [];
      }

      // Filter by targetArn if specified
      if (targetArn) {
        deployments = deployments.filter((d) => d.targetArn === targetArn);
      }
    } else {
      // Query from AWS IoT Greengrass
      const params = {
        maxResults: Math.min(limit, 100), // Greengrass API max is 100
        ...(targetArn && { targetArn }),
        ...(nextToken && { nextToken }),
      };

      // Note: Greengrass ListDeployments doesn't support status filter directly
      // We need to filter in post-processing
      const result = await greengrass.send(new ListDeploymentsCommand(params));

      deployments = result.deployments || [];
      paginationToken = result.nextToken;

      // Apply status filter if specified
      if (status) {
        deployments = deployments.filter(
          (d) => d.deploymentStatus === status
        );
      }
    }

    // Sort by creation timestamp (most recent first)
    deployments.sort((a, b) => {
      const timeA = a.creationTimestamp || a.createdAt || 0;
      const timeB = b.creationTimestamp || b.createdAt || 0;
      return timeB - timeA;
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deployments,
        count: deployments.length,
        ...(paginationToken && { nextToken: paginationToken }),
        filters: {
          targetArn: targetArn || null,
          status: status || null,
          historyFilter,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error listing Greengrass deployments:', error);
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
