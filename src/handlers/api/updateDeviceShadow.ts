import { IoTDataPlaneClient, UpdateThingShadowCommand } from '@aws-sdk/client-iot-data-plane';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const iotDataClient = new IoTDataPlaneClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE!;

interface UpdateShadowBody {
  desired: Record<string, any>;
  shadowName?: string;
}

/**
 * Update Device Shadow API Handler
 *
 * PUT /devices/{deviceId}/shadow
 * Body: { desired: { ... }, shadowName: 'optional' }
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
    const thingName = device.thingName as string;

    // Parse request body
    const body: UpdateShadowBody = JSON.parse(event.body || '{}');
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
      payload: new TextEncoder().encode(JSON.stringify(shadowUpdate))
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
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
