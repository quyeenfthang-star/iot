# IoT Device Client - Python Example

This is a Python implementation of an IoT device client that supports Fleet Provisioning and Shadow Management.

## Features

- **Fleet Provisioning**: Automatically register devices with AWS IoT Core
- **Shadow Management**: Report device state and receive configuration updates
- **Delta Handling**: Process desired state changes from the cloud
- **Telemetry**: Publish sensor data periodically

## Installation

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Download AWS IoT Root CA certificate:

```bash
curl -o AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem
```

## Prerequisites

Before running the device client, you need:

1. **Claim Certificate**: A certificate with provisioning permissions
2. **Claim Private Key**: Private key for the claim certificate
3. **IoT Endpoint**: Your AWS IoT Core endpoint
4. **Template Name**: The provisioning template name
5. **Serial Number**: Unique identifier for the device
6. **Device Type**: One of: Sensor, Gateway, Actuator

### Getting Claim Certificate

After deploying the infrastructure, create a claim certificate:

```bash
# Create certificate
aws iot create-keys-and-certificate \
  --set-as-active \
  --certificate-pem-outfile claim-cert.pem \
  --public-key-outfile claim-public-key.pem \
  --private-key-outfile claim-private-key.pem

# Get certificate ARN from output
CERT_ARN="arn:aws:iot:region:account:cert/cert-id"

# Attach claim policy
aws iot attach-policy \
  --policy-name iot-shadow-management-claim-policy-dev \
  --target $CERT_ARN
```

### Getting IoT Endpoint

```bash
aws iot describe-endpoint --endpoint-type iot:Data-ATS
```

## Usage

Run the device client:

```bash
python device_client.py \
  --endpoint xxxxx.iot.us-east-1.amazonaws.com \
  --claim-cert claim-cert.pem \
  --claim-key claim-private-key.pem \
  --root-ca AmazonRootCA1.pem \
  --template-name iot-shadow-management-template-dev \
  --serial-number ABC12345678 \
  --device-type Sensor
```

## What Happens

1. **Initial Connection**: Device connects using claim certificate
2. **Provisioning**:
   - Creates unique device certificate
   - Registers Thing in AWS IoT Core
   - Attaches policies to certificate
3. **Reconnection**: Device reconnects using device certificate
4. **Shadow Subscription**: Subscribes to shadow delta updates
5. **Main Loop**:
   - Publishes telemetry every 30 seconds
   - Updates shadow reported state
   - Listens for desired state changes

## Shadow Structure

### Reported State (Device → Cloud)

```json
{
  "state": {
    "reported": {
      "connected": true,
      "timestamp": "2024-01-15T10:30:00Z",
      "telemetry": {
        "temperature": 25.5,
        "humidity": 60,
        "battery": 85,
        "uptime": 123456
      },
      "status": "online"
    }
  }
}
```

### Desired State (Cloud → Device)

```json
{
  "state": {
    "desired": {
      "config": {
        "reportInterval": 60
      },
      "firmware": {
        "version": "2.0.0",
        "url": "s3://bucket/firmware-2.0.0.bin"
      },
      "command": {
        "action": "reboot"
      }
    }
  }
}
```

## Testing with AWS CLI

### Update desired state:

```bash
aws iot-data update-thing-shadow \
  --thing-name Sensor-ABC12345678 \
  --payload '{"state":{"desired":{"config":{"reportInterval":120}}}}' \
  /dev/stdout
```

### Get current shadow:

```bash
aws iot-data get-thing-shadow \
  --thing-name Sensor-ABC12345678 \
  /dev/stdout | jq .
```

## Troubleshooting

### Connection Issues

- Verify IoT endpoint is correct
- Check certificate permissions
- Ensure claim policy is attached

### Provisioning Failures

- Check pre-provisioning hook logs in CloudWatch
- Verify serial number format
- Check device type is valid

### Shadow Updates Not Received

- Verify device certificate has shadow permissions
- Check IoT policy allows shadow topics
- Review CloudWatch Logs for errors
