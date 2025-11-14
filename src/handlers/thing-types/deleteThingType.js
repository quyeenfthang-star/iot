const { IoTClient, DeprecateThingTypeCommand, DeleteThingTypeCommand } = require('@aws-sdk/client-iot');

const iot = new IoTClient({});

/**
 * Deletes an IoT Thing Type
 * DELETE /thing-types/{thingTypeName}
 *
 * Note: Thing types must be deprecated before deletion.
 * This handler will deprecate and then delete the thing type.
 *
 * Query parameters:
 * - undoDeprecate: Set to 'true' to only deprecate without deleting
 */
exports.handler = async (event) => {
  console.log('Delete Thing Type:', JSON.stringify(event, null, 2));

  try {
    const thingTypeName = event.pathParameters?.thingTypeName;
    const queryParams = event.queryStringParameters || {};
    const undoDeprecate = queryParams.undoDeprecate === 'true';

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

    // Step 1: Deprecate the thing type first
    const deprecateCommand = new DeprecateThingTypeCommand({
      thingTypeName,
      undoDeprecate,
    });

    await iot.send(deprecateCommand);

    if (undoDeprecate) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Thing type deprecation status updated',
          thingTypeName,
          deprecated: false,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    console.log(`Thing type ${thingTypeName} deprecated`);

    // Step 2: Delete the thing type
    const deleteCommand = new DeleteThingTypeCommand({
      thingTypeName,
    });

    await iot.send(deleteCommand);

    console.log(`Thing type ${thingTypeName} deleted`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Thing type deleted successfully',
        thingTypeName,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error deleting thing type:', error);

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

    if (error.name === 'InvalidRequestException') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Cannot delete thing type',
          message: 'Thing type may still be associated with things. Remove all associations first.',
          details: error.message,
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
        error: 'Failed to delete thing type',
        message: error.message,
      }),
    };
  }
};
