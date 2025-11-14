const { IoTClient, ListThingTypesCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Lists all IoT Thing Types
 * GET /thing-types
 *
 * Query parameters:
 * - maxResults: Maximum number of results (1-250, default: 50)
 * - nextToken: Pagination token
 * - thingTypeName: Filter by thing type name (partial match)
 */
exports.handler = async (event) => {
  console.log('List Thing Types:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const maxResults = parseInt(queryParams.maxResults || '50');
    const nextToken = queryParams.nextToken;
    const thingTypeName = queryParams.thingTypeName;

    // Validate maxResults
    if (maxResults < 1 || maxResults > 250) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'maxResults must be between 1 and 250',
        }),
      };
    }

    const command = new ListThingTypesCommand({
      maxResults,
      nextToken,
      thingTypeName,
    });

    const result = await iot.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        thingTypes: result.thingTypes || [],
        count: (result.thingTypes || []).length,
        nextToken: result.nextToken,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error listing thing types:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to list thing types',
        message: error.message,
      }),
    };
  }
};
