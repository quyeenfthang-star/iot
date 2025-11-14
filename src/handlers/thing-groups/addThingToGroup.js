const { IoTClient, AddThingToThingGroupCommand, RemoveThingFromThingGroupCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Adds or removes a thing from a thing group
 * PUT /thing-groups/{thingGroupName}/things/{thingName}
 * DELETE /thing-groups/{thingGroupName}/things/{thingName}
 *
 * Request body (for PUT):
 * {
 *   "overrideDynamicGroups": false  // Optional, default: false
 * }
 */
exports.handler = async (event) => {
  console.log('Manage Thing in Group:', JSON.stringify(event, null, 2));

  try {
    const thingGroupName = event.pathParameters?.thingGroupName;
    const thingName = event.pathParameters?.thingName;
    const method = event.httpMethod;

    if (!thingGroupName || !thingName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'thingGroupName and thingName are required',
        }),
      };
    }

    if (method === 'PUT') {
      // Add thing to group
      const body = event.body ? JSON.parse(event.body) : {};
      const overrideDynamicGroups = body.overrideDynamicGroups || false;

      const command = new AddThingToThingGroupCommand({
        thingGroupName,
        thingName,
        overrideDynamicGroups,
      });

      await iot.send(command);

      console.log(`Thing ${thingName} added to group ${thingGroupName}`);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Thing added to group successfully',
          thingName,
          thingGroupName,
          timestamp: new Date().toISOString(),
        }),
      };
    } else if (method === 'DELETE') {
      // Remove thing from group
      const command = new RemoveThingFromThingGroupCommand({
        thingGroupName,
        thingName,
      });

      await iot.send(command);

      console.log(`Thing ${thingName} removed from group ${thingGroupName}`);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Thing removed from group successfully',
          thingName,
          thingGroupName,
          timestamp: new Date().toISOString(),
        }),
      };
    } else {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Method not allowed',
          message: 'Only PUT and DELETE methods are supported',
        }),
      };
    }
  } catch (error) {
    console.error('Error managing thing in group:', error);

    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Thing or thing group not found',
          message: error.message,
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
          error: 'Invalid request',
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
        error: 'Failed to manage thing in group',
        message: error.message,
      }),
    };
  }
};
