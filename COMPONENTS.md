# AWS IoT Shadow Management Components

## Overview
This document outlines the components required for managing devices using AWS IoT Device Shadows with Fleet Provisioning.

## Required AWS Services

### 1. AWS IoT Core
- **IoT Thing Registry**: Stores device metadata and attributes
- **Device Shadows**: Virtual representation of device state
- **IoT Rules Engine**: Routes messages and triggers actions
- **Fleet Provisioning**: Automated device registration and certificate generation

### 2. AWS Lambda
- **Fleet Provisioning Handler**: Processes device registration requests
- **Shadow Update Handler**: Processes shadow state changes
- **Device Management Handler**: Handles device lifecycle operations

### 3. AWS DynamoDB
- **Device Registry Table**: Stores device information and metadata
- **Shadow History Table**: Tracks shadow state changes over time
- **Provisioning Logs Table**: Audit trail for device provisioning

### 4. AWS IAM
- **IoT Service Role**: Allows IoT Core to invoke Lambda and access DynamoDB
- **Lambda Execution Role**: Permissions for Lambda functions
- **Provisioning Role**: Role for Fleet Provisioning template

### 5. AWS Certificate Manager / IoT Certificate Management
- **Device Certificates**: X.509 certificates for device authentication
- **CA Certificates**: Certificate Authority for signing device certificates

## Component Architecture

### Fleet Provisioning Components

1. **Provisioning Template**
   - Defines device creation parameters
   - Specifies IoT policy and certificate attachments
   - Configures initial device attributes

2. **Provisioning Claim Certificate**
   - Initial certificate for unregistered devices
   - Limited permissions for provisioning only
   - Rotated after device registration

3. **Pre-Provisioning Hook (Lambda)**
   - Validates device serial numbers
   - Checks device authorization
   - Returns device-specific configuration

4. **Device Certificate**
   - Unique certificate per device
   - Generated during provisioning
   - Attached to IoT Thing

### Shadow Management Components

1. **Classic Shadow**
   - Default shadow for each Thing
   - Stores desired and reported states
   - Includes metadata and version tracking

2. **Named Shadows** (Optional)
   - Multiple shadows per device
   - Organize different aspects (connectivity, config, telemetry)
   - Better scalability for complex devices

3. **Shadow Delta**
   - Difference between desired and reported states
   - Triggers device updates
   - Published to delta topic

4. **Shadow Update Rules**
   - IoT Rules for shadow changes
   - Triggers Lambda functions
   - Stores shadow history

### Device Management Components

1. **Thing Types**
   - Categorize devices (sensors, gateways, actuators)
   - Define searchable attributes
   - Apply group policies

2. **Thing Groups**
   - Organize devices hierarchically
   - Apply group-level policies
   - Bulk operations support

3. **Jobs**
   - Deploy firmware updates
   - Update device configuration
   - Execute remote commands

## Data Flow

```
Device Registration Flow:
1. Device → IoT Core (Provisioning topic, claim cert)
2. IoT Core → Pre-Provisioning Lambda (validation)
3. Lambda → DynamoDB (check/store device)
4. IoT Core → Device (new certificate + Thing name)
5. Device → IoT Core (connect with new certificate)

Shadow Update Flow:
1. Device → IoT Core (reported state)
2. IoT Core → Shadow Service (update shadow)
3. Shadow Service → IoT Rules (on change)
4. IoT Rules → Lambda (process update)
5. Lambda → DynamoDB (store history)
6. Application → IoT Core (desired state)
7. Shadow Service → Device (delta)
```

## Required Policies

### 1. Provisioning Policy (Claim Certificate)
```
- iot:Connect
- iot:Subscribe (provisioning topics)
- iot:Publish (provisioning topics)
- iot:Receive (provisioning topics)
```

### 2. Device Policy (After Provisioning)
```
- iot:Connect
- iot:Subscribe (shadow topics, jobs topics)
- iot:Publish (shadow topics, telemetry topics)
- iot:Receive
- iot:GetThingShadow
- iot:UpdateThingShadow
```

### 3. Application Policy
```
- iot:UpdateThingShadow
- iot:GetThingShadow
- iot:DeleteThingShadow
- iot:CreateThing
- iot:DescribeThing
- iot:UpdateThing
```

## Monitoring & Logging

### CloudWatch Logs
- Lambda function logs
- IoT Core connection logs
- Provisioning success/failure logs

### CloudWatch Metrics
- Shadow update frequency
- Device connection status
- Provisioning success rate
- Lambda invocation count

### X-Ray Tracing
- End-to-end request tracing
- Performance analysis
- Error diagnosis

## Security Considerations

1. **Certificate Rotation**: Implement automated certificate rotation
2. **Least Privilege**: Apply minimal required permissions
3. **Audit Logging**: Enable CloudTrail for API calls
4. **Network Security**: Use VPC endpoints where applicable
5. **Encryption**: Enable encryption at rest and in transit
6. **Device Authentication**: Validate device identity during provisioning

## Cost Optimization

1. Use device shadows efficiently (minimize updates)
2. Implement message batching where possible
3. Use DynamoDB on-demand pricing for variable loads
4. Set appropriate DynamoDB TTL for historical data
5. Use IoT Device Defender for security auditing
6. Monitor and optimize Lambda execution time
