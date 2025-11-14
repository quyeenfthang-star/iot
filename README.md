# AWS IoT Shadow Management with Fleet Provisioning

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-repo/iot)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen.svg)](https://nodejs.org/)
[![Serverless](https://img.shields.io/badge/serverless-%3E%3D3.x-orange.svg)](https://www.serverless.com/)
[![AWS](https://img.shields.io/badge/AWS-IoT%20Core-yellow.svg)](https://aws.amazon.com/iot-core/)

A complete serverless solution for managing IoT devices using AWS IoT Device Shadows and Fleet Provisioning.

## 🎯 Overview

This project provides a production-ready infrastructure for:

- **Fleet Provisioning**: Automatically register and provision IoT devices
- **Shadow Management**: Synchronize device state between cloud and devices
- **Device Management**: REST API for device CRUD operations
- **Telemetry & History**: Track device shadow updates over time
- **Security**: Certificate-based authentication and fine-grained policies

## ✨ Key Features

- 🚀 **Automated Device Provisioning**: Fleet Provisioning with pre-validation hooks
- 📊 **Real-time Shadow Sync**: Bidirectional state synchronization
- 🔒 **Certificate-based Security**: X.509 certificates with fine-grained policies
- 📡 **Multiple Device Types**: Support for Sensors, Gateways, and Actuators
- 📈 **Shadow History**: Time-series tracking with 90-day retention
- 🌐 **REST API**: Complete device management endpoints
- 🔄 **Delta Processing**: Efficient state change notifications
- 📦 **Serverless Architecture**: Scalable and cost-effective
- 🛡️ **Production-ready**: Security best practices and monitoring
- 🐍 **Multi-language Clients**: Python and Node.js device examples

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd iot
npm install

# Deploy to AWS
npm run deploy:dev

# Create claim certificate and start provisioning devices
# See detailed instructions in the Deployment section below
```

## 📚 Documentation

- **[README.md](./README.md)** - This file, overview and usage guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and diagrams
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Step-by-step deployment guide
- **[COMPONENTS.md](./COMPONENTS.md)** - Detailed component descriptions
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines

## 📋 Architecture

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
│       └── api/
│           ├── createDevice.js           # Create device manually
│           ├── getDevice.js              # Get device details
│           ├── listDevices.js            # List all devices
│           ├── updateDeviceShadow.js     # Update device shadow
│           ├── getDeviceShadow.js        # Get device shadow
│           └── getShadowHistory.js       # Get shadow history
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

# API logs
serverless logs -f createDevice --stage dev --tail
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

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for details on:

- Code of conduct
- Development setup
- Coding standards
- Pull request process
- Reporting bugs
- Suggesting enhancements

Quick contribution steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our coding standards
4. Test thoroughly
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a detailed history of changes, new features, and bug fixes.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

This project uses the following AWS services and open-source tools:

- **AWS IoT Core** - Device connectivity and shadow management
- **AWS Lambda** - Serverless compute for handlers
- **AWS DynamoDB** - Device registry and shadow history storage
- **AWS API Gateway** - REST API endpoints
- **Serverless Framework** - Infrastructure as Code
- **AWS IoT Device SDK** - Device client libraries

Special thanks to the AWS IoT and Serverless communities for their excellent documentation and examples.

## 📞 Support

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
