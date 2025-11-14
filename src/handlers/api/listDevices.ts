import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE!;

/**
 * List Devices API Handler
 *
 * GET /devices?status=ACTIVE&limit=20&lastKey=xxx
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('List Devices Event:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const status = queryParams.status;
    const limit = parseInt(queryParams.limit || '20', 10);
    const lastKey = queryParams.lastKey ? JSON.parse(decodeURIComponent(queryParams.lastKey)) : null;

    let result;

    if (status) {
      // Query by status using GSI
      const params = {
        TableName: DEVICE_TABLE,
        IndexName: 'status-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status
        },
        Limit: limit,
        ExclusiveStartKey: lastKey
      };

      result = await docClient.send(new QueryCommand(params));
    } else {
      // Scan all devices
      const params = {
        TableName: DEVICE_TABLE,
        Limit: limit,
        ExclusiveStartKey: lastKey
      };

      result = await docClient.send(new ScanCommand(params));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        devices: result.Items || [],
        count: result.Items?.length || 0,
        lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null
      })
    };

  } catch (error) {
    console.error('Error listing devices:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to list devices',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
