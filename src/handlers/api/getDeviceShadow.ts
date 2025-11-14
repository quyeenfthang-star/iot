import { IoTDataPlaneClient, GetThingShadowCommand } from '@aws-sdk/client-iot-data-plane';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const iotDataClient = new IoTDataPlaneClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE!;

/**
 * Get Device Shadow API Handler
 *
 * GET /devices/{deviceId}/shadow?shadowName=optional
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
    const thingName = device.thingName as string;

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
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
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
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
