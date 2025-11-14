const { IoTClient, DeleteThingGroupCommand, ListThingsInThingGroupCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Deletes an IoT Thing Group
 * DELETE /thing-groups/{thingGroupName}
 *
 * Query parameters:
 * - force: Set to 'true' to delete even if things are still in the group (dangerous!)
 * - expectedVersion: Expected version for optimistic locking
 */
exports.handler = async (event) => {
  console.log('Delete Thing Group:', JSON.stringify(event, null, 2));

  try {
    const thingGroupName = event.pathParameters?.thingGroupName;
    const queryParams = event.queryStringParameters || {};
    const force = queryParams.force === 'true';
    const expectedVersion = queryParams.expectedVersion ? parseInt(queryParams.expectedVersion) : undefined;

    if (!thingGroupName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'thingGroupName is required' }),
      };
    }

    // Check if thing group has things if not forcing
    if (!force) {
      const listCommand = new ListThingsInThingGroupCommand({
        thingGroupName,
        maxResults: 1,
      });

      try {
        const listResult = await iot.send(listCommand);
        if (listResult.things && listResult.things.length > 0) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              error: 'Cannot delete thing group with associated things',
              message: 'Remove all things from the group first or use force=true',
              thingCount: listResult.things.length,
            }),
          };
        }
      } catch (error) {
        // If thing group doesn't exist, continue with deletion attempt
        if (error.name !== 'ResourceNotFoundException') {
          throw error;
        }
      }
    }

    // Delete the thing group
    const deleteCommand = new DeleteThingGroupCommand({
      thingGroupName,
      expectedVersion,
    });

    await iot.send(deleteCommand);

    console.log(`Thing group ${thingGroupName} deleted`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Thing group deleted successfully',
        thingGroupName,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error deleting thing group:', error);

    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Thing group not found',
          message: error.message,
        }),
      };
    }

    if (error.name === 'VersionConflictException') {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Version conflict',
          message: 'Thing group was modified by another process',
          details: error.message,
        }),
      };
    }

    if (error.name === 'InvalidRequestException') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Cannot delete thing group',
          message: error.message,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to delete thing group',
        message: error.message,
      }),
    };
  }
};
