/**
 * Greengrass Component Management Handler
 *
 * Manages Greengrass components:
 * - List available components
 * - Get component details and versions
 * - Create custom components
 * - Update component configurations
 *
 * API: GET /greengrass/components
 * API: GET /greengrass/components/{componentName}
 * API: POST /greengrass/components
 */

const {
  GreengrassV2Client,
  ListComponentsCommand,
  DescribeComponentCommand,
  ListComponentVersionsCommand,
  CreateComponentVersionCommand,
} = require('@aws-sdk/client-greengrassv2');

const greengrassClient = new GreengrassV2Client({});

/**
 * List all components
 */
async function listComponents(filters = {}) {
  const params = {
    scope: filters.scope || 'PRIVATE', // PRIVATE or PUBLIC
    maxResults: filters.maxResults || 50,
    nextToken: filters.nextToken,
  };

  const command = new ListComponentsCommand(params);
  const result = await greengrassClient.send(command);

  return {
    components: result.components || [],
    nextToken: result.nextToken,
  };
}

/**
 * Get component details
 */
async function getComponentDetails(componentName) {
  // Get component metadata
  const describeCommand = new DescribeComponentCommand({
    componentName,
  });
  const componentDetails = await greengrassClient.send(describeCommand);

  // List all versions
  const versionsCommand = new ListComponentVersionsCommand({
    componentName,
  });
  const versionsResult = await greengrassClient.send(versionsCommand);

  return {
    component: componentDetails,
    versions: versionsResult.componentVersions || [],
  };
}

/**
 * Create custom component
 */
async function createComponent(componentConfig) {
  const params = {
    inlineRecipe: Buffer.from(JSON.stringify(componentConfig.recipe)),
    tags: componentConfig.tags || {},
  };

  // If Lambda function provided, include it
  if (componentConfig.lambdaFunction) {
    params.lambdaFunction = {
      lambdaArn: componentConfig.lambdaFunction.lambdaArn,
      componentName: componentConfig.recipe.ComponentName,
      componentVersion: componentConfig.recipe.ComponentVersion,
      componentPlatforms: componentConfig.recipe.ComponentPlatforms,
    };
  }

  const command = new CreateComponentVersionCommand(params);
  const result = await greengrassClient.send(command);

  return result;
}

/**
 * Validate component recipe
 */
function validateComponentRecipe(recipe) {
  const errors = [];

  if (!recipe.RecipeFormatVersion) {
    errors.push('RecipeFormatVersion is required');
  }

  if (!recipe.ComponentName) {
    errors.push('ComponentName is required');
  }

  if (!recipe.ComponentVersion) {
    errors.push('ComponentVersion is required');
  }

  if (!recipe.ComponentDescription) {
    errors.push('ComponentDescription is required');
  }

  return errors;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Component Management Request:', JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    const pathParams = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};

    // GET /greengrass/components - List components
    if (httpMethod === 'GET' && !pathParams.componentName) {
      const filters = {
        scope: queryParams.scope,
        maxResults: parseInt(queryParams.maxResults) || 50,
        nextToken: queryParams.nextToken,
      };

      const result = await listComponents(filters);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(result),
      };
    }

    // GET /greengrass/components/{componentName} - Get component details
    if (httpMethod === 'GET' && pathParams.componentName) {
      const componentName = pathParams.componentName;
      const result = await getComponentDetails(componentName);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(result),
      };
    }

    // POST /greengrass/components - Create component
    if (httpMethod === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

      // Validate component recipe
      const validationErrors = validateComponentRecipe(body.recipe);
      if (validationErrors.length > 0) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid component recipe',
            validationErrors,
          }),
        };
      }

      const result = await createComponent(body);

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Component created successfully',
          componentArn: result.arn,
          componentName: result.componentName,
          componentVersion: result.componentVersion,
          status: result.status,
        }),
      };
    }

    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Method not allowed',
      }),
    };
  } catch (error) {
    console.error('Error managing components:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to manage components',
        message: error.message,
      }),
    };
  }
};
