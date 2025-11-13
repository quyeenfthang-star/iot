const { IoTDataPlaneClient, PublishCommand } = require('@aws-sdk/client-iot-data-plane');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const iotDataClient = new IoTDataPlaneClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SHADOW_HISTORY_TABLE = process.env.SHADOW_HISTORY_TABLE;

/**
 * Shadow Delta Handler Lambda Function
 *
 * This function processes shadow delta events, which occur when there's a
 * difference between the desired and reported states.
 *
 * Responsibilities:
 * 1. Log delta changes
 * 2. Notify devices of configuration changes
 * 3. Track pending updates
 * 4. Implement custom business logic for specific deltas
 *
 * @param {Object} event - IoT Rule event containing shadow delta
 */
exports.handler = async (event) => {
  console.log('Shadow Delta Event:', JSON.stringify(event, null, 2));

  try {
    // Extract thing name from event
    const thingName = event.thingName || extractThingNameFromTopic(event.topic);
    const shadowName = event.shadowName || 'classic';

    if (!thingName) {
      throw new Error('Could not determine thing name from event');
    }

    // Extract delta state
    const { state, metadata, version, timestamp } = event;

    // Log delta for audit trail
    await logDelta(thingName, shadowName, {
      state,
      metadata,
      version,
      timestamp: timestamp || Date.now()
    });

    // Process specific delta changes
    await processDeltaChanges(thingName, shadowName, state);

    // Optionally notify device via custom topic
    // (device already receives delta on standard shadow topic)
    // await notifyDevice(thingName, state);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Shadow delta processed successfully',
        thingName,
        shadowName
      })
    };

  } catch (error) {
    console.error('Error processing shadow delta:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing shadow delta',
        error: error.message
      })
    };
  }
};

/**
 * Extract thing name from MQTT topic
 */
function extractThingNameFromTopic(topic) {
  if (!topic) return null;

  // Topic format: $aws/things/{thingName}/shadow/update/delta
  const match = topic.match(/\$aws\/things\/([^\/]+)\/shadow/);
  return match ? match[1] : null;
}

/**
 * Log delta changes to DynamoDB
 */
async function logDelta(thingName, shadowName, deltaData) {
  const timestamp = deltaData.timestamp || Date.now();

  const params = {
    TableName: SHADOW_HISTORY_TABLE,
    Item: {
      thingName,
      timestamp,
      shadowName,
      eventType: 'DELTA',
      delta: deltaData.state,
      metadata: deltaData.metadata,
      version: deltaData.version,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
    }
  };

  await docClient.send(new PutCommand(params));
  console.log(`Logged delta for ${thingName}`);
}

/**
 * Process delta changes for business logic
 */
async function processDeltaChanges(thingName, shadowName, delta) {
  try {
    console.log(`Processing delta for ${thingName}:`, JSON.stringify(delta, null, 2));

    // Example 1: Firmware update request
    if (delta.firmware) {
      console.log(`Firmware update pending for ${thingName}:`, delta.firmware);
      // TODO: Create IoT Job for firmware update
      // await createFirmwareUpdateJob(thingName, delta.firmware);
    }

    // Example 2: Configuration change
    if (delta.config) {
      console.log(`Configuration change for ${thingName}:`, delta.config);

      // Validate configuration before applying
      if (delta.config.reportInterval) {
        if (delta.config.reportInterval < 10 || delta.config.reportInterval > 3600) {
          console.warn(`Invalid report interval for ${thingName}: ${delta.config.reportInterval}`);
          // TODO: Revert invalid configuration
          // await revertShadowUpdate(thingName, 'config.reportInterval');
        }
      }
    }

    // Example 3: Remote command
    if (delta.command) {
      console.log(`Command for ${thingName}:`, delta.command);
      await handleRemoteCommand(thingName, delta.command);
    }

    // Example 4: Power state change
    if (delta.power !== undefined) {
      console.log(`Power state change for ${thingName}: ${delta.power ? 'ON' : 'OFF'}`);
      // TODO: Handle power state change
    }

    // Example 5: Alert thresholds
    if (delta.alertThresholds) {
      console.log(`Alert thresholds updated for ${thingName}:`, delta.alertThresholds);
      // TODO: Update monitoring rules
    }

  } catch (error) {
    console.error('Error processing delta changes:', error);
  }
}

/**
 * Handle remote commands sent via shadow
 */
async function handleRemoteCommand(thingName, command) {
  console.log(`Executing remote command for ${thingName}:`, command);

  // Validate command
  const validCommands = ['reboot', 'reset', 'diagnostics', 'calibrate'];

  if (command.action && validCommands.includes(command.action)) {
    // Log command execution
    console.log(`Valid command: ${command.action} for ${thingName}`);

    // Device will execute the command when it receives the delta
    // We can track the command execution here

    // TODO: Store command in command history table
    // TODO: Set command timeout
    // TODO: Monitor command completion
  } else {
    console.warn(`Invalid command for ${thingName}:`, command);
  }
}

/**
 * Notify device via custom MQTT topic (optional)
 * Device already receives delta on shadow topic, but you might want
 * to send additional notifications
 */
async function notifyDevice(thingName, delta) {
  const topic = `device/${thingName}/notifications`;

  const message = {
    type: 'shadow_delta',
    timestamp: Date.now(),
    delta: delta,
    message: 'Configuration update available'
  };

  try {
    await iotDataClient.send(new PublishCommand({
      topic,
      payload: JSON.stringify(message),
      qos: 1
    }));

    console.log(`Sent notification to ${thingName} on ${topic}`);
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw - notification is optional
  }
}

/**
 * Revert invalid shadow update (example)
 */
async function revertShadowUpdate(thingName, field) {
  // TODO: Implement shadow revert logic
  // This would remove the invalid field from desired state

  console.log(`Would revert ${field} for ${thingName}`);
}

/**
 * Create firmware update job (example)
 */
async function createFirmwareUpdateJob(thingName, firmwareInfo) {
  // TODO: Implement IoT Jobs integration
  // const { IoTClient, CreateJobCommand } = require('@aws-sdk/client-iot');
  //
  // const iotClient = new IoTClient({});
  //
  // await iotClient.send(new CreateJobCommand({
  //   jobId: `firmware-update-${thingName}-${Date.now()}`,
  //   targets: [`arn:aws:iot:region:account:thing/${thingName}`],
  //   document: JSON.stringify({
  //     operation: 'firmware_update',
  //     firmware: firmwareInfo
  //   }),
  //   targetSelection: 'SNAPSHOT'
  // }));

  console.log(`Would create firmware update job for ${thingName}:`, firmwareInfo);
}
