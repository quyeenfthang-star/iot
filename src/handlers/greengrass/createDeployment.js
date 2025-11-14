/**
 * Greengrass Deployment Creation Handler
 *
 * Creates a new AWS IoT Greengrass V2 deployment:
 * - Targets thing groups or individual core devices
 * - Specifies components and versions
 * - Configures component parameters
 * - Sets deployment policies (rollout, failure handling)
 *
 * API: POST /greengrass/deployments
 */

const { GreengrassV2Client, CreateDeploymentCommand } = require('@aws-sdk/client-greengrassv2');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const greengrassClient = new GreengrassV2Client({});
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE;

/**
 * Validate deployment configuration
 */
function validateDeploymentConfig(config) {
  const errors = [];

  if (!config.targetArn) {
    errors.push('targetArn is required (Thing Group ARN or Core Device ARN)');
  }

  if (!config.components || Object.keys(config.components).length === 0) {
    errors.push('At least one component must be specified');
  }

  if (config.deploymentPolicies) {
    const { componentUpdatePolicy } = config.deploymentPolicies;
    if (componentUpdatePolicy) {
      const validActions = ['NOTIFY_COMPONENTS', 'SKIP_NOTIFY_COMPONENTS'];
      if (componentUpdatePolicy.action && !validActions.includes(componentUpdatePolicy.action)) {
        errors.push(`Invalid component update policy action: ${componentUpdatePolicy.action}`);
      }
    }
  }

  return errors;
}

/**
 * Create Greengrass deployment
 */
async function createDeployment(deploymentConfig) {
  // Prepare components configuration
  const components = {};

  for (const [componentName, config] of Object.entries(deploymentConfig.components)) {
    components[componentName] = {
      componentVersion: config.version,
      configurationUpdate: config.configuration ? {
        merge: JSON.stringify(config.configuration),
      } : undefined,
      runWith: config.runWith,
    };
  }

  // Prepare deployment configuration
  const params = {
    targetArn: deploymentConfig.targetArn,
    deploymentName: deploymentConfig.deploymentName || `deployment-${Date.now()}`,
    components,
    deploymentPolicies: deploymentConfig.deploymentPolicies || {
      componentUpdatePolicy: {
        action: 'NOTIFY_COMPONENTS',
        timeoutInSeconds: 60,
      },
      configurationValidationPolicy: {
        timeoutInSeconds: 60,
      },
      failureHandlingPolicy: 'ROLLBACK',
    },
    iotJobConfiguration: deploymentConfig.iotJobConfiguration || {
      jobExecutionsRolloutConfig: {
        exponentialRate: {
          baseRatePerMinute: 10,
          incrementFactor: 2,
          rateIncreaseCriteria: {
            numberOfNotifiedThings: 1,
            numberOfSucceededThings: 1,
          },
        },
      },
      abortConfig: {
        criteriaList: [
          {
            action: 'CANCEL',
            failureType: 'FAILED',
            minNumberOfExecutedThings: 1,
            thresholdPercentage: 50,
          },
        ],
      },
      timeoutConfig: {
        inProgressTimeoutInMinutes: 60,
      },
    },
    tags: deploymentConfig.tags || {},
  };

  // Create deployment in Greengrass
  const command = new CreateDeploymentCommand(params);
  const result = await greengrassClient.send(command);

  return result;
}

/**
 * Store deployment record in DynamoDB
 */
async function storeDeploymentRecord(deploymentId, deploymentConfig, greengrassResult) {
  const record = {
    deploymentId,
    iotJobId: greengrassResult.iotJobId,
    iotJobArn: greengrassResult.iotJobArn,
    targetArn: deploymentConfig.targetArn,
    deploymentName: deploymentConfig.deploymentName,
    components: deploymentConfig.components,
    status: 'ACTIVE',
    createdAt: Date.now(),
    createdBy: deploymentConfig.createdBy || 'system',
    tags: deploymentConfig.tags || {},
  };

  await docClient.send(new PutCommand({
    TableName: DEPLOYMENTS_TABLE,
    Item: record,
  }));

  return record;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Create Deployment Request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Validate deployment configuration
    const validationErrors = validateDeploymentConfig(body);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid deployment configuration',
          validationErrors,
        }),
      };
    }

    // Create deployment
    const greengrassResult = await createDeployment(body);
    const deploymentId = greengrassResult.deploymentId;

    // Store deployment record
    const record = await storeDeploymentRecord(deploymentId, body, greengrassResult);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Deployment created successfully',
        deploymentId,
        iotJobId: greengrassResult.iotJobId,
        iotJobArn: greengrassResult.iotJobArn,
        record,
      }),
    };
  } catch (error) {
    console.error('Error creating deployment:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to create deployment',
        message: error.message,
      }),
    };
  }
};
