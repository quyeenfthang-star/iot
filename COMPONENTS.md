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
- **Fleet Analytics Aggregator**: Aggregates fleet-wide metrics from device changes
- **Device Alert Handler**: Detects anomalies and sends SNS notifications
- **Greengrass Deployment Manager**: Manages edge deployments and component updates

### 3. AWS DynamoDB
- **Device Registry Table**: Stores device information and metadata
- **Shadow History Table**: Tracks shadow state changes over time
- **Provisioning Logs Table**: Audit trail for device provisioning
- **Fleet Analytics Table**: Stores aggregated fleet metrics and time-series data
- **Greengrass Deployments Table**: Tracks Greengrass deployment history and status

### 4. AWS SNS
- **Device Alert Topic**: Publishes device alerts and critical notifications
- **Alert Subscriptions**: Email, SMS, HTTPS, Lambda, and SQS endpoints

### 5. AWS IoT Greengrass
- **Greengrass Core**: Edge runtime for local compute and messaging
- **Component Manager**: Manages software components on edge devices
- **Deployment Service**: Orchestrates component deployments to devices/groups

### 6. AWS IAM
- **IoT Service Role**: Allows IoT Core to invoke Lambda and access DynamoDB
- **Lambda Execution Role**: Permissions for Lambda functions (DynamoDB, SNS, Greengrass)
- **Provisioning Role**: Role for Fleet Provisioning template

### 7. AWS Certificate Manager / IoT Certificate Management
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

### Fleet Analytics Components

1. **Analytics Aggregator (Lambda)**
   - Streams device registry changes via DynamoDB Streams
   - Aggregates metrics by device type, status, and date
   - Stores time-series data with 90-day retention
   - Calculates fleet-wide statistics in real-time

2. **Analytics API Endpoints**
   - GET /analytics/fleet - Fleet-wide metrics and trends
   - GET /analytics/devices/{deviceId}/metrics - Device-specific metrics
   - Supports time-range filtering and metric type filtering
   - Returns aggregated statistics (avg, min, max, current)

3. **Metrics Tracked**
   - Device counts by type (Sensor, Gateway, Actuator)
   - Device counts by status (ACTIVE, INACTIVE, PROVISIONING)
   - Total fleet size and active device count
   - Battery levels, temperature, connectivity status
   - Error rates and alert frequencies

### SNS Alert System Components

1. **Alert Handler (Lambda)**
   - Monitors shadow updates via DynamoDB Streams
   - Detects critical conditions and anomalies
   - Formats and publishes alerts to SNS topic
   - Includes severity levels (CRITICAL, WARNING)

2. **Alert Types**
   - LOW_BATTERY: < 20% (Warning), < 10% (Critical)
   - TEMPERATURE_ALERT: Out of safe range
   - DISCONNECTED: Connectivity issues
   - DEVICE_ERROR: Device-reported errors
   - HIGH_MEMORY_USAGE: > 90%
   - HIGH_CPU_USAGE: > 90%
   - LOW_DISK_SPACE: > 90%

3. **SNS Topic & Subscriptions**
   - Centralized alert topic for all device alerts
   - Supports multiple subscription types (Email, SMS, HTTPS)
   - Message attributes for filtering by severity/type
   - Formatted notifications with device context

### Greengrass Deployment Components

1. **Deployment Manager API**
   - POST /greengrass/deployments - Create new deployment
   - GET /greengrass/deployments/{id} - Get deployment status
   - GET /greengrass/deployments - List/filter deployments
   - DELETE /greengrass/deployments/{id} - Cancel deployment

2. **Deployment Tracking**
   - Stores deployment metadata in DynamoDB
   - Tracks deployment status and progress
   - Links to IoT Jobs for execution
   - Historical deployment records

3. **Greengrass Integration**
   - Deploys components to devices or thing groups
   - Manages component versions and configurations
   - Supports rollback policies and failure handling
   - Timeout and retry configuration

### Dynamic Thing Type Management Components

1. **Thing Type Management API**
   - POST /thing-types - Create new thing type dynamically
   - GET /thing-types - List all thing types with pagination
   - GET /thing-types/{name} - Get thing type details
   - DELETE /thing-types/{name} - Delete thing type (with deprecation)

2. **Thing Type Features**
   - Custom searchable attributes for device categorization
   - Tag support for cost allocation and organization
   - Automatic deprecation before deletion
   - Name format validation and error handling

3. **Use Cases**
   - Multi-tenant environments with custom device types
   - Dynamic device categorization without infrastructure changes
   - Flexible attribute schemas per device category
   - On-demand type creation for new device models

### Dynamic Thing Group Management Components

1. **Thing Group Management API**
   - POST /thing-groups - Create new thing group dynamically
   - GET /thing-groups - List thing groups with filtering
   - GET /thing-groups/{name} - Get thing group details
   - DELETE /thing-groups/{name} - Delete thing group (with safety checks)
   - PUT/DELETE /thing-groups/{groupName}/things/{thingName} - Manage membership

2. **Thing Group Features**
   - Hierarchical group structure (parent-child relationships)
   - Attribute payloads for group metadata
   - Safety checks before deletion (empty group validation)
   - Force delete option for emergency scenarios
   - Override dynamic group assignments

3. **Hierarchical Organization**
   - Multi-level group nesting (e.g., production → us-east-1 → sensors)
   - Attribute inheritance from parent groups
   - Policy application at group level
   - Bulk operations on group members

4. **Use Cases**
   - Geographic organization (region → zone → building)
   - Environment-based grouping (prod → staging → dev)
   - Functional grouping (sensors → gateways → actuators)
   - Custom organizational hierarchies without redeployment

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
