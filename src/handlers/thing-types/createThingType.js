const { IoTClient, CreateThingTypeCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Creates a new IoT Thing Type dynamically
 * POST /thing-types
 *
 * Request body:
 * {
 *   "thingTypeName": "CustomSensor",
 *   "thingTypeDescription": "Custom sensor type for specific use case",
 *   "searchableAttributes": ["model", "location", "version"],
 *   "tags": {
 *     "Environment": "Production",
 *     "Department": "Engineering"
 *   }
 * }
 */
exports.handler = async (event) => {
  console.log('Create Thing Type:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.thingTypeName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'thingTypeName is required' }),
      };
    }

    // Validate thing type name format
    const thingTypeNameRegex = /^[a-zA-Z0-9:_-]+$/;
    if (!thingTypeNameRegex.test(body.thingTypeName)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid thingTypeName format. Only alphanumeric characters, colons, underscores, and hyphens are allowed',
        }),
      };
    }

    // Prepare thing type properties
    const thingTypeProperties = {
      thingTypeDescription: body.thingTypeDescription || `Thing type: ${body.thingTypeName}`,
    };

    // Add searchable attributes if provided
    if (body.searchableAttributes && Array.isArray(body.searchableAttributes)) {
      thingTypeProperties.searchableAttributes = body.searchableAttributes;
    }

    // Create thing type command
    const command = new CreateThingTypeCommand({
      thingTypeName: body.thingTypeName,
      thingTypeProperties,
      tags: body.tags ? Object.entries(body.tags).map(([Key, Value]) => ({ Key, Value })) : undefined,
    });

    const result = await iot.send(command);

    console.log(`Thing type created: ${body.thingTypeName}`);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Thing type created successfully',
        thingType: {
          thingTypeName: result.thingTypeName,
          thingTypeArn: result.thingTypeArn,
          thingTypeId: result.thingTypeId,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error creating thing type:', error);

    // Handle specific AWS errors
    if (error.name === 'ResourceAlreadyExistsException') {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Thing type already exists',
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
        error: 'Failed to create thing type',
        message: error.message,
      }),
    };
  }
};
