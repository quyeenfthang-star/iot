# Serverless Configuration Structure

This directory contains modularized Serverless Framework configuration files for better organization and maintainability.

## Directory Structure

```
serverless/
├── README.md                    # This file
├── custom.yml                   # Custom variables (table names, provisioning config)
├── provider.yml                 # Provider configuration (AWS settings, IAM roles)
├── functions.yml                # All Lambda function definitions (27 functions)
└── resources/
    ├── dynamodb.yml             # DynamoDB table definitions (5 tables)
    ├── sns.yml                  # SNS topic definitions
    ├── iot.yml                  # IoT resources (policies, templates, thing types/groups)
    └── outputs.yml              # CloudFormation stack outputs
```

## File Descriptions

### `custom.yml`
Contains all custom variables used throughout the configuration:
- DynamoDB table names
- Fleet provisioning template and role names
- IoT policy names

### `provider.yml`
Provider configuration including:
- AWS runtime and region settings
- Environment variables for all functions
- IAM role statements with permissions for:
  - DynamoDB (Query, Scan, GetItem, PutItem, UpdateItem, DeleteItem)
  - IoT Core (Thing/Group/Type management, Shadow operations)
  - CloudWatch Logs
  - SNS (Publish)
  - Greengrass (Deployment management)

### `functions.yml`
All 27 Lambda function definitions organized by category:
- **Provisioning** (2): preProvisioningHook, postProvisioningHook
- **Shadow Management** (2): shadowUpdateHandler, shadowDeltaHandler
- **Device API** (6): createDevice, getDevice, listDevices, updateDeviceShadow, getDeviceShadow, getShadowHistory
- **Analytics** (3): fleetAnalyticsAggregator, getFleetAnalytics, getDeviceMetrics
- **Alerts** (1): deviceAlertHandler
- **Greengrass** (4): createGreengrassDeployment, getGreengrassDeployment, listGreengrassDeployments, cancelGreengrassDeployment
- **Thing Types** (4): createThingType, listThingTypes, getThingType, deleteThingType
- **Thing Groups** (5): createThingGroup, listThingGroups, getThingGroup, deleteThingGroup, addThingToGroup

### `resources/dynamodb.yml`
DynamoDB table definitions:
- **DeviceRegistryTable**: Device registry with GSI for thingName and status
- **ShadowHistoryTable**: Shadow update history with TTL
- **ProvisioningLogsTable**: Provisioning audit logs with GSI for deviceId
- **FleetAnalyticsTable**: Aggregated fleet metrics with GSI for metricType
- **GreengrassDeploymentsTable**: Deployment tracking with GSI for status

### `resources/sns.yml`
SNS resources:
- **DeviceAlertTopic**: Topic for device alerts and notifications

### `resources/iot.yml`
IoT Core resources:
- **ProvisioningRole**: IAM role for fleet provisioning
- **ClaimCertificatePolicy**: Policy for claim certificates (pre-provisioning)
- **DevicePolicy**: Policy for provisioned devices
- **ProvisioningTemplate**: Fleet provisioning template
- **Thing Types**: Default types (Sensor, Gateway, Actuator)
- **Thing Groups**: Default groups (production)
- **IotEndpoint**: Custom resource to retrieve IoT endpoint
- **GetIotEndpointFunction**: Lambda for endpoint retrieval

### `resources/outputs.yml`
CloudFormation stack outputs:
- Table names (Device, ShadowHistory, FleetAnalytics, GreengrassDeployments)
- Provisioning template name
- Policy names (Claim, Device)
- IoT endpoint
- API Gateway endpoint
- SNS topic ARN

## Usage

The main `serverless.yml` file in the project root imports all these files:

```yaml
service: iot-shadow-management
frameworkVersion: '3'

provider: ${file(serverless/provider.yml)}
custom: ${file(serverless/custom.yml)}
functions: ${file(serverless/functions.yml)}

resources:
  Resources:
    ${file(serverless/resources/dynamodb.yml)}
    ${file(serverless/resources/sns.yml)}
    ${file(serverless/resources/iot.yml)}
  Outputs: ${file(serverless/resources/outputs.yml)}
```

## Benefits

✅ **Modularity**: Each file focuses on a specific aspect of the infrastructure
✅ **Maintainability**: Easier to find and update specific resources
✅ **Readability**: Smaller files are easier to understand
✅ **Collaboration**: Teams can work on different files simultaneously
✅ **Reusability**: Resource files can be shared across projects
✅ **Version Control**: Easier to track changes in specific areas

## Deployment

Deploy as usual from the project root:

```bash
# Deploy to dev
serverless deploy --stage dev

# Deploy to prod
serverless deploy --stage prod

# Deploy specific function
serverless deploy function -f createDevice --stage dev
```

## Validation

Validate the configuration:

```bash
# Validate serverless configuration
serverless package --stage dev
```

## Backup

Original monolithic `serverless.yml` is backed up as `serverless.yml.backup` in case rollback is needed.
