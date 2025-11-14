import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE!;
const SHADOW_HISTORY_TABLE = process.env.SHADOW_HISTORY_TABLE!;

/**
 * Get Shadow History API Handler
 *
 * GET /devices/{deviceId}/shadow/history?limit=20&startTime=xxx&endTime=xxx
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get Shadow History Event:', JSON.stringify(event, null, 2));

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

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit || '20', 10);
    const startTime = queryParams.startTime ? parseInt(queryParams.startTime, 10) : null;
    const endTime = queryParams.endTime ? parseInt(queryParams.endTime, 10) : null;

    // Query shadow history
    const historyParams: QueryCommandInput = {
      TableName: SHADOW_HISTORY_TABLE,
      KeyConditionExpression: 'thingName = :tn',
      ExpressionAttributeValues: {
        ':tn': thingName
      },
      ScanIndexForward: false, // Sort descending (newest first)
      Limit: limit
    };

    // Add time range filter if provided
    if (startTime && endTime) {
      historyParams.KeyConditionExpression += ' AND #timestamp BETWEEN :start AND :end';
      historyParams.ExpressionAttributeNames = {
        '#timestamp': 'timestamp'
      };
      historyParams.ExpressionAttributeValues![':start'] = startTime;
      historyParams.ExpressionAttributeValues![':end'] = endTime;
    } else if (startTime) {
      historyParams.KeyConditionExpression += ' AND #timestamp >= :start';
      historyParams.ExpressionAttributeNames = {
        '#timestamp': 'timestamp'
      };
      historyParams.ExpressionAttributeValues![':start'] = startTime;
    }

    const historyResult = await docClient.send(new QueryCommand(historyParams));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device: {
          deviceId: device.deviceId,
          thingName: device.thingName,
          deviceType: device.deviceType
        },
        history: historyResult.Items || [],
        count: historyResult.Items?.length || 0
      })
    };

  } catch (error) {
    console.error('Error getting shadow history:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to get shadow history',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
