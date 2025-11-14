const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FLEET_ANALYTICS_TABLE = process.env.FLEET_ANALYTICS_TABLE;
const DEVICE_TABLE = process.env.DEVICE_TABLE;

/**
 * Gets fleet-wide analytics and metrics
 * GET /analytics/fleet
 * Query parameters:
 * - metricType: Filter by metric type (optional)
 * - startDate: Start date for time range (optional, format: YYYY-MM-DD)
 * - endDate: End date for time range (optional, format: YYYY-MM-DD)
 */
exports.handler = async (event) => {
  console.log('Get Fleet Analytics:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const metricType = queryParams.metricType;
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;

    let metrics = [];

    if (metricType) {
      // Query by metric type
      const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
      const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();

      const result = await dynamoDb.send(
        new QueryCommand({
          TableName: FLEET_ANALYTICS_TABLE,
          IndexName: 'metricType-timestamp-index',
          KeyConditionExpression: 'metricType = :metricType AND #ts BETWEEN :start AND :end',
          ExpressionAttributeNames: {
            '#ts': 'timestamp',
          },
          ExpressionAttributeValues: {
            ':metricType': metricType,
            ':start': startTimestamp,
            ':end': endTimestamp,
          },
        })
      );

      metrics = result.Items || [];
    } else {
      // Scan all metrics (with optional date filtering in post-processing)
      const result = await dynamoDb.send(
        new ScanCommand({
          TableName: FLEET_ANALYTICS_TABLE,
        })
      );

      metrics = result.Items || [];

      // Apply date filtering if provided
      if (startDate || endDate) {
        const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
        const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();

        metrics = metrics.filter(
          (m) => m.timestamp >= startTimestamp && m.timestamp <= endTimestamp
        );
      }
    }

    // Get real-time device counts for comparison
    const deviceCountResult = await dynamoDb.send(
      new ScanCommand({
        TableName: DEVICE_TABLE,
        Select: 'COUNT',
      })
    );

    const totalDevices = deviceCountResult.Count || 0;

    // Get device counts by status
    const devicesByStatus = await getDeviceCountsByStatus();

    // Aggregate metrics for summary
    const summary = aggregateMetrics(metrics);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        summary: {
          totalDevices,
          devicesByStatus,
          ...summary,
        },
        metrics,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error getting fleet analytics:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to retrieve fleet analytics',
        message: error.message,
      }),
    };
  }
};

/**
 * Get device counts grouped by status
 */
async function getDeviceCountsByStatus() {
  const statusCounts = {
    ACTIVE: 0,
    INACTIVE: 0,
    PROVISIONING: 0,
  };

  try {
    for (const status of Object.keys(statusCounts)) {
      const result = await dynamoDb.send(
        new QueryCommand({
          TableName: DEVICE_TABLE,
          IndexName: 'status-index',
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': status,
          },
          Select: 'COUNT',
        })
      );

      statusCounts[status] = result.Count || 0;
    }
  } catch (error) {
    console.error('Error getting device counts by status:', error);
  }

  return statusCounts;
}

/**
 * Aggregate metrics for summary view
 */
function aggregateMetrics(metrics) {
  const summary = {
    byDeviceType: {},
    byStatus: {},
    trends: [],
  };

  metrics.forEach((metric) => {
    switch (metric.metricType) {
      case 'device-count-by-type':
        if (metric.dimensions && metric.dimensions.deviceType) {
          summary.byDeviceType[metric.dimensions.deviceType] = metric.value;
        }
        break;
      case 'device-count-by-status':
        if (metric.dimensions && metric.dimensions.status) {
          summary.byStatus[metric.dimensions.status] = metric.value;
        }
        break;
      default:
        break;
    }
  });

  return summary;
}
