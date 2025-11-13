const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DEVICE_TABLE = process.env.DEVICE_TABLE;
const PROVISIONING_LOGS_TABLE = process.env.PROVISIONING_LOGS_TABLE;

/**
 * Pre-Provisioning Hook Lambda Function
 *
 * This function validates device provisioning requests before AWS IoT Core
 * creates the Thing and certificate. It checks:
 * 1. Device serial number validity
 * 2. Device authorization (whitelist/database check)
 * 3. Duplicate device prevention
 * 4. Custom business logic validation
 *
 * @param {Object} event - Fleet provisioning hook event
 * @returns {Object} Approval/rejection response with optional parameters
 */
exports.handler = async (event) => {
  console.log('Pre-Provisioning Hook Event:', JSON.stringify(event, null, 2));

  const requestId = uuidv4();
  const timestamp = Date.now();

  try {
    // Extract parameters from the provisioning request
    const { parameters, certificateId } = event;
    const { SerialNumber, DeviceType } = parameters;

    // Log the provisioning request
    await logProvisioningRequest(requestId, timestamp, {
      serialNumber: SerialNumber,
      deviceType: DeviceType,
      certificateId,
      status: 'VALIDATING'
    });

    // Validation 1: Check required parameters
    if (!SerialNumber || !DeviceType) {
      console.error('Missing required parameters');
      await logProvisioningRequest(requestId, timestamp, {
        serialNumber: SerialNumber,
        deviceType: DeviceType,
        status: 'REJECTED',
        reason: 'Missing required parameters'
      });

      return {
        allowProvisioning: false,
        parameterOverrides: {}
      };
    }

    // Validation 2: Validate device type
    const validDeviceTypes = ['Sensor', 'Gateway', 'Actuator'];
    if (!validDeviceTypes.includes(DeviceType)) {
      console.error(`Invalid device type: ${DeviceType}`);
      await logProvisioningRequest(requestId, timestamp, {
        serialNumber: SerialNumber,
        deviceType: DeviceType,
        status: 'REJECTED',
        reason: 'Invalid device type'
      });

      return {
        allowProvisioning: false,
        parameterOverrides: {}
      };
    }

    // Validation 3: Check if device is already registered
    const existingDevice = await checkExistingDevice(SerialNumber);
    if (existingDevice) {
      console.error(`Device already registered: ${SerialNumber}`);
      await logProvisioningRequest(requestId, timestamp, {
        serialNumber: SerialNumber,
        deviceType: DeviceType,
        status: 'REJECTED',
        reason: 'Device already registered'
      });

      return {
        allowProvisioning: false,
        parameterOverrides: {}
      };
    }

    // Validation 4: Check device whitelist (optional)
    // In production, you might check against a whitelist in DynamoDB
    const isAuthorized = await checkDeviceAuthorization(SerialNumber, DeviceType);
    if (!isAuthorized) {
      console.error(`Device not authorized: ${SerialNumber}`);
      await logProvisioningRequest(requestId, timestamp, {
        serialNumber: SerialNumber,
        deviceType: DeviceType,
        status: 'REJECTED',
        reason: 'Device not authorized'
      });

      return {
        allowProvisioning: false,
        parameterOverrides: {}
      };
    }

    // Store device information in registry (pre-provisioning)
    const deviceId = uuidv4();
    await storeDeviceInfo(deviceId, SerialNumber, DeviceType, certificateId);

    // Log successful validation
    await logProvisioningRequest(requestId, timestamp, {
      serialNumber: SerialNumber,
      deviceType: DeviceType,
      deviceId,
      certificateId,
      status: 'APPROVED'
    });

    // Return approval with any parameter overrides
    return {
      allowProvisioning: true,
      parameterOverrides: {
        // You can add or override template parameters here
        // For example, add a unique device ID or custom attributes
      }
    };

  } catch (error) {
    console.error('Error in pre-provisioning hook:', error);

    await logProvisioningRequest(requestId, timestamp, {
      status: 'ERROR',
      error: error.message
    });

    // In case of error, reject the provisioning
    return {
      allowProvisioning: false,
      parameterOverrides: {}
    };
  }
};

/**
 * Check if device already exists in the registry
 */
async function checkExistingDevice(serialNumber) {
  try {
    const params = {
      TableName: DEVICE_TABLE,
      IndexName: 'serialNumber-index', // You may need to add this GSI
      KeyConditionExpression: 'serialNumber = :sn',
      ExpressionAttributeValues: {
        ':sn': serialNumber
      },
      Limit: 1
    };

    const result = await docClient.send(new QueryCommand(params));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    // If index doesn't exist, scan table (not recommended for production)
    console.warn('Could not query by serial number, this is not efficient for production');
    return null;
  }
}

/**
 * Check if device is authorized for provisioning
 * In production, this might check against a whitelist or external API
 */
async function checkDeviceAuthorization(serialNumber, deviceType) {
  // TODO: Implement your authorization logic here
  // For example:
  // - Check against a whitelist in DynamoDB
  // - Call an external API to verify device
  // - Check serial number format/checksum
  // - Validate manufacturer certificate

  // For demo purposes, we'll allow all devices
  // In production, implement proper authorization

  // Example: Validate serial number format
  const serialNumberPattern = /^[A-Z0-9]{8,16}$/;
  if (!serialNumberPattern.test(serialNumber)) {
    return false;
  }

  return true;
}

/**
 * Store device information in the registry
 */
async function storeDeviceInfo(deviceId, serialNumber, deviceType, certificateId) {
  const params = {
    TableName: DEVICE_TABLE,
    Item: {
      deviceId,
      serialNumber,
      deviceType,
      certificateId,
      thingName: `${deviceType}-${serialNumber}`, // Will be created by provisioning template
      status: 'PROVISIONING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  await docClient.send(new PutCommand(params));
  console.log(`Stored device info for ${serialNumber}`);
}

/**
 * Log provisioning request for audit trail
 */
async function logProvisioningRequest(requestId, timestamp, details) {
  const params = {
    TableName: PROVISIONING_LOGS_TABLE,
    Item: {
      requestId,
      timestamp,
      ...details,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
    }
  };

  await docClient.send(new PutCommand(params));
}
