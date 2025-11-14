import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SHADOW_HISTORY_TABLE = process.env.SHADOW_HISTORY_TABLE!;
const DEVICE_TABLE = process.env.DEVICE_TABLE!;

interface ShadowUpdateEvent {
  thingName?: string;
  topic?: string;
  shadowName?: string;
  state?: ShadowState;
  metadata?: any;
  version?: number;
  timestamp?: number;
}

interface ShadowState {
  reported?: Record<string, any>;
  desired?: Record<string, any>;
}

interface ShadowUpdateResponse {
  statusCode: number;
  body: string;
}

/**
 * Shadow Update Handler Lambda Function
 *
 * This function processes shadow update events from AWS IoT Core.
 * It's triggered by IoT Rules when a shadow is successfully updated.
 *
 * Responsibilities:
 * 1. Store shadow update history in DynamoDB
 * 2. Process business logic based on shadow changes
 * 3. Trigger alerts or notifications if needed
 * 4. Update device metadata
 */
export const handler = async (event: ShadowUpdateEvent): Promise<ShadowUpdateResponse> => {
  console.log('Shadow Update Event:', JSON.stringify(event, null, 2));

  try {
    // Extract thing name from event
    // Event structure depends on IoT Rule SQL statement
    const thingName = event.thingName || extractThingNameFromTopic(event.topic);
    const shadowName = event.shadowName || 'classic'; // classic or named shadow

    if (!thingName) {
      throw new Error('Could not determine thing name from event');
    }

    // Extract shadow state
    const { state, metadata, version, timestamp } = event;

    // Store shadow history
    await storeShadowHistory(thingName, shadowName, {
      state,
      metadata,
      version,
      timestamp: timestamp || Date.now()
    });

    // Process shadow changes for business logic
    await processShadowChanges(thingName, shadowName, state);

    // Update device last seen timestamp
    await updateDeviceLastSeen(thingName);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Shadow update processed successfully',
        thingName,
        shadowName
      })
    };

  } catch (error) {
    console.error('Error processing shadow update:', error);
    // Don't throw - we don't want to retry indefinitely
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing shadow update',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Extract thing name from MQTT topic
 */
function extractThingNameFromTopic(topic: string | undefined): string | null {
  if (!topic) return null;

  // Topic format: $aws/things/{thingName}/shadow/update/accepted
  // or: $aws/things/{thingName}/shadow/name/{shadowName}/update/accepted
  const match = topic.match(/\$aws\/things\/([^\/]+)\/shadow/);
  return match ? match[1] : null;
}

/**
 * Store shadow update history in DynamoDB
 */
async function storeShadowHistory(
  thingName: string,
  shadowName: string,
  shadowData: {
    state?: ShadowState;
    metadata?: any;
    version?: number;
    timestamp: number;
  }
): Promise<void> {
  const timestamp = shadowData.timestamp || Date.now();

  const params = {
    TableName: SHADOW_HISTORY_TABLE,
    Item: {
      thingName,
      timestamp,
      shadowName,
      state: shadowData.state,
      metadata: shadowData.metadata,
      version: shadowData.version,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
    }
  };

  await docClient.send(new PutCommand(params));
  console.log(`Stored shadow history for ${thingName}`);
}

/**
 * Process shadow changes for business logic
 */
async function processShadowChanges(thingName: string, _shadowName: string, state: ShadowState | undefined): Promise<void> {
  try {
    // Extract reported and desired states
    const reported = state?.reported || {};
    const desired = state?.desired || {};

    // Example: Check for low battery alert
    if (reported.battery && reported.battery < 20) {
      console.log(`LOW BATTERY ALERT: ${thingName} - ${reported.battery}%`);
      // TODO: Send alert notification (SNS, email, etc.)
      // await sendLowBatteryAlert(thingName, reported.battery);
    }

    // Example: Check for offline devices
    if (reported.connected === false) {
      console.log(`DEVICE OFFLINE: ${thingName}`);
      // TODO: Handle offline device
      // await handleOfflineDevice(thingName);
    }

    // Example: Check for error states
    if (reported.status === 'error' && reported.errorCode) {
      console.log(`DEVICE ERROR: ${thingName} - ${reported.errorCode}: ${reported.errorMessage}`);
      // TODO: Handle device error
      // await handleDeviceError(thingName, reported.errorCode, reported.errorMessage);
    }

    // Example: Track telemetry data
    if (reported.telemetry) {
      console.log(`Telemetry data from ${thingName}:`, reported.telemetry);
      // TODO: Store telemetry in time-series database (Timestream, etc.)
      // await storeTelemetry(thingName, reported.telemetry);
    }

    // Example: Firmware update tracking
    if (reported.firmware && desired.firmware) {
      if (reported.firmware.version !== desired.firmware.version) {
        console.log(`Firmware update pending for ${thingName}: ${reported.firmware.version} -> ${desired.firmware.version}`);
        // TODO: Track firmware update progress
      } else {
        console.log(`Firmware up-to-date for ${thingName}: ${reported.firmware.version}`);
      }
    }

  } catch (error) {
    console.error('Error processing shadow changes:', error);
    // Don't throw - log and continue
  }
}

/**
 * Update device last seen timestamp
 */
async function updateDeviceLastSeen(thingName: string): Promise<void> {
  try {
    const queryParams = {
      TableName: DEVICE_TABLE,
      IndexName: 'thingName-index',
      KeyConditionExpression: 'thingName = :tn',
      ExpressionAttributeValues: {
        ':tn': thingName
      },
      Limit: 1
    };

    const queryResult = await docClient.send(new QueryCommand(queryParams));

    if (queryResult.Items && queryResult.Items.length > 0) {
      const device = queryResult.Items[0];

      const updateParams = {
        TableName: DEVICE_TABLE,
        Key: {
          deviceId: device.deviceId
        },
        UpdateExpression: 'SET lastSeen = :lastSeen, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':lastSeen': new Date().toISOString(),
          ':updatedAt': new Date().toISOString()
        }
      };

      await docClient.send(new UpdateCommand(updateParams));
    }
  } catch (error) {
    console.error('Error updating device last seen:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Helper function to send low battery alert (example)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function sendLowBatteryAlert(thingName: string, batteryLevel: number): Promise<void> {
  // TODO: Implement alert notification
  // For example, publish to SNS topic:
  //
  // const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
  // const snsClient = new SNSClient({});
  //
  // await snsClient.send(new PublishCommand({
  //   TopicArn: process.env.ALERT_TOPIC_ARN,
  //   Subject: `Low Battery Alert: ${thingName}`,
  //   Message: `Device ${thingName} has low battery: ${batteryLevel}%`
  // }));

  console.log(`Alert would be sent for ${thingName} with battery ${batteryLevel}%`);
}
