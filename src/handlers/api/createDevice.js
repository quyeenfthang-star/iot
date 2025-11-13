const { IoTClient, CreateThingCommand, CreateKeysAndCertificateCommand, AttachThingPrincipalCommand, AttachPolicyCommand } = require('@aws-sdk/client-iot');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const iotClient = new IoTClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE;
const DEVICE_POLICY_NAME = process.env.DEVICE_POLICY_NAME || 'iot-shadow-management-device-policy-dev';

/**
 * Create Device API Handler
 *
 * Creates a new IoT device manually (without Fleet Provisioning)
 * This is useful for:
 * - Admin console device creation
 * - Bulk device pre-registration
 * - Testing and development
 *
 * POST /devices
 * Body: { serialNumber, deviceType, attributes }
 */
exports.handler = async (event) => {
  console.log('Create Device Event:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { serialNumber, deviceType, attributes = {} } = body;

    // Validate required parameters
    if (!serialNumber || !deviceType) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required parameters: serialNumber, deviceType'
        })
      };
    }

    // Validate device type
    const validDeviceTypes = ['Sensor', 'Gateway', 'Actuator'];
    if (!validDeviceTypes.includes(deviceType)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Invalid deviceType. Must be one of: ${validDeviceTypes.join(', ')}`
        })
      };
    }

    // Generate unique IDs
    const deviceId = uuidv4();
    const thingName = `${deviceType}-${serialNumber}`;

    // Create IoT Thing
    const thingResult = await createThing(thingName, deviceType, {
      serialNumber,
      ...attributes
    });

    // Create certificate and keys
    const certResult = await createCertificate();

    // Attach certificate to thing
    await attachCertificateToThing(certResult.certificateArn, thingName);

    // Attach policy to certificate
    await attachPolicyToCertificate(certResult.certificateArn);

    // Store device in DynamoDB
    await storeDevice(deviceId, {
      serialNumber,
      deviceType,
      thingName,
      thingArn: thingResult.thingArn,
      certificateArn: certResult.certificateArn,
      certificateId: certResult.certificateId,
      attributes,
      status: 'ACTIVE'
    });

    // Return response with device details and certificate
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Device created successfully',
        device: {
          deviceId,
          thingName,
          serialNumber,
          deviceType,
          status: 'ACTIVE'
        },
        certificate: {
          certificateArn: certResult.certificateArn,
          certificateId: certResult.certificateId,
          certificatePem: certResult.certificatePem,
          keyPair: {
            publicKey: certResult.keyPair.PublicKey,
            privateKey: certResult.keyPair.PrivateKey
          }
        },
        iotEndpoint: process.env.IOT_ENDPOINT
      })
    };

  } catch (error) {
    console.error('Error creating device:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to create device',
        message: error.message
      })
    };
  }
};

/**
 * Create IoT Thing
 */
async function createThing(thingName, deviceType, attributes) {
  const command = new CreateThingCommand({
    thingName,
    thingTypeName: deviceType,
    attributePayload: {
      attributes
    }
  });

  const result = await iotClient.send(command);
  console.log(`Created thing: ${thingName}`);

  return result;
}

/**
 * Create certificate and key pair
 */
async function createCertificate() {
  const command = new CreateKeysAndCertificateCommand({
    setAsActive: true
  });

  const result = await iotClient.send(command);
  console.log('Created certificate:', result.certificateId);

  return result;
}

/**
 * Attach certificate to thing
 */
async function attachCertificateToThing(certificateArn, thingName) {
  const command = new AttachThingPrincipalCommand({
    thingName,
    principal: certificateArn
  });

  await iotClient.send(command);
  console.log(`Attached certificate to thing: ${thingName}`);
}

/**
 * Attach policy to certificate
 */
async function attachPolicyToCertificate(certificateArn) {
  const command = new AttachPolicyCommand({
    policyName: DEVICE_POLICY_NAME,
    target: certificateArn
  });

  await iotClient.send(command);
  console.log(`Attached policy to certificate`);
}

/**
 * Store device in DynamoDB
 */
async function storeDevice(deviceId, deviceData) {
  const params = {
    TableName: DEVICE_TABLE,
    Item: {
      deviceId,
      ...deviceData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  await docClient.send(new PutCommand(params));
  console.log(`Stored device: ${deviceId}`);
}
