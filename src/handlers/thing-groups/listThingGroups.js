const { IoTClient, ListThingGroupsCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Lists all IoT Thing Groups
 * GET /thing-groups
 *
 * Query parameters:
 * - maxResults: Maximum number of results (1-250, default: 50)
 * - nextToken: Pagination token
 * - parentGroup: Filter by parent group name
 * - namePrefixFilter: Filter by name prefix
 */
exports.handler = async (event) => {
  console.log('List Thing Groups:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const maxResults = parseInt(queryParams.maxResults || '50');
    const nextToken = queryParams.nextToken;
    const parentGroup = queryParams.parentGroup;
    const namePrefixFilter = queryParams.namePrefixFilter;

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

    const command = new ListThingGroupsCommand({
      maxResults,
      nextToken,
      parentGroup,
      namePrefixFilter,
    });

    const result = await iot.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        thingGroups: result.thingGroups || [],
        count: (result.thingGroups || []).length,
        nextToken: result.nextToken,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error listing thing groups:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to list thing groups',
        message: error.message,
      }),
    };
  }
};
