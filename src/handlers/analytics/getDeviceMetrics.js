/**
 * Device Metrics Analytics Handler
 *
 * Provides detailed metrics for a specific device or fleet-wide aggregation:
 * - Time-series telemetry data
 * - Statistical analysis (min, max, avg, p50, p95, p99)
 * - Trend detection
 * - Anomaly detection
 *
 * API: GET /analytics/devices/{deviceId}/metrics
 * API: GET /analytics/fleet/metrics
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

const SHADOW_HISTORY_TABLE = process.env.SHADOW_HISTORY_TABLE;
const DEVICE_TABLE = process.env.DEVICE_TABLE;

/**
 * Calculate statistics from an array of values
 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    count: sorted.length,
  };
}

/**
 * Detect anomalies using standard deviation
 */
function detectAnomalies(values, threshold = 2) {
  if (!values || values.length < 3) {
    return [];
  }

  const avg = values.reduce((acc, val) => acc + val.value, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val.value - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const anomalies = values.filter(item => {
    const deviation = Math.abs(item.value - avg) / stdDev;
    return deviation > threshold;
  });

  return anomalies.map(item => ({
    timestamp: item.timestamp,
    value: item.value,
    deviation: Math.abs(item.value - avg) / stdDev,
  }));
}

/**
 * Get metrics for a specific device
 */
async function getDeviceMetrics(deviceId, startTime, endTime, metricName) {
  // Query shadow history for the device
  const params = {
    TableName: SHADOW_HISTORY_TABLE,
    KeyConditionExpression: 'thingName = :thingName AND #ts BETWEEN :start AND :end',
    ExpressionAttributeNames: {
      '#ts': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':thingName': deviceId,
      ':start': startTime,
      ':end': endTime,
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  const history = result.Items || [];

  // Extract metric values
  const metricData = [];
  const allMetrics = new Set();

  for (const item of history) {
    const reported = item.state?.reported || {};

    // Collect all available metrics
    Object.keys(reported).forEach(key => {
      if (typeof reported[key] === 'number') {
        allMetrics.add(key);
      }
    });

    // If specific metric requested, extract it
    if (metricName && reported[metricName] !== undefined) {
      metricData.push({
        timestamp: item.timestamp,
        value: reported[metricName],
      });
    } else if (!metricName) {
      // Collect all numeric metrics
      metricData.push({
        timestamp: item.timestamp,
        ...reported,
      });
    }
  }

  // Calculate statistics if specific metric requested
  let statistics = null;
  let anomalies = null;

  if (metricName && metricData.length > 0) {
    const values = metricData.map(d => d.value);
    statistics = calculateStats(values);
    anomalies = detectAnomalies(metricData);
  }

  return {
    deviceId,
    metricName: metricName || 'all',
    dataPoints: metricData.length,
    availableMetrics: Array.from(allMetrics),
    timeSeries: metricData,
    statistics,
    anomalies,
  };
}

/**
 * Get fleet-wide metrics aggregation
 */
async function getFleetMetrics(startTime, endTime, metricName) {
  // Get all devices
  const devicesResult = await docClient.send(new ScanCommand({
    TableName: DEVICE_TABLE,
  }));

  const devices = devicesResult.Items || [];
  const fleetMetrics = {
    totalDevices: devices.length,
    devicesWithData: 0,
    metricName: metricName || 'all',
    aggregatedStatistics: {},
    deviceBreakdown: [],
  };

  // Collect metrics for each device
  const allValues = {};

  for (const device of devices) {
    try {
      const deviceMetrics = await getDeviceMetrics(
        device.thingName,
        startTime,
        endTime,
        metricName
      );

      if (deviceMetrics.dataPoints > 0) {
        fleetMetrics.devicesWithData++;

        // Aggregate by metric name
        if (metricName && deviceMetrics.statistics) {
          if (!allValues[metricName]) {
            allValues[metricName] = [];
          }

          // Add all device values for fleet-wide stats
          deviceMetrics.timeSeries.forEach(point => {
            allValues[metricName].push(point.value);
          });

          fleetMetrics.deviceBreakdown.push({
            deviceId: device.deviceId,
            thingName: device.thingName,
            deviceType: device.deviceType,
            dataPoints: deviceMetrics.dataPoints,
            statistics: deviceMetrics.statistics,
          });
        }
      }
    } catch (error) {
      console.error(`Error getting metrics for device ${device.thingName}:`, error);
    }
  }

  // Calculate fleet-wide statistics
  if (metricName && allValues[metricName]) {
    fleetMetrics.aggregatedStatistics[metricName] = calculateStats(allValues[metricName]);
  }

  return fleetMetrics;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Device Metrics Request:', JSON.stringify(event, null, 2));

  try {
    const pathParams = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};

    const deviceId = pathParams.deviceId;
    const metricName = queryParams.metric;
    const hours = parseInt(queryParams.hours) || 24;
    const startTime = queryParams.startTime
      ? parseInt(queryParams.startTime)
      : Date.now() - (hours * 60 * 60 * 1000);
    const endTime = queryParams.endTime
      ? parseInt(queryParams.endTime)
      : Date.now();

    // Validate time range
    if (endTime <= startTime) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid time range. endTime must be greater than startTime.',
        }),
      };
    }

    let metrics;

    if (deviceId) {
      // Get metrics for specific device
      metrics = await getDeviceMetrics(deviceId, startTime, endTime, metricName);
    } else {
      // Get fleet-wide metrics
      metrics = await getFleetMetrics(startTime, endTime, metricName);
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
        },
        metrics,
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
        error: 'Failed to get device metrics',
        message: error.message,
      }),
    };
  }
};
