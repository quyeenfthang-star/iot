const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({});

const SNS_ALERT_TOPIC_ARN = process.env.SNS_ALERT_TOPIC_ARN;

/**
 * Processes device shadow updates and sends SNS alerts for critical events
 * Triggered by DynamoDB stream on ShadowHistoryTable
 */
exports.handler = async (event) => {
  console.log('Device Alert Handler triggered:', JSON.stringify(event, null, 2));

  try {
    const alerts = [];

    // Process each record from the DynamoDB stream
    for (const record of event.Records) {
      if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
        const newImage = record.dynamodb.NewImage;

        // Extract shadow data
        const thingName = newImage.thingName?.S;
        const state = newImage.state?.M || {};
        const reported = state.reported?.M || {};
        const timestamp = newImage.timestamp?.N;

        // Check for alert conditions
        const detectedAlerts = detectAlerts(thingName, reported, timestamp);
        alerts.push(...detectedAlerts);
      }
    }

    // Send alerts via SNS
    for (const alert of alerts) {
      await sendAlert(alert);
    }

    console.log(`Processed ${alerts.length} alerts`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Device alerts processed',
        alertCount: alerts.length
      }),
    };
  } catch (error) {
    console.error('Error in device alert handler:', error);
    throw error;
  }
};

/**
 * Detect alert conditions from device shadow state
 */
function detectAlerts(thingName, reported, timestamp) {
  const alerts = [];
  const time = new Date(parseInt(timestamp)).toISOString();

  // Low battery alert
  const battery = reported.battery?.N;
  if (battery !== undefined) {
    const batteryLevel = parseFloat(battery);
    if (batteryLevel < 10) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'LOW_BATTERY',
        thingName,
        message: `Critical: Battery level at ${batteryLevel}%`,
        data: { battery: batteryLevel },
        timestamp: time,
      });
    } else if (batteryLevel < 20) {
      alerts.push({
        severity: 'WARNING',
        type: 'LOW_BATTERY',
        thingName,
        message: `Warning: Battery level at ${batteryLevel}%`,
        data: { battery: batteryLevel },
        timestamp: time,
      });
    }
  }

  // Temperature alert
  const temperature = reported.temperature?.N;
  if (temperature !== undefined) {
    const temp = parseFloat(temperature);
    if (temp > 80 || temp < -10) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'TEMPERATURE_ALERT',
        thingName,
        message: `Critical: Temperature out of range at ${temp}°C`,
        data: { temperature: temp },
        timestamp: time,
      });
    } else if (temp > 70 || temp < 0) {
      alerts.push({
        severity: 'WARNING',
        type: 'TEMPERATURE_ALERT',
        thingName,
        message: `Warning: Temperature approaching limits at ${temp}°C`,
        data: { temperature: temp },
        timestamp: time,
      });
    }
  }

  // Connection status alert
  const connected = reported.connected?.BOOL;
  if (connected === false) {
    alerts.push({
      severity: 'WARNING',
      type: 'DISCONNECTED',
      thingName,
      message: `Device disconnected`,
      data: { connected: false },
      timestamp: time,
    });
  }

  // Error status alert
  const errorMsg = reported.error?.S;
  const status = reported.status?.S;
  if (errorMsg || status === 'error') {
    alerts.push({
      severity: 'CRITICAL',
      type: 'DEVICE_ERROR',
      thingName,
      message: `Device error: ${errorMsg || 'Unknown error'}`,
      data: { error: errorMsg, status },
      timestamp: time,
    });
  }

  // High memory usage alert
  const memoryUsage = reported.memoryUsage?.N;
  if (memoryUsage !== undefined) {
    const memory = parseFloat(memoryUsage);
    if (memory > 90) {
      alerts.push({
        severity: 'WARNING',
        type: 'HIGH_MEMORY_USAGE',
        thingName,
        message: `High memory usage: ${memory}%`,
        data: { memoryUsage: memory },
        timestamp: time,
      });
    }
  }

  // High CPU usage alert
  const cpuUsage = reported.cpuUsage?.N;
  if (cpuUsage !== undefined) {
    const cpu = parseFloat(cpuUsage);
    if (cpu > 90) {
      alerts.push({
        severity: 'WARNING',
        type: 'HIGH_CPU_USAGE',
        thingName,
        message: `High CPU usage: ${cpu}%`,
        data: { cpuUsage: cpu },
        timestamp: time,
      });
    }
  }

  // Disk space alert
  const diskUsage = reported.diskUsage?.N;
  if (diskUsage !== undefined) {
    const disk = parseFloat(diskUsage);
    if (disk > 90) {
      alerts.push({
        severity: 'WARNING',
        type: 'LOW_DISK_SPACE',
        thingName,
        message: `Low disk space: ${disk}% used`,
        data: { diskUsage: disk },
        timestamp: time,
      });
    }
  }

  return alerts;
}

/**
 * Send alert notification via SNS
 */
async function sendAlert(alert) {
  try {
    const message = formatAlertMessage(alert);

    const params = {
      TopicArn: SNS_ALERT_TOPIC_ARN,
      Subject: `[${alert.severity}] IoT Device Alert: ${alert.type}`,
      Message: message,
      MessageAttributes: {
        severity: {
          DataType: 'String',
          StringValue: alert.severity,
        },
        alertType: {
          DataType: 'String',
          StringValue: alert.type,
        },
        thingName: {
          DataType: 'String',
          StringValue: alert.thingName,
        },
      },
    };

    await sns.send(new PublishCommand(params));
    console.log(`Alert sent for ${alert.thingName}: ${alert.type}`);
  } catch (error) {
    console.error('Error sending alert:', error);
    throw error;
  }
}

/**
 * Format alert message for SNS notification
 */
function formatAlertMessage(alert) {
  return `
IoT Device Alert Notification
==============================

Severity: ${alert.severity}
Alert Type: ${alert.type}
Device: ${alert.thingName}
Timestamp: ${alert.timestamp}

Message:
${alert.message}

Details:
${JSON.stringify(alert.data, null, 2)}

---
This is an automated alert from the IoT Fleet Management System.
Please investigate and take appropriate action.
  `.trim();
}
