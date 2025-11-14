const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const DEVICE_TABLE = process.env.DEVICE_TABLE;
const SHADOW_HISTORY_TABLE = process.env.SHADOW_HISTORY_TABLE;

/**
 * Gets metrics for a specific device
 * GET /analytics/devices/{deviceId}/metrics
 * Query parameters:
 * - period: Time period (1h, 24h, 7d, 30d) - default: 24h
 */
exports.handler = async (event) => {
  console.log('Get Device Metrics:', JSON.stringify(event, null, 2));

  try {
    const deviceId = event.pathParameters?.deviceId;
    const period = event.queryStringParameters?.period || '24h';

    if (!deviceId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'deviceId is required' }),
      };
    }

    // Get device information
    const deviceResult = await dynamoDb.send(
      new GetCommand({
        TableName: DEVICE_TABLE,
        Key: { deviceId },
      })
    );

    if (!deviceResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Device not found' }),
      };
    }

    const device = deviceResult.Item;
    const thingName = device.thingName;

    // Calculate time range based on period
    const endTime = Date.now();
    const startTime = calculateStartTime(period, endTime);

    // Get shadow history for the period
    const historyResult = await dynamoDb.send(
      new QueryCommand({
        TableName: SHADOW_HISTORY_TABLE,
        KeyConditionExpression: 'thingName = :thingName AND #ts BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':thingName': thingName,
          ':start': startTime,
          ':end': endTime,
        },
      })
    );

    const shadowHistory = historyResult.Items || [];

    // Calculate metrics from shadow history
    const metrics = calculateDeviceMetrics(shadowHistory, device);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deviceId,
        thingName,
        period,
        metrics,
        device: {
          status: device.status,
          deviceType: device.deviceType,
          lastSeen: device.lastSeen,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error getting device metrics:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to retrieve device metrics',
        message: error.message,
      }),
    };
  }
};

/**
 * Calculate start time based on period
 */
function calculateStartTime(period, endTime) {
  const periodMap = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const milliseconds = periodMap[period] || periodMap['24h'];
  return endTime - milliseconds;
}

/**
 * Calculate device metrics from shadow history
 */
function calculateDeviceMetrics(shadowHistory, device) {
  const metrics = {
    updateCount: shadowHistory.length,
    averageUpdateInterval: 0,
    battery: {
      current: null,
      average: null,
      min: null,
      max: null,
    },
    temperature: {
      current: null,
      average: null,
      min: null,
      max: null,
    },
    connectivity: {
      connected: true,
      uptime: 0,
      downtime: 0,
      lastConnected: device.lastSeen,
    },
    errorCount: 0,
    alertCount: 0,
  };

  if (shadowHistory.length === 0) {
    return metrics;
  }

  // Sort by timestamp
  shadowHistory.sort((a, b) => a.timestamp - b.timestamp);

  // Calculate update intervals
  if (shadowHistory.length > 1) {
    const intervals = [];
    for (let i = 1; i < shadowHistory.length; i++) {
      intervals.push(shadowHistory[i].timestamp - shadowHistory[i - 1].timestamp);
    }
    metrics.averageUpdateInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  // Analyze shadow data
  const batteryLevels = [];
  const temperatures = [];

  shadowHistory.forEach((record) => {
    const reported = record.state?.reported || {};

    // Battery metrics
    if (reported.battery !== undefined) {
      batteryLevels.push(reported.battery);
    }

    // Temperature metrics
    if (reported.temperature !== undefined) {
      temperatures.push(reported.temperature);
    }

    // Error tracking
    if (reported.error || reported.status === 'error') {
      metrics.errorCount++;
    }

    // Alert tracking
    if (reported.alert || reported.battery < 20) {
      metrics.alertCount++;
    }

    // Connectivity
    if (reported.connected === false) {
      metrics.connectivity.connected = false;
    }
  });

  // Calculate battery statistics
  if (batteryLevels.length > 0) {
    metrics.battery.current = batteryLevels[batteryLevels.length - 1];
    metrics.battery.average = batteryLevels.reduce((a, b) => a + b, 0) / batteryLevels.length;
    metrics.battery.min = Math.min(...batteryLevels);
    metrics.battery.max = Math.max(...batteryLevels);
  }

  // Calculate temperature statistics
  if (temperatures.length > 0) {
    metrics.temperature.current = temperatures[temperatures.length - 1];
    metrics.temperature.average = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    metrics.temperature.min = Math.min(...temperatures);
    metrics.temperature.max = Math.max(...temperatures);
  }

  // Uptime calculation (simplified)
  if (shadowHistory.length > 0) {
    const firstUpdate = shadowHistory[0].timestamp;
    const lastUpdate = shadowHistory[shadowHistory.length - 1].timestamp;
    metrics.connectivity.uptime = lastUpdate - firstUpdate;
  }

  return metrics;
}
