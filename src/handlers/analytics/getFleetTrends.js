/**
 * Fleet Trends Analytics Handler
 *
 * Provides trend analysis for fleet metrics over time:
 * - Device growth trends
 * - Connection stability trends
 * - Performance trends
 * - Alert frequency trends
 * - Comparative analysis (week-over-week, month-over-month)
 *
 * API: GET /analytics/fleet/trends
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE;
const PROVISIONING_LOGS_TABLE = process.env.PROVISIONING_LOGS_TABLE;

/**
 * Group data into time buckets
 */
function groupByTimeBucket(data, bucketSize = 'hour') {
  const buckets = {};

  const getBucketKey = (timestamp) => {
    const date = new Date(timestamp);

    switch (bucketSize) {
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        break;
      default:
        date.setMinutes(0, 0, 0);
    }

    return date.getTime();
  };

  data.forEach(item => {
    const bucket = getBucketKey(item.timestamp);
    if (!buckets[bucket]) {
      buckets[bucket] = [];
    }
    buckets[bucket].push(item);
  });

  return buckets;
}

/**
 * Calculate device growth trends
 */
async function calculateDeviceGrowthTrends(startTime, endTime, bucketSize) {
  // Get provisioning logs for the time range
  const params = {
    TableName: PROVISIONING_LOGS_TABLE,
    FilterExpression: '#ts BETWEEN :start AND :end',
    ExpressionAttributeNames: {
      '#ts': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':start': startTime,
      ':end': endTime,
    },
  };

  const result = await docClient.send(new ScanCommand(params));
  const logs = result.Items || [];

  // Filter successful provisioning
  const successfulProvisioning = logs.filter(log => log.allowed === true);

  // Group by time bucket
  const buckets = groupByTimeBucket(
    successfulProvisioning.map(log => ({ timestamp: log.timestamp })),
    bucketSize
  );

  // Calculate cumulative growth
  const sortedBuckets = Object.keys(buckets).sort((a, b) => parseInt(a) - parseInt(b));
  let cumulative = 0;

  const trends = sortedBuckets.map(bucket => {
    const count = buckets[bucket].length;
    cumulative += count;

    return {
      timestamp: parseInt(bucket),
      date: new Date(parseInt(bucket)).toISOString(),
      newDevices: count,
      totalDevices: cumulative,
    };
  });

  return trends;
}

/**
 * Calculate connection stability trends
 */
async function calculateConnectionTrends(startTime, endTime) {
  // Get all devices
  const devicesResult = await docClient.send(new ScanCommand({
    TableName: DEVICE_TABLE,
  }));

  const devices = devicesResult.Items || [];
  const now = Date.now();

  // Analyze connection patterns over time
  const hourlyBuckets = {};
  const bucketCount = Math.ceil((endTime - startTime) / (60 * 60 * 1000));

  // Initialize buckets
  for (let i = 0; i < bucketCount; i++) {
    const bucketTime = startTime + (i * 60 * 60 * 1000);
    hourlyBuckets[bucketTime] = {
      timestamp: bucketTime,
      date: new Date(bucketTime).toISOString(),
      online: 0,
      offline: 0,
      onlinePercentage: 0,
    };
  }

  // Analyze each device's connection history
  devices.forEach(device => {
    const lastSeen = device.lastSeen || 0;

    // Determine which bucket this device was last seen in
    const bucketTime = Math.floor(lastSeen / (60 * 60 * 1000)) * (60 * 60 * 1000);

    if (hourlyBuckets[bucketTime]) {
      // Device was online in this bucket
      hourlyBuckets[bucketTime].online++;
    }
  });

  // Calculate percentages
  const totalDevices = devices.length;
  Object.values(hourlyBuckets).forEach(bucket => {
    bucket.offline = totalDevices - bucket.online;
    if (totalDevices > 0) {
      bucket.onlinePercentage = Math.round((bucket.online / totalDevices) * 100);
    }
  });

  return Object.values(hourlyBuckets).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate alert frequency trends
 */
async function calculateAlertTrends(startTime, endTime, bucketSize) {
  // Get all devices with current state
  const devicesResult = await docClient.send(new ScanCommand({
    TableName: DEVICE_TABLE,
  }));

  const devices = devicesResult.Items || [];

  // This is a simplified version - in production, you'd track alert history
  // For now, we'll analyze current state and extrapolate
  const currentAlerts = {
    lowBattery: 0,
    errors: 0,
    offline: 0,
    total: 0,
  };

  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  devices.forEach(device => {
    if (device.shadowState) {
      const reported = device.shadowState.reported || {};

      if (reported.batteryLevel !== undefined && reported.batteryLevel < 20) {
        currentAlerts.lowBattery++;
      }

      if (reported.status === 'error' || reported.errorCount > 0) {
        currentAlerts.errors++;
      }
    }

    const lastSeen = device.lastSeen || 0;
    if (lastSeen < oneHourAgo) {
      currentAlerts.offline++;
    }
  });

  currentAlerts.total = currentAlerts.lowBattery + currentAlerts.errors + currentAlerts.offline;

  // Return current snapshot with trend indication
  return {
    currentAlerts,
    timestamp: new Date().toISOString(),
    // In production, you'd return historical trend data here
  };
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Fleet Trends Request:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};

    const trendType = queryParams.type || 'all'; // growth, connection, alerts, all
    const days = parseInt(queryParams.days) || 7;
    const bucketSize = queryParams.bucket || 'day'; // hour, day, week

    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);

    // Validate bucket size
    const validBuckets = ['hour', 'day', 'week'];
    if (!validBuckets.includes(bucketSize)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Invalid bucket size. Must be one of: ${validBuckets.join(', ')}`,
        }),
      };
    }

    const trends = {};

    // Calculate requested trends
    if (trendType === 'all' || trendType === 'growth') {
      trends.deviceGrowth = await calculateDeviceGrowthTrends(startTime, endTime, bucketSize);
    }

    if (trendType === 'all' || trendType === 'connection') {
      trends.connectionStability = await calculateConnectionTrends(startTime, endTime);
    }

    if (trendType === 'all' || trendType === 'alerts') {
      trends.alertFrequency = await calculateAlertTrends(startTime, endTime, bucketSize);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        timeRange: {
          start: new Date(startTime).toISOString(),
          end: new Date(endTime).toISOString(),
          days,
        },
        bucketSize,
        trends,
      }),
    };
  } catch (error) {
    console.error('Error calculating fleet trends:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to calculate fleet trends',
        message: error.message,
      }),
    };
  }
};
