const { IoTClient, DescribeThingGroupCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Gets details of a specific IoT Thing Group
 * GET /thing-groups/{thingGroupName}
 */
exports.handler = async (event) => {
  console.log('Get Thing Group:', JSON.stringify(event, null, 2));

  try {
    const thingGroupName = event.pathParameters?.thingGroupName;

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

    const command = new DescribeThingGroupCommand({
      thingGroupName,
    });

    const result = await iot.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        thingGroup: {
          thingGroupName: result.thingGroupName,
          thingGroupId: result.thingGroupId,
          thingGroupArn: result.thingGroupArn,
          thingGroupProperties: result.thingGroupProperties,
          thingGroupMetadata: result.thingGroupMetadata,
          version: result.version,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error getting thing group:', error);

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

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to get thing group',
        message: error.message,
      }),
    };
  }
};
