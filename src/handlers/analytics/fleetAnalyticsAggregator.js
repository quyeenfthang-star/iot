const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FLEET_ANALYTICS_TABLE = process.env.FLEET_ANALYTICS_TABLE;

/**
 * Aggregates fleet metrics from device registry stream events
 * Triggered by DynamoDB stream on DeviceRegistryTable
 */
exports.handler = async (event) => {
  console.log('Fleet Analytics Aggregator triggered:', JSON.stringify(event, null, 2));

  try {
    const timestamp = Date.now();
    const date = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD

    // Process each record from the DynamoDB stream
    for (const record of event.Records) {
      const eventName = record.eventName; // INSERT, MODIFY, REMOVE

      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        const newImage = record.dynamodb.NewImage;
        const deviceType = newImage.deviceType?.S || 'Unknown';
        const status = newImage.status?.S || 'UNKNOWN';

        // Aggregate metrics by device type
        await updateMetric({
          metricId: `fleet-by-type-${deviceType}-${date}`,
          metricType: 'device-count-by-type',
          dimensions: {
            deviceType,
            date,
          },
          value: 1,
          operation: 'INCREMENT',
          timestamp,
        });

        // Aggregate metrics by status
        await updateMetric({
          metricId: `fleet-by-status-${status}-${date}`,
          metricType: 'device-count-by-status',
          dimensions: {
            status,
            date,
          },
          value: 1,
          operation: 'INCREMENT',
          timestamp,
        });

        // Overall fleet size
        await updateMetric({
          metricId: `fleet-total-${date}`,
          metricType: 'fleet-total-count',
          dimensions: {
            date,
          },
          value: 1,
          operation: 'INCREMENT',
          timestamp,
        });

        // Track active devices
        if (status === 'ACTIVE') {
          await updateMetric({
            metricId: `fleet-active-${date}`,
            metricType: 'active-device-count',
            dimensions: {
              date,
            },
            value: 1,
            operation: 'INCREMENT',
            timestamp,
          });
        }
      } else if (eventName === 'REMOVE') {
        const oldImage = record.dynamodb.OldImage;
        const deviceType = oldImage.deviceType?.S || 'Unknown';
        const status = oldImage.status?.S || 'UNKNOWN';

        // Decrement metrics when device is removed
        await updateMetric({
          metricId: `fleet-by-type-${deviceType}-${date}`,
          metricType: 'device-count-by-type',
          dimensions: {
            deviceType,
            date,
          },
          value: -1,
          operation: 'INCREMENT',
          timestamp,
        });

        await updateMetric({
          metricId: `fleet-by-status-${status}-${date}`,
          metricType: 'device-count-by-status',
          dimensions: {
            status,
            date,
          },
          value: -1,
          operation: 'INCREMENT',
          timestamp,
        });

        await updateMetric({
          metricId: `fleet-total-${date}`,
          metricType: 'fleet-total-count',
          dimensions: {
            date,
          },
          value: -1,
          operation: 'INCREMENT',
          timestamp,
        });

        if (status === 'ACTIVE') {
          await updateMetric({
            metricId: `fleet-active-${date}`,
            metricType: 'active-device-count',
            dimensions: {
              date,
            },
            value: -1,
            operation: 'INCREMENT',
            timestamp,
          });
        }
      }
    }

    console.log('Fleet analytics aggregation completed successfully');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Fleet analytics updated' }),
    };
  } catch (error) {
    console.error('Error in fleet analytics aggregator:', error);
    throw error;
  }
};

/**
 * Updates or creates a metric in the analytics table
 */
async function updateMetric({ metricId, metricType, dimensions, value, operation, timestamp }) {
  try {
    // Check if metric already exists for today
    const queryResult = await dynamoDb.send(
      new QueryCommand({
        TableName: FLEET_ANALYTICS_TABLE,
        KeyConditionExpression: 'metricId = :metricId',
        ExpressionAttributeValues: {
          ':metricId': metricId,
        },
        ScanIndexForward: false,
        Limit: 1,
      })
    );

    let currentValue = 0;
    if (queryResult.Items && queryResult.Items.length > 0) {
      currentValue = queryResult.Items[0].value || 0;
    }

    // Calculate new value
    const newValue = operation === 'INCREMENT' ? currentValue + value : value;

    // Store updated metric
    await dynamoDb.send(
      new PutCommand({
        TableName: FLEET_ANALYTICS_TABLE,
        Item: {
          metricId,
          timestamp,
          metricType,
          dimensions,
          value: Math.max(0, newValue), // Ensure non-negative
          updatedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days retention
        },
      })
    );

    console.log(`Updated metric ${metricId}: ${currentValue} -> ${newValue}`);
  } catch (error) {
    console.error(`Error updating metric ${metricId}:`, error);
    throw error;
  }
}
