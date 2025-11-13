const { IoTDataPlaneClient, UpdateThingShadowCommand } = require('@aws-sdk/client-iot-data-plane');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const iotDataClient = new IoTDataPlaneClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE;

/**
 * Update Device Shadow API Handler
 *
 * PUT /devices/{deviceId}/shadow
 * Body: { desired: { ... }, shadowName: 'optional' }
 */
exports.handler = async (event) => {
  console.log('Update Device Shadow Event:', JSON.stringify(event, null, 2));

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

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { desired, shadowName } = body;

    if (!desired) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing desired state in request body' })
      };
    }

    // Update shadow
    const shadowUpdate = {
      state: {
        desired
      }
    };

    const command = new UpdateThingShadowCommand({
      thingName,
      shadowName, // undefined for classic shadow
      payload: JSON.stringify(shadowUpdate)
    });

    const shadowResult = await iotDataClient.send(command);
    const shadowData = JSON.parse(new TextDecoder().decode(shadowResult.payload));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Shadow updated successfully',
        shadow: shadowData
      })
    };

  } catch (error) {
    console.error('Error updating device shadow:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to update device shadow',
        message: error.message
      })
    };
  }
};
