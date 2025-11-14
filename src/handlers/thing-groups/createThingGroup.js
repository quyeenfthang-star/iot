const { IoTClient, CreateThingGroupCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Creates a new IoT Thing Group dynamically
 * POST /thing-groups
 *
 * Request body:
 * {
 *   "thingGroupName": "production-sensors",
 *   "parentGroupName": "production",  // Optional
 *   "thingGroupDescription": "Production environment sensors",
 *   "attributePayload": {
 *     "attributes": {
 *       "environment": "production",
 *       "region": "us-east-1"
 *     }
 *   },
 *   "tags": {
 *     "Department": "Engineering",
 *     "CostCenter": "12345"
 *   }
 * }
 */
exports.handler = async (event) => {
  console.log('Create Thing Group:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.thingGroupName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'thingGroupName is required' }),
      };
    }

    // Validate thing group name format
    const thingGroupNameRegex = /^[a-zA-Z0-9:_-]+$/;
    if (!thingGroupNameRegex.test(body.thingGroupName)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid thingGroupName format. Only alphanumeric characters, colons, underscores, and hyphens are allowed',
        }),
      };
    }

    // Prepare thing group properties
    const thingGroupProperties = {
      thingGroupDescription: body.thingGroupDescription || `Thing group: ${body.thingGroupName}`,
    };

    // Add attribute payload if provided
    if (body.attributePayload) {
      thingGroupProperties.attributePayload = body.attributePayload;
    }

    // Create thing group command
    const command = new CreateThingGroupCommand({
      thingGroupName: body.thingGroupName,
      parentGroupName: body.parentGroupName,
      thingGroupProperties,
      tags: body.tags ? Object.entries(body.tags).map(([Key, Value]) => ({ Key, Value })) : undefined,
    });

    const result = await iot.send(command);

    console.log(`Thing group created: ${body.thingGroupName}`);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Thing group created successfully',
        thingGroup: {
          thingGroupName: result.thingGroupName,
          thingGroupArn: result.thingGroupArn,
          thingGroupId: result.thingGroupId,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error creating thing group:', error);

    // Handle specific AWS errors
    if (error.name === 'ResourceAlreadyExistsException') {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Thing group already exists',
          message: error.message,
        }),
      };
    }

    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Parent thing group not found',
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
        error: 'Failed to create thing group',
        message: error.message,
      }),
    };
  }
};
