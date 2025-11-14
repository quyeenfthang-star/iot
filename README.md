# AWS IoT Shadow Management with Fleet Provisioning

A complete serverless solution for managing IoT devices using AWS IoT Device Shadows and Fleet Provisioning.

## Overview

This project provides a production-ready infrastructure for:

- **Fleet Provisioning**: Automatically register and provision IoT devices
- **Shadow Management**: Synchronize device state between cloud and devices
- **Device Management**: REST API for device CRUD operations
- **Fleet Analytics**: Real-time metrics aggregation and fleet-wide reporting
- **Greengrass Deployment Manager**: Manage edge deployments and component updates
- **SNS Alert System**: Intelligent device monitoring with automated notifications
- **Telemetry & History**: Track device shadow updates over time
- **Security**: Certificate-based authentication and fine-grained policies

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture diagrams and component interactions.

See [COMPONENTS.md](./COMPONENTS.md) for a comprehensive list of required components.

## Project Structure

```
iot/
├── serverless.yml                  # Serverless Framework configuration
├── package.json                    # Node.js dependencies
├── src/
│   └── handlers/
│       ├── provisioning/
│       │   ├── preProvisioningHook.js    # Validates devices before provisioning
│       │   └── postProvisioningHook.js   # Post-provisioning actions
│       ├── shadow/
│       │   ├── shadowUpdateHandler.js    # Processes shadow updates
│       │   └── shadowDeltaHandler.js     # Processes shadow deltas
│       ├── analytics/
│       │   └── fleetAnalyticsAggregator.js  # Aggregates fleet metrics
│       ├── alerts/
│       │   └── deviceAlertHandler.js     # Processes alerts and sends SNS
│       ├── greengrass/
│       │   ├── createDeployment.js       # Create Greengrass deployments
│       │   ├── getDeployment.js          # Get deployment status
│       │   ├── listDeployments.js        # List deployments
│       │   └── cancelDeployment.js       # Cancel deployments
│       ├── thing-types/
│       │   ├── createThingType.js        # Create thing type dynamically
│       │   ├── listThingTypes.js         # List thing types
│       │   ├── getThingType.js           # Get thing type details
│       │   └── deleteThingType.js        # Delete thing type
│       ├── thing-groups/
│       │   ├── createThingGroup.js       # Create thing group dynamically
│       │   ├── listThingGroups.js        # List thing groups
│       │   ├── getThingGroup.js          # Get thing group details
│       │   ├── deleteThingGroup.js       # Delete thing group
│       │   └── addThingToGroup.js        # Manage thing group membership
│       └── api/
│           ├── createDevice.js           # Create device manually
│           ├── getDevice.js              # Get device details
│           ├── listDevices.js            # List all devices
│           ├── updateDeviceShadow.js     # Update device shadow
│           ├── getDeviceShadow.js        # Get device shadow
│           ├── getShadowHistory.js       # Get shadow history
│           ├── getFleetAnalytics.js      # Get fleet analytics
│           └── getDeviceMetrics.js       # Get device metrics
├── examples/
│   ├── device-client-python/       # Python device client example
│   └── device-client-nodejs/       # Node.js device client example
├── ARCHITECTURE.md                 # Architecture diagrams
├── COMPONENTS.md                   # Component documentation
└── README.md                       # This file
```

## Prerequisites

- **AWS Account** with appropriate permissions
- **AWS CLI** configured with credentials
- **Node.js** 18.x or later
- **Serverless Framework** 3.x or later
- **Python** 3.8+ (for device client examples)

## Installation

1. **Clone the repository**:

```bash
git clone <repository-url>
cd iot
```

2. **Install dependencies**:

```bash
npm install
```

3. **Install Serverless Framework** (if not already installed):

```bash
npm install -g serverless
```

## Deployment

### Deploy to AWS

Deploy to the development stage:

```bash
serverless deploy --stage dev --region us-east-1
```

Deploy to production:

```bash
serverless deploy --stage prod --region us-east-1
```

### Deployment Output

After deployment, you'll see outputs including:

- **DeviceTableName**: DynamoDB table for device registry
- **ShadowHistoryTableName**: DynamoDB table for shadow history
- **FleetAnalyticsTableName**: DynamoDB table for fleet analytics
- **GreengrassDeploymentsTableName**: DynamoDB table for Greengrass deployments
- **DeviceAlertTopicArn**: SNS topic ARN for device alerts
- **ProvisioningTemplateName**: Fleet provisioning template name
- **ClaimPolicyName**: Policy name for claim certificates
- **DevicePolicyName**: Policy name for device certificates
- **IoTEndpoint**: AWS IoT Core endpoint
- **ApiEndpoint**: API Gateway endpoint

Save these values - you'll need them for device provisioning and API calls.

## Post-Deployment Setup

### 1. Create Claim Certificate

Create a claim certificate for device provisioning:

```bash
# Create certificate
aws iot create-keys-and-certificate \
  --set-as-active \
  --certificate-pem-outfile claim-cert.pem \
  --public-key-outfile claim-public-key.pem \
  --private-key-outfile claim-private-key.pem \
  --region us-east-1

# Save the certificate ARN from the output
CERT_ARN="<certificate-arn-from-output>"

# Attach claim policy
aws iot attach-policy \
  --policy-name iot-shadow-management-claim-policy-dev \
  --target $CERT_ARN \
  --region us-east-1
```

### 2. Download Root CA Certificate

```bash
curl -o AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem
```

### 3. Get IoT Endpoint

```bash
aws iot describe-endpoint --endpoint-type iot:Data-ATS --region us-east-1
```

## Usage

### Device Provisioning

#### Python Device Client

```bash
cd examples/device-client-python

# Install dependencies
pip install -r requirements.txt

# Run device client
python device_client.py \
  --endpoint xxxxx.iot.us-east-1.amazonaws.com \
  --claim-cert ../../claim-cert.pem \
  --claim-key ../../claim-private-key.pem \
  --root-ca ../../AmazonRootCA1.pem \
  --template-name iot-shadow-management-template-dev \
  --serial-number ABC12345678 \
  --device-type Sensor
```

#### Node.js Device Client

```bash
cd examples/device-client-nodejs

# Install dependencies
npm install

# Run device client
node device-client.js \
  --endpoint xxxxx.iot.us-east-1.amazonaws.com \
  --claim-cert ../../claim-cert.pem \
  --claim-key ../../claim-private-key.pem \
  --root-ca ../../AmazonRootCA1.pem \
  --template-name iot-shadow-management-template-dev \
  --serial-number ABC12345678 \
  --device-type Sensor
```

### REST API Usage

#### Create Device (Manual)

```bash
curl -X POST https://<api-endpoint>/dev/devices \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "XYZ98765432",
    "deviceType": "Gateway",
    "attributes": {
      "model": "Gateway-Pro",
      "location": "Building A"
    }
  }'
```

#### List Devices

```bash
# List all devices
curl https://<api-endpoint>/dev/devices

# Filter by status
curl https://<api-endpoint>/dev/devices?status=ACTIVE

# Pagination
curl "https://<api-endpoint>/dev/devices?limit=10&lastKey=<encoded-key>"
```

#### Get Device

```bash
curl https://<api-endpoint>/dev/devices/<deviceId>
```

#### Update Device Shadow

```bash
curl -X PUT https://<api-endpoint>/dev/devices/<deviceId>/shadow \
  -H "Content-Type: application/json" \
  -d '{
    "desired": {
      "config": {
        "reportInterval": 120
      },
      "firmware": {
        "version": "2.0.0"
      }
    }
  }'
```

#### Get Device Shadow

```bash
# Get classic shadow
curl https://<api-endpoint>/dev/devices/<deviceId>/shadow

# Get named shadow
curl "https://<api-endpoint>/dev/devices/<deviceId>/shadow?shadowName=telemetry"
```

#### Get Shadow History

```bash
# Get recent history
curl https://<api-endpoint>/dev/devices/<deviceId>/shadow/history

# Get history with time range
curl "https://<api-endpoint>/dev/devices/<deviceId>/shadow/history?startTime=1234567890000&endTime=1234567900000&limit=50"
```

### Fleet Analytics API

#### Get Fleet Analytics

```bash
# Get all fleet metrics
curl https://<api-endpoint>/dev/analytics/fleet

# Filter by metric type
curl "https://<api-endpoint>/dev/analytics/fleet?metricType=device-count-by-type"

# Get metrics for date range
curl "https://<api-endpoint>/dev/analytics/fleet?startDate=2025-01-01&endDate=2025-01-31"
```

Example response:
```json
{
  "summary": {
    "totalDevices": 150,
    "devicesByStatus": {
      "ACTIVE": 120,
      "INACTIVE": 25,
      "PROVISIONING": 5
    },
    "byDeviceType": {
      "Sensor": 100,
      "Gateway": 30,
      "Actuator": 20
    }
  },
  "metrics": [...],
  "timestamp": "2025-11-14T10:00:00Z"
}
```

#### Get Device Metrics

```bash
# Get device metrics (default: last 24 hours)
curl https://<api-endpoint>/dev/analytics/devices/<deviceId>/metrics

# Specify time period (1h, 24h, 7d, 30d)
curl "https://<api-endpoint>/dev/analytics/devices/<deviceId>/metrics?period=7d"
```

Example response:
```json
{
  "deviceId": "abc-123",
  "thingName": "Sensor-TEST001",
  "period": "24h",
  "metrics": {
    "updateCount": 288,
    "averageUpdateInterval": 300000,
    "battery": {
      "current": 85,
      "average": 87.5,
      "min": 82,
      "max": 92
    },
    "temperature": {
      "current": 22.5,
      "average": 21.8,
      "min": 18.2,
      "max": 24.7
    },
    "errorCount": 2,
    "alertCount": 5
  }
}
```

### Greengrass Deployment API

#### Create Deployment

```bash
curl -X POST https://<api-endpoint>/dev/greengrass/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "targetArn": "arn:aws:iot:us-east-1:123456789012:thinggroup/MyDeviceGroup",
    "deploymentName": "Firmware Update v2.0",
    "components": {
      "com.example.MyComponent": {
        "componentVersion": "2.0.0",
        "configurationUpdate": {
          "merge": "{\"setting1\":\"value1\"}"
        }
      }
    },
    "deploymentPolicies": {
      "failureHandlingPolicy": "ROLLBACK",
      "componentUpdatePolicy": {
        "timeoutInSeconds": 300,
        "action": "NOTIFY_COMPONENTS"
      }
    }
  }'
```

#### Get Deployment

```bash
curl https://<api-endpoint>/dev/greengrass/deployments/<deploymentId>
```

#### List Deployments

```bash
# List all deployments
curl https://<api-endpoint>/dev/greengrass/deployments

# Filter by target
curl "https://<api-endpoint>/dev/greengrass/deployments?targetArn=arn:aws:iot:..."

# Filter by status
curl "https://<api-endpoint>/dev/greengrass/deployments?status=ACTIVE"

# Use local DynamoDB history
curl "https://<api-endpoint>/dev/greengrass/deployments?historyFilter=true"
```

#### Cancel Deployment

```bash
curl -X DELETE https://<api-endpoint>/dev/greengrass/deployments/<deploymentId>
```

### SNS Alert Configuration

#### Subscribe to Alerts

```bash
# Subscribe email to alerts
aws sns subscribe \
  --topic-arn <DeviceAlertTopicArn> \
  --protocol email \
  --notification-endpoint your-email@example.com

# Subscribe SMS
aws sns subscribe \
  --topic-arn <DeviceAlertTopicArn> \
  --protocol sms \
  --notification-endpoint +1234567890

# Subscribe HTTPS webhook
aws sns subscribe \
  --topic-arn <DeviceAlertTopicArn> \
  --protocol https \
  --notification-endpoint https://your-webhook.com/iot-alerts
```

Alert types automatically detected:
- **LOW_BATTERY**: Battery < 20% (Warning), < 10% (Critical)
- **TEMPERATURE_ALERT**: Temperature out of safe range
- **DISCONNECTED**: Device connectivity issues
- **DEVICE_ERROR**: Device reported errors
- **HIGH_MEMORY_USAGE**: Memory usage > 90%
- **HIGH_CPU_USAGE**: CPU usage > 90%
- **LOW_DISK_SPACE**: Disk usage > 90%

### Thing Type Management (Dynamic)

#### Create Thing Type

```bash
curl -X POST https://<api-endpoint>/dev/thing-types \
  -H "Content-Type: application/json" \
  -d '{
    "thingTypeName": "CustomSensor",
    "thingTypeDescription": "Custom sensor type for environmental monitoring",
    "searchableAttributes": ["model", "location", "firmware_version"],
    "tags": {
      "Environment": "Production",
      "Department": "Engineering"
    }
  }'
```

#### List Thing Types

```bash
# List all thing types
curl https://<api-endpoint>/dev/thing-types

# Filter by name
curl "https://<api-endpoint>/dev/thing-types?thingTypeName=CustomSensor"

# Pagination
curl "https://<api-endpoint>/dev/thing-types?maxResults=10&nextToken=<token>"
```

#### Get Thing Type

```bash
curl https://<api-endpoint>/dev/thing-types/CustomSensor
```

#### Delete Thing Type

```bash
# Delete thing type (will deprecate first, then delete)
curl -X DELETE https://<api-endpoint>/dev/thing-types/CustomSensor

# Only deprecate (without deleting)
curl -X DELETE "https://<api-endpoint>/dev/thing-types/CustomSensor?undoDeprecate=false"
```

### Thing Group Management (Dynamic)

#### Create Thing Group

```bash
curl -X POST https://<api-endpoint>/dev/thing-groups \
  -H "Content-Type: application/json" \
  -d '{
    "thingGroupName": "production-sensors",
    "parentGroupName": "production",
    "thingGroupDescription": "Production environment sensors",
    "attributePayload": {
      "attributes": {
        "environment": "production",
        "region": "us-east-1"
      }
    },
    "tags": {
      "Department": "Engineering",
      "CostCenter": "12345"
    }
  }'
```

#### List Thing Groups

```bash
# List all thing groups
curl https://<api-endpoint>/dev/thing-groups

# Filter by parent group
curl "https://<api-endpoint>/dev/thing-groups?parentGroup=production"

# Filter by name prefix
curl "https://<api-endpoint>/dev/thing-groups?namePrefixFilter=prod"
```

#### Get Thing Group

```bash
curl https://<api-endpoint>/dev/thing-groups/production-sensors
```

#### Add Thing to Group

```bash
curl -X PUT https://<api-endpoint>/dev/thing-groups/production-sensors/things/Sensor-ABC123 \
  -H "Content-Type: application/json" \
  -d '{
    "overrideDynamicGroups": false
  }'
```

#### Remove Thing from Group

```bash
curl -X DELETE https://<api-endpoint>/dev/thing-groups/production-sensors/things/Sensor-ABC123
```

#### Delete Thing Group

```bash
# Delete thing group (must be empty)
curl -X DELETE https://<api-endpoint>/dev/thing-groups/production-sensors

# Force delete (even with things - dangerous!)
curl -X DELETE "https://<api-endpoint>/dev/thing-groups/production-sensors?force=true"
```

### AWS CLI Commands

#### Update Shadow

```bash
aws iot-data update-thing-shadow \
  --thing-name Sensor-ABC12345678 \
  --payload '{"state":{"desired":{"config":{"reportInterval":60}}}}' \
  /dev/stdout
```

#### Get Shadow

```bash
aws iot-data get-thing-shadow \
  --thing-name Sensor-ABC12345678 \
  /dev/stdout | jq .
```

#### List Things

```bash
aws iot list-things
```

#### Describe Thing

```bash
aws iot describe-thing --thing-name Sensor-ABC12345678
```

## Monitoring

### CloudWatch Logs

View Lambda function logs:

```bash
# Pre-provisioning hook logs
serverless logs -f preProvisioningHook --stage dev --tail

# Shadow update handler logs
serverless logs -f shadowUpdateHandler --stage dev --tail

# Fleet analytics aggregator logs
serverless logs -f fleetAnalyticsAggregator --stage dev --tail

# Device alert handler logs
serverless logs -f deviceAlertHandler --stage dev --tail

# API logs
serverless logs -f createDevice --stage dev --tail
serverless logs -f getFleetAnalytics --stage dev --tail
```

### DynamoDB Tables

Query devices:

```bash
aws dynamodb scan --table-name iot-shadow-management-devices-dev
```

Query shadow history:

```bash
aws dynamodb query \
  --table-name iot-shadow-management-shadow-history-dev \
  --key-condition-expression "thingName = :tn" \
  --expression-attribute-values '{":tn":{"S":"Sensor-ABC12345678"}}' \
  --scan-index-forward false \
  --limit 10
```

Query fleet analytics:

```bash
aws dynamodb scan --table-name iot-shadow-management-fleet-analytics-dev
```

Query Greengrass deployments:

```bash
aws dynamodb scan --table-name iot-shadow-management-greengrass-deployments-dev
```

### IoT Core Metrics

View metrics in AWS Console:

1. Go to AWS IoT Core → Monitor
2. View:
   - Connection metrics
   - Message broker metrics
   - Shadow metrics
   - Rule metrics

## Testing

### Test Shadow Updates

1. **Start device client** (see Usage section above)

2. **Update desired state**:

```bash
aws iot-data update-thing-shadow \
  --thing-name Sensor-ABC12345678 \
  --payload '{"state":{"desired":{"command":{"action":"diagnostics"}}}}' \
  /dev/stdout
```

3. **Check device logs** to see delta received and processed

4. **Verify reported state**:

```bash
aws iot-data get-thing-shadow \
  --thing-name Sensor-ABC12345678 \
  /dev/stdout | jq '.state.reported'
```

### Test API

```bash
# Create device
DEVICE_ID=$(curl -X POST https://<api-endpoint>/dev/devices \
  -H "Content-Type: application/json" \
  -d '{"serialNumber":"TEST123","deviceType":"Sensor"}' \
  | jq -r '.device.deviceId')

# Get device
curl https://<api-endpoint>/dev/devices/$DEVICE_ID

# Update shadow
curl -X PUT https://<api-endpoint>/dev/devices/$DEVICE_ID/shadow \
  -H "Content-Type: application/json" \
  -d '{"desired":{"test":true}}'

# Get shadow
curl https://<api-endpoint>/dev/devices/$DEVICE_ID/shadow

# Get history
curl https://<api-endpoint>/dev/devices/$DEVICE_ID/shadow/history
```

## Troubleshooting

### Device Cannot Connect

1. **Check IoT endpoint**: Verify endpoint URL is correct
2. **Check certificates**: Ensure certificates are valid and active
3. **Check policies**: Verify policy is attached to certificate
4. **Check CloudWatch Logs**: Look for connection errors

### Provisioning Fails

1. **Check pre-provisioning hook logs**: View CloudWatch Logs for validation errors
2. **Check serial number**: Ensure serial number is unique and valid format
3. **Check device type**: Must be one of: Sensor, Gateway, Actuator
4. **Check claim certificate**: Verify claim policy is attached

### Shadow Updates Not Working

1. **Check device policy**: Verify shadow permissions are granted
2. **Check IoT Rules**: Ensure rules are enabled
3. **Check Lambda function logs**: View CloudWatch Logs for errors
4. **Check shadow state**: Use AWS CLI to inspect current shadow

### API Errors

1. **Check API Gateway logs**: Enable CloudWatch Logs for API Gateway
2. **Check Lambda function logs**: View specific function logs
3. **Check IAM permissions**: Ensure Lambda has required permissions
4. **Check DynamoDB**: Verify tables exist and have correct indexes

## Security Best Practices

1. **Certificate Rotation**: Implement automated certificate rotation
2. **Least Privilege**: Apply minimal required permissions to policies
3. **Audit Logging**: Enable CloudTrail for API call auditing
4. **Network Security**: Use VPC endpoints where applicable
5. **Encryption**: Enable encryption at rest for DynamoDB
6. **Monitoring**: Set up CloudWatch alarms for suspicious activity

## Cost Optimization

1. **DynamoDB**: Use on-demand pricing for variable loads
2. **TTL**: Enable TTL on history tables (90 days default)
3. **Lambda**: Optimize memory and timeout settings
4. **Message Batching**: Batch device messages where possible
5. **Shadow Updates**: Only update shadow when state changes

## Cleanup

Remove all resources:

```bash
serverless remove --stage dev --region us-east-1
```

**Note**: This will delete all DynamoDB tables and data. Export important data before removal.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT

## Support

For issues and questions:

1. Check [COMPONENTS.md](./COMPONENTS.md) and [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Review CloudWatch Logs
3. Check AWS IoT Core documentation
4. Open an issue in the repository

## Additional Resources

- [AWS IoT Core Documentation](https://docs.aws.amazon.com/iot/)
- [AWS IoT Device SDK](https://github.com/aws/aws-iot-device-sdk-js-v2)
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs)
- [AWS IoT Best Practices](https://docs.aws.amazon.com/iot/latest/developerguide/iot-best-practices.html)
