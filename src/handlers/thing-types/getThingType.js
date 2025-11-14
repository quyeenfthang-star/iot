const { IoTClient, DescribeThingTypeCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Gets details of a specific IoT Thing Type
 * GET /thing-types/{thingTypeName}
 */
exports.handler = async (event) => {
  console.log('Get Thing Type:', JSON.stringify(event, null, 2));

  try {
    const thingTypeName = event.pathParameters?.thingTypeName;

    if (!thingTypeName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'thingTypeName is required' }),
      };
    }

    const command = new DescribeThingTypeCommand({
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
        thingType: {
          thingTypeName: result.thingTypeName,
          thingTypeId: result.thingTypeId,
          thingTypeArn: result.thingTypeArn,
          thingTypeProperties: result.thingTypeProperties,
          thingTypeMetadata: result.thingTypeMetadata,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error getting thing type:', error);

    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Thing type not found',
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
        error: 'Failed to get thing type',
        message: error.message,
      }),
    };
  }
};
