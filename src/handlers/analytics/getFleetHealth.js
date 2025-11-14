/**
 * Fleet Health Analytics Handler
 *
 * Provides aggregate fleet health metrics including:
 * - Total device count by status
 * - Device type distribution
 * - Connection statistics
 * - Recent activity metrics
 * - Alert summary
 *
 * API: GET /analytics/fleet/health
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE;
const SHADOW_HISTORY_TABLE = process.env.SHADOW_HISTORY_TABLE;

/**
 * Calculate fleet health metrics
 */
async function calculateFleetHealth(timeRange = 24) {
  const now = Date.now();
  const timeRangeMs = timeRange * 60 * 60 * 1000; // Convert hours to milliseconds
  const startTime = now - timeRangeMs;

  // Get all devices
  const devicesResult = await docClient.send(new ScanCommand({
    TableName: DEVICE_TABLE,
  }));

  const devices = devicesResult.Items || [];

  // Calculate metrics
  const metrics = {
    totalDevices: devices.length,
    devicesByStatus: {
      active: 0,
      inactive: 0,
      error: 0,
      provisioning: 0,
    },
    devicesByType: {
      Sensor: 0,
      Gateway: 0,
      Actuator: 0,
      Other: 0,
    },
    connectionStats: {
      online: 0,
      offline: 0,
      onlinePercentage: 0,
    },
    recentActivity: {
      devicesSeenInLast24h: 0,
      devicesSeenInLastHour: 0,
      newDevicesInLast24h: 0,
    },
    alerts: {
      lowBattery: 0,
      errors: 0,
      offline: 0,
    },
    averageMetrics: {
      batteryLevel: 0,
      signalStrength: 0,
      uptime: 0,
    },
  };

  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const oneHourAgo = now - (60 * 60 * 1000);

  let totalBattery = 0;
  let batteryCount = 0;
  let totalSignal = 0;
  let signalCount = 0;
  let totalUptime = 0;
  let uptimeCount = 0;

  // Process each device
  for (const device of devices) {
    // Count by status
    const status = device.status || 'inactive';
    metrics.devicesByStatus[status] = (metrics.devicesByStatus[status] || 0) + 1;

    // Count by type
    const deviceType = device.deviceType || 'Other';
    metrics.devicesByType[deviceType] = (metrics.devicesByType[deviceType] || 0) + 1;

    // Check last seen for connection stats
    const lastSeen = device.lastSeen || 0;
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    if (lastSeen > fiveMinutesAgo) {
      metrics.connectionStats.online++;
    } else {
      metrics.connectionStats.offline++;
    }

    // Recent activity
    if (lastSeen > oneDayAgo) {
      metrics.recentActivity.devicesSeenInLast24h++;
    }

    if (lastSeen > oneHourAgo) {
      metrics.recentActivity.devicesSeenInLastHour++;
    }

    // New devices
    const createdAt = device.createdAt || 0;
    if (createdAt > oneDayAgo) {
      metrics.recentActivity.newDevicesInLast24h++;
    }

    // Alert detection from shadow state
    if (device.shadowState) {
      const reported = device.shadowState.reported || {};

      // Low battery check
      if (reported.batteryLevel !== undefined && reported.batteryLevel < 20) {
        metrics.alerts.lowBattery++;
      }

      // Error state check
      if (reported.status === 'error' || reported.errorCount > 0) {
        metrics.alerts.errors++;
      }

      // Offline check (not seen in 1 hour)
      if (lastSeen < oneHourAgo) {
        metrics.alerts.offline++;
      }

      // Calculate averages
      if (reported.batteryLevel !== undefined) {
        totalBattery += reported.batteryLevel;
        batteryCount++;
      }

      if (reported.signalStrength !== undefined) {
        totalSignal += reported.signalStrength;
        signalCount++;
      }

      if (reported.uptime !== undefined) {
        totalUptime += reported.uptime;
        uptimeCount++;
      }
    }
  }

  // Calculate percentages and averages
  if (metrics.totalDevices > 0) {
    metrics.connectionStats.onlinePercentage =
      Math.round((metrics.connectionStats.online / metrics.totalDevices) * 100);
  }

  if (batteryCount > 0) {
    metrics.averageMetrics.batteryLevel = Math.round(totalBattery / batteryCount);
  }

  if (signalCount > 0) {
    metrics.averageMetrics.signalStrength = Math.round(totalSignal / signalCount);
  }

  if (uptimeCount > 0) {
    metrics.averageMetrics.uptime = Math.round(totalUptime / uptimeCount);
  }

  return metrics;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Fleet Health Request:', JSON.stringify(event, null, 2));

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const timeRange = parseInt(queryParams.timeRange) || 24; // Default 24 hours

    // Validate time range
    if (timeRange < 1 || timeRange > 168) { // Max 1 week
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid time range. Must be between 1 and 168 hours.',
        }),
      };
    }

    // Calculate fleet health
    const health = await calculateFleetHealth(timeRange);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        timeRange: `${timeRange}h`,
        health,
      }),
    };
  } catch (error) {
    console.error('Error calculating fleet health:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to calculate fleet health',
        message: error.message,
      }),
    };
  }
};
