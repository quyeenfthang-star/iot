# IoT Device Client - Node.js Example

This is a Node.js implementation of an IoT device client that supports Fleet Provisioning and Shadow Management.

## Features

- **Fleet Provisioning**: Automatically register devices with AWS IoT Core
- **Shadow Management**: Report device state and receive configuration updates
- **Delta Handling**: Process desired state changes from the cloud
- **Telemetry**: Publish sensor data periodically

## Installation

1. Install dependencies:

```bash
npm install
```

2. Download AWS IoT Root CA certificate:

```bash
curl -o AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem
```

## Usage

Run the device client:

```bash
node device-client.js \
  --endpoint xxxxx.iot.us-east-1.amazonaws.com \
  --claim-cert claim-cert.pem \
  --claim-key claim-private-key.pem \
  --root-ca AmazonRootCA1.pem \
  --template-name iot-shadow-management-template-dev \
  --serial-number ABC12345678 \
  --device-type Sensor
```

## Example Output

```
Connecting with claim certificate...
Connected with claim certificate!
Starting Fleet Provisioning for Sensor-ABC12345678...
Creating keys and certificate...
Certificate created successfully!
Saved device certificate and key to files
Registering thing...
Thing registered successfully!
Thing Name: Sensor-ABC12345678
Device provisioned successfully! Thing name: Sensor-ABC12345678
Connecting with device certificate...
Connected with device certificate!
Subscribing to shadow delta...
Subscribed to shadow delta!

Starting main loop...
Publishing telemetry...
Telemetry published!
```

See the Python README for more detailed information about prerequisites, shadow structure, and testing.
