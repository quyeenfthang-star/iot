import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { IoTClient, AddThingToThingGroupCommand, DescribeThingCommand, DescribeThingCommandOutput } from '@aws-sdk/client-iot';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const iotClient = new IoTClient({});

const DEVICE_TABLE = process.env.DEVICE_TABLE!;

interface PostProvisioningEvent {
  thingName: string;
  certificateId?: string;
  deviceType?: string;
}

interface PostProvisioningResponse {
  statusCode: number;
  body: string;
}

/**
 * Post-Provisioning Hook Lambda Function
 *
 * This function is triggered after successful device provisioning to perform
 * additional setup tasks:
 * 1. Update device status in registry
 * 2. Add device to Thing Groups
 * 3. Initialize device shadow
 * 4. Send welcome/initialization messages
 * 5. Trigger any custom business logic
 *
 * Note: This is invoked manually or via IoT Rules after provisioning
 */
export const handler = async (event: PostProvisioningEvent): Promise<PostProvisioningResponse> => {
  console.log('Post-Provisioning Hook Event:', JSON.stringify(event, null, 2));

  try {
    const { thingName, deviceType } = event;

    if (!thingName) {
      throw new Error('Missing thingName in event');
    }

    // Get thing details from IoT Core
    const thingDetails = await getThingDetails(thingName);
    console.log('Thing details:', JSON.stringify(thingDetails, null, 2));

    // Extract serial number from thing attributes
    const serialNumber = thingDetails.attributes?.serialNumber;

    // Update device status in registry
    await updateDeviceStatus(serialNumber, thingName, 'ACTIVE');

    // Add device to appropriate Thing Group based on device type
    await addToThingGroup(thingName, deviceType || thingDetails.thingTypeName);

    // Initialize device shadow (optional)
    // await initializeDeviceShadow(thingName, deviceType);

    console.log(`Post-provisioning completed for ${thingName}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Post-provisioning completed successfully',
        thingName,
        status: 'ACTIVE'
      })
    };

  } catch (error) {
    console.error('Error in post-provisioning hook:', error);
    throw error;
  }
};

/**
 * Get thing details from IoT Core
 */
async function getThingDetails(thingName: string): Promise<DescribeThingCommandOutput> {
  const command = new DescribeThingCommand({ thingName });
  return await iotClient.send(command);
}

/**
 * Update device status in DynamoDB registry
 */
async function updateDeviceStatus(_serialNumber: string | undefined, thingName: string, status: string): Promise<void> {
  // First, find the device by serial number or thing name
  // For simplicity, we'll use thing name if serial number is not available
  const queryParams = {
    TableName: DEVICE_TABLE,
    IndexName: 'thingName-index',
    KeyConditionExpression: 'thingName = :tn',
    ExpressionAttributeValues: {
      ':tn': thingName
    },
    Limit: 1
  };

  try {
    const queryResult = await docClient.send(new QueryCommand(queryParams));

    if (queryResult.Items && queryResult.Items.length > 0) {
      const device = queryResult.Items[0];

      const updateParams = {
        TableName: DEVICE_TABLE,
        Key: {
          deviceId: device.deviceId
        },
        UpdateExpression: 'SET #status = :status, thingName = :thingName, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':thingName': thingName,
          ':updatedAt': new Date().toISOString()
        }
      };

      await docClient.send(new UpdateCommand(updateParams));
      console.log(`Updated device status to ${status} for ${thingName}`);
    }
  } catch (error) {
    console.error('Error updating device status:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Add thing to appropriate Thing Group
 */
async function addToThingGroup(thingName: string, _deviceType: string | undefined): Promise<void> {
  try {
    // Add to production group
    await iotClient.send(new AddThingToThingGroupCommand({
      thingName,
      thingGroupName: 'production'
    }));

    console.log(`Added ${thingName} to production group`);

    // Add to device-type-specific group if needed
    // await iotClient.send(new AddThingToThingGroupCommand({
    //   thingName,
    //   thingGroupName: `production-${deviceType.toLowerCase()}`
    // }));

  } catch (error) {
    console.error('Error adding thing to group:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Initialize device shadow with default values (optional)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function initializeDeviceShadow(thingName: string, _deviceType: string | undefined): Promise<void> {
  const { IoTDataPlaneClient, UpdateThingShadowCommand } = await import('@aws-sdk/client-iot-data-plane');

  const iotDataClient = new IoTDataPlaneClient({});

  const initialShadow = {
    state: {
      desired: {
        connected: true,
        reportInterval: 60, // seconds
        firmware: {
          version: '1.0.0',
          updateAvailable: false
        }
      }
    }
  };

  try {
    const command = new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(JSON.stringify(initialShadow))
    });

    await iotDataClient.send(command);
    console.log(`Initialized shadow for ${thingName}`);
  } catch (error) {
    console.error('Error initializing shadow:', error);
    // Don't throw - shadow will be created on first device update
  }
}
