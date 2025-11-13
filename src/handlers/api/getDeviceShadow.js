const { IoTDataPlaneClient, GetThingShadowCommand } = require('@aws-sdk/client-iot-data-plane');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const iotDataClient = new IoTDataPlaneClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE;

/**
 * Get Device Shadow API Handler
 *
 * GET /devices/{deviceId}/shadow?shadowName=optional
 */
exports.handler = async (event) => {
  console.log('Get Device Shadow Event:', JSON.stringify(event, null, 2));

  try {
    const deviceId = event.pathParameters?.deviceId;

    if (!deviceId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing deviceId parameter' })
      };
    }

    // Get device to find thing name
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
    const thingName = device.thingName;

    // Get shadow name from query params
    const queryParams = event.queryStringParameters || {};
    const shadowName = queryParams.shadowName;

    // Get shadow
    const command = new GetThingShadowCommand({
      thingName,
      shadowName // undefined for classic shadow
    });

    const shadowResult = await iotDataClient.send(command);
    const shadowData = JSON.parse(new TextDecoder().decode(shadowResult.payload));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device: {
          deviceId: device.deviceId,
          thingName: device.thingName,
          deviceType: device.deviceType
        },
        shadow: shadowData
      })
    };

  } catch (error) {
    console.error('Error getting device shadow:', error);

    // Handle shadow not found
    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Shadow not found',
          message: 'Device shadow does not exist yet'
        })
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to get device shadow',
        message: error.message
      })
    };
  }
};
