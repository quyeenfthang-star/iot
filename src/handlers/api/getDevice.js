const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { IoTClient, DescribeThingCommand } = require('@aws-sdk/client-iot');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const iotClient = new IoTClient({});

const DEVICE_TABLE = process.env.DEVICE_TABLE;

/**
 * Get Device API Handler
 *
 * GET /devices/{deviceId}
 */
exports.handler = async (event) => {
  console.log('Get Device Event:', JSON.stringify(event, null, 2));

  try {
    const deviceId = event.pathParameters?.deviceId;

    if (!deviceId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing deviceId parameter' })
      };
    }

    // Get device from DynamoDB
    const params = {
      TableName: DEVICE_TABLE,
      Key: { deviceId }
    };

    const result = await docClient.send(new GetCommand(params));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Device not found' })
      };
    }

    const device = result.Item;

    // Optionally get thing details from IoT Core
    let thingDetails = null;
    if (device.thingName) {
      try {
        const thingCommand = new DescribeThingCommand({
          thingName: device.thingName
        });
        thingDetails = await iotClient.send(thingCommand);
      } catch (error) {
        console.warn('Could not fetch thing details:', error.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device,
        thingDetails
      })
    };

  } catch (error) {
    console.error('Error getting device:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to get device',
        message: error.message
      })
    };
  }
};
