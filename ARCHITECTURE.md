# AWS IoT Shadow Management Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              IoT DEVICES                                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Sensor 1   │  │   Sensor 2   │  │   Gateway    │  │  Actuator    │  │
│  │ (Not Prov.)  │  │ (Provisioned)│  │              │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │                  │           │
└─────────┼──────────────────┼──────────────────┼──────────────────┼───────────┘
          │ Claim Cert       │ Device Cert      │                  │
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AWS IoT CORE                                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    FLEET PROVISIONING                                   │ │
│  │                                                                         │ │
│  │  ┌──────────────────┐         ┌─────────────────────┐                │ │
│  │  │ Provisioning     │────────▶│ Pre-Provisioning    │                │ │
│  │  │ Template         │         │ Hook (Lambda)       │                │ │
│  │  │ - ClaimCertPolicy│         │ - Validate Serial   │                │ │
│  │  │ - DeviceTemplate │         │ - Check Whitelist   │                │ │
│  │  └──────────────────┘         └─────────┬───────────┘                │ │
│  │                                          │                             │ │
│  │                               ┌──────────▼──────────┐                 │ │
│  │                               │ Generate Device     │                 │ │
│  │                               │ - Thing            │                 │ │
│  │                               │ - Certificate      │                 │ │
│  │                               │ - Attach Policy    │                 │ │
│  │                               └─────────────────────┘                 │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      DEVICE SHADOW SERVICE                             │ │
│  │                                                                         │ │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │ │
│  │  │   Classic    │   │    Named     │   │    Named     │             │ │
│  │  │   Shadow     │   │  Shadow 1    │   │  Shadow 2    │             │ │
│  │  │              │   │ (telemetry)  │   │ (config)     │             │ │
│  │  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘             │ │
│  │         │                   │                   │                     │ │
│  │         └───────────────────┴───────────────────┘                     │ │
│  │                             │                                          │ │
│  │                    ┌────────▼─────────┐                               │ │
│  │                    │  Shadow Topics   │                               │ │
│  │                    │  - update        │                               │ │
│  │                    │  - delta         │                               │ │
│  │                    │  - get           │                               │ │
│  │                    │  - delete        │                               │ │
│  │                    └──────────────────┘                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       IoT RULES ENGINE                                 │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────┐      │ │
│  │  │ Rule 1: On Shadow Update                                    │      │ │
│  │  │ SELECT * FROM '$aws/things/+/shadow/update/accepted'        │      │ │
│  │  │ ACTION: Invoke Lambda + Store DynamoDB                      │      │ │
│  │  └────────────────────────────┬────────────────────────────────┘      │ │
│  │                                │                                        │ │
│  │  ┌─────────────────────────────▼───────────────────────────────┐      │ │
│  │  │ Rule 2: On Shadow Delta                                     │      │ │
│  │  │ SELECT * FROM '$aws/things/+/shadow/update/delta'           │      │ │
│  │  │ ACTION: Invoke Lambda (notify device)                       │      │ │
│  │  └─────────────────────────────────────────────────────────────┘      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         THING REGISTRY                                 │ │
│  │                                                                         │ │
│  │  Dynamic Thing Type Management via API:                                │ │
│  │  - Create/List/Get/Delete Thing Types dynamically                      │ │
│  │  - Custom searchable attributes per type                               │ │
│  │  - Tag-based organization and cost allocation                          │ │
│  │                                                                         │ │
│  │  Dynamic Thing Group Management via API:                               │ │
│  │  - Hierarchical group structure (parent-child)                         │ │
│  │  - Create/List/Get/Delete groups on-demand                            │ │
│  │  - Add/Remove things to/from groups dynamically                        │ │
│  │  - Attribute payloads for metadata                                     │ │
│  │                                                                         │ │
│  │  Example Hierarchy: production → us-east-1 → sensors → temperature    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────┬───────────────────────────────┘
                   │                           │
        ┌──────────▼──────────┐   ┌────────────▼───────────┐
        │   AWS LAMBDA        │   │   AWS LAMBDA           │
        │                     │   │                        │
        │ ┌─────────────────┐ │   │ ┌────────────────────┐ │
        │ │ Pre-Provision   │ │   │ │ Shadow Update      │ │
        │ │ Hook            │ │   │ │ Handler            │ │
        │ └────────┬────────┘ │   │ └─────────┬──────────┘ │
        │          │          │   │           │            │
        │ ┌────────▼────────┐ │   │ ┌─────────▼──────────┐ │
        │ │ Post-Provision  │ │   │ │ Shadow Delta       │ │
        │ │ Hook            │ │   │ │ Handler            │ │
        │ └─────────────────┘ │   │ └────────────────────┘ │
        └──────────┬──────────┘   └────────────┬───────────┘
                   │                           │
                   └───────────┬───────────────┘
                               │
                   ┌───────────▼────────────────────┐
                   │      AWS DynamoDB              │
                   │                                │
                   │ ┌───────────────────────────┐  │
                   │ │ DeviceRegistry            │  │
                   │ │ - deviceId (PK)           │  │
                   │ │ - thingName               │  │
                   │ │ - certificateArn          │  │
                   │ │ - provisionedAt           │  │
                   │ │ - status                  │  │
                   │ └───────────────────────────┘  │
                   │                                │
                   │ ┌───────────────────────────┐  │
                   │ │ ShadowHistory             │  │
                   │ │ - thingName (PK)          │  │
                   │ │ - timestamp (SK)          │  │
                   │ │ - shadowState             │  │
                   │ │ - delta                   │  │
                   │ └───────────────────────────┘  │
                   │                                │
                   │ ┌───────────────────────────┐  │
                   │ │ ProvisioningLogs          │  │
                   │ │ - requestId (PK)          │  │
                   │ │ - timestamp (SK)          │  │
                   │ │ - deviceId                │  │
                   │ │ - status                  │  │
                   │ └───────────────────────────┘  │
                   │                                │
                   │ ┌───────────────────────────┐  │
                   │ │ FleetAnalytics            │  │
                   │ │ - metricId (PK)           │  │
                   │ │ - timestamp (SK)          │  │
                   │ │ - metricType              │  │
                   │ │ - dimensions              │  │
                   │ │ - value                   │  │
                   │ └───────────────────────────┘  │
                   │                                │
                   │ ┌───────────────────────────┐  │
                   │ │ GreengrassDeployments     │  │
                   │ │ - deploymentId (PK)       │  │
                   │ │ - createdAt (SK)          │  │
                   │ │ - targetArn               │  │
                   │ │ - status                  │  │
                   │ │ - components              │  │
                   │ └───────────────────────────┘  │
                   └────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SNS ALERTS                                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Device Alert Topic                                │ │
│  │                                                                         │ │
│  │  Alert Types:                                                          │ │
│  │  - LOW_BATTERY (Critical/Warning)                                      │ │
│  │  - TEMPERATURE_ALERT                                                   │ │
│  │  - DISCONNECTED                                                        │ │
│  │  - DEVICE_ERROR                                                        │ │
│  │  - HIGH_MEMORY_USAGE                                                   │ │
│  │  - HIGH_CPU_USAGE                                                      │ │
│  │  - LOW_DISK_SPACE                                                      │ │
│  │                                                                         │ │
│  │  Subscriptions: Email, SMS, HTTPS, Lambda, SQS                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      AWS IoT GREENGRASS                                      │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Deployment Manager                                │ │
│  │                                                                         │ │
│  │  - Create deployments to devices/groups                               │ │
│  │  - Manage component versions                                           │ │
│  │  - Track deployment status                                             │ │
│  │  - Cancel active deployments                                           │ │
│  │  - Policy-based rollback/failure handling                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│              DYNAMIC THING TYPE & GROUP MANAGEMENT                           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Thing Type Management                             │ │
│  │                                                                         │ │
│  │  REST API Operations:                                                  │ │
│  │  - POST /thing-types           → Create new type                       │ │
│  │  - GET /thing-types            → List all types                        │ │
│  │  - GET /thing-types/{name}     → Get type details                      │ │
│  │  - DELETE /thing-types/{name}  → Delete type (auto-deprecate)         │ │
│  │                                                                         │ │
│  │  Features:                                                             │ │
│  │  - Searchable attributes (model, location, firmware)                   │ │
│  │  - Tag-based organization (cost allocation, filtering)                │ │
│  │  - Automatic deprecation before deletion                               │ │
│  │  - Name validation and format checking                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Thing Group Management                            │ │
│  │                                                                         │ │
│  │  REST API Operations:                                                  │ │
│  │  - POST /thing-groups                → Create new group                │ │
│  │  - GET /thing-groups                 → List all groups                 │ │
│  │  - GET /thing-groups/{name}          → Get group details               │ │
│  │  - DELETE /thing-groups/{name}       → Delete group (safety checks)    │ │
│  │  - PUT /thing-groups/{g}/things/{t}  → Add thing to group             │ │
│  │  - DELETE /thing-groups/{g}/things/{t} → Remove from group            │ │
│  │                                                                         │ │
│  │  Features:                                                             │ │
│  │  - Hierarchical structure (parent-child relationships)                │ │
│  │  - Attribute payloads for metadata                                     │ │
│  │  - Safety checks before deletion (empty group validation)             │ │
│  │  - Force delete option for emergency scenarios                         │ │
│  │  - Override dynamic group assignments                                  │ │
│  │                                                                         │ │
│  │  Example Hierarchy:                                                    │ │
│  │    production/                                                         │ │
│  │    ├── us-east-1/                                                     │ │
│  │    │   ├── sensors/                                                   │ │
│  │    │   │   ├── temperature-sensors                                    │ │
│  │    │   │   └── humidity-sensors                                       │ │
│  │    │   └── gateways/                                                  │ │
│  │    └── eu-west-1/                                                     │ │
│  │        └── sensors/                                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                    │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │   Web Dashboard  │  │   Mobile App     │  │   Backend API    │         │
│  │                  │  │                  │  │                  │         │
│  │ - View Devices   │  │ - Monitor Status │  │ - CRUD Devices   │         │
│  │ - Update Shadow  │  │ - Send Commands  │  │ - Query Shadows  │         │
│  │ - View History   │  │ - View Alerts    │  │ - Analytics      │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│           │                     │                      │                    │
│           └─────────────────────┴──────────────────────┘                    │
│                                 │                                           │
│                    ┌────────────▼─────────────┐                            │
│                    │   AWS IoT SDK / API      │                            │
│                    │   - Update Shadow        │                            │
│                    │   - Get Shadow           │                            │
│                    │   - Query Fleet          │                            │
│                    └──────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

### 1. Device Provisioning Flow

```
┌─────────┐                ┌─────────┐              ┌──────────┐           ┌─────────┐
│ Device  │                │IoT Core │              │ Lambda   │           │DynamoDB │
└────┬────┘                └────┬────┘              └────┬─────┘           └────┬────┘
     │                          │                        │                      │
     │ 1. Provisioning Request  │                        │                      │
     │ (with claim cert)        │                        │                      │
     ├─────────────────────────▶│                        │                      │
     │                          │                        │                      │
     │                          │ 2. Pre-Provision Hook  │                      │
     │                          ├───────────────────────▶│                      │
     │                          │                        │                      │
     │                          │                        │ 3. Validate Device   │
     │                          │                        ├─────────────────────▶│
     │                          │                        │                      │
     │                          │                        │ 4. Device Data       │
     │                          │                        │◀─────────────────────┤
     │                          │                        │                      │
     │                          │ 5. Approval Response   │                      │
     │                          │◀───────────────────────┤                      │
     │                          │                        │                      │
     │                          │ 6. Create Thing &      │                      │
     │                          │    Certificate         │                      │
     │                          │                        │                      │
     │ 7. Thing Name + Cert     │                        │                      │
     │◀─────────────────────────┤                        │                      │
     │                          │                        │                      │
     │ 8. Connect with new cert │                        │                      │
     ├─────────────────────────▶│                        │                      │
     │                          │                        │                      │
```

### 2. Shadow Update Flow (Device to Cloud)

```
┌─────────┐          ┌─────────┐         ┌──────────┐         ┌─────────┐
│ Device  │          │IoT Core │         │ Lambda   │         │DynamoDB │
└────┬────┘          └────┬────┘         └────┬─────┘         └────┬────┘
     │                    │                    │                    │
     │ 1. Publish to      │                    │                    │
     │ shadow/update      │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Update Shadow   │                    │
     │                    │                    │                    │
     │                    │ 3. Trigger Rule    │                    │
     │                    ├───────────────────▶│                    │
     │                    │                    │                    │
     │                    │                    │ 4. Store History   │
     │                    │                    ├───────────────────▶│
     │                    │                    │                    │
     │ 5. Publish to      │                    │                    │
     │ shadow/update/     │                    │                    │
     │ accepted           │                    │                    │
     │◀───────────────────┤                    │                    │
     │                    │                    │                    │
```

### 3. Shadow Update Flow (Cloud to Device)

```
┌─────────┐          ┌─────────┐         ┌──────────┐         ┌─────────┐
│   App   │          │IoT Core │         │ Device   │         │DynamoDB │
└────┬────┘          └────┬────┘         └────┬─────┘         └────┬────┘
     │                    │                    │                    │
     │ 1. Update Desired  │                    │                    │
     │    State           │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Calculate Delta │                    │
     │                    │                    │                    │
     │                    │ 3. Publish Delta   │                    │
     │                    ├───────────────────▶│                    │
     │                    │                    │                    │
     │                    │                    │ 4. Apply Changes   │
     │                    │                    │                    │
     │                    │ 5. Update Reported │                    │
     │                    │◀───────────────────┤                    │
     │                    │                    │                    │
     │                    │ 6. Store to DB     │                    │
     │                    ├───────────────────────────────────────▶│
     │                    │                    │                    │
```

### 4. Fleet Analytics Flow

```
┌─────────┐          ┌─────────┐         ┌──────────┐         ┌─────────┐
│ Device  │          │DynamoDB │         │ Lambda   │         │DynamoDB │
│Registry │          │ Stream  │         │Analytics │         │Analytics│
└────┬────┘          └────┬────┘         └────┬─────┘         └────┬────┘
     │                    │                    │                    │
     │ 1. Device Status   │                    │                    │
     │    Change (INSERT/ │                    │                    │
     │    MODIFY)         │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Stream Event    │                    │
     │                    ├───────────────────▶│                    │
     │                    │                    │                    │
     │                    │                    │ 3. Aggregate       │
     │                    │                    │    Metrics         │
     │                    │                    │    - Count by Type │
     │                    │                    │    - Count by      │
     │                    │                    │      Status        │
     │                    │                    │    - Total Fleet   │
     │                    │                    │                    │
     │                    │                    │ 4. Store Metrics   │
     │                    │                    ├───────────────────▶│
     │                    │                    │                    │
```

### 5. SNS Alert Flow

```
┌─────────┐          ┌─────────┐         ┌──────────┐         ┌─────────┐
│ Shadow  │          │DynamoDB │         │ Lambda   │         │   SNS   │
│ History │          │ Stream  │         │ Alert    │         │  Topic  │
└────┬────┘          └────┬────┘         └────┬─────┘         └────┬────┘
     │                    │                    │                    │
     │ 1. Shadow Update   │                    │                    │
     │    Stored          │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Stream Event    │                    │
     │                    ├───────────────────▶│                    │
     │                    │                    │                    │
     │                    │                    │ 3. Detect Alerts   │
     │                    │                    │    - Low Battery   │
     │                    │                    │    - High Temp     │
     │                    │                    │    - Errors        │
     │                    │                    │    - Disconnected  │
     │                    │                    │                    │
     │                    │                    │ 4. Publish Alert   │
     │                    │                    ├───────────────────▶│
     │                    │                    │                    │
     │                    │                    │                    │ 5. Notify
     │                    │                    │                    │ Subscribers
     │                    │                    │                    │ (Email/SMS)
     │                    │                    │                    │
```

### 6. Greengrass Deployment Flow

```
┌─────────┐          ┌─────────┐         ┌──────────┐         ┌─────────┐
│   API   │          │ Lambda  │         │Greengrass│         │DynamoDB │
│ Request │          │         │         │  Service │         │         │
└────┬────┘          └────┬────┘         └────┬─────┘         └────┬────┘
     │                    │                    │                    │
     │ 1. Create Deploy   │                    │                    │
     │    Request         │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Call Greengrass │                    │
     │                    │    API             │                    │
     │                    ├───────────────────▶│                    │
     │                    │                    │                    │
     │                    │ 3. Deployment ID   │                    │
     │                    │◀───────────────────┤                    │
     │                    │                    │                    │
     │                    │ 4. Store Record    │                    │
     │                    ├───────────────────────────────────────▶│
     │                    │                    │                    │
     │ 5. Response        │                    │ 6. Deploy to       │
     │◀───────────────────┤                    │    Devices         │
     │                    │                    │                    │
```

### 7. Dynamic Thing Type Creation Flow

```
┌─────────┐          ┌─────────┐         ┌──────────┐         ┌─────────┐
│   API   │          │ Lambda  │         │   IoT   │          │  Tags   │
│ Request │          │         │         │  Core   │          │Metadata │
└────┬────┘          └────┬────┘         └────┬─────┘         └────┬────┘
     │                    │                    │                    │
     │ 1. Create Thing    │                    │                    │
     │    Type Request    │                    │                    │
     │    {name, attrs,   │                    │                    │
     │     searchable,    │                    │                    │
     │     tags}          │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Validate Name   │                    │
     │                    │    & Format        │                    │
     │                    │                    │                    │
     │                    │ 3. Create in IoT   │                    │
     │                    ├───────────────────▶│                    │
     │                    │                    │                    │
     │                    │ 4. Apply Tags      │                    │
     │                    ├────────────────────────────────────────▶│
     │                    │                    │                    │
     │                    │ 5. Thing Type ARN  │                    │
     │                    │◀───────────────────┤                    │
     │                    │                    │                    │
     │ 6. Response with   │                    │                    │
     │    Type ID & ARN   │                    │                    │
     │◀───────────────────┤                    │                    │
     │                    │                    │                    │
```

### 8. Dynamic Thing Group Creation Flow

```
┌─────────┐          ┌─────────┐         ┌──────────┐         ┌─────────┐
│   API   │          │ Lambda  │         │   IoT   │          │  Thing  │
│ Request │          │         │         │  Core   │          │ Members │
└────┬────┘          └────┬────┘         └────┬─────┘         └────┬────┘
     │                    │                    │                    │
     │ 1. Create Group    │                    │                    │
     │    Request         │                    │                    │
     │    {name, parent,  │                    │                    │
     │     attributes}    │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Validate        │                    │
     │                    │    Parent Exists   │                    │
     │                    │    (if specified)  │                    │
     │                    │                    │                    │
     │                    │ 3. Create Group    │                    │
     │                    ├───────────────────▶│                    │
     │                    │                    │                    │
     │                    │ 4. Group ARN & ID  │                    │
     │                    │◀───────────────────┤                    │
     │                    │                    │                    │
     │ 5. Response        │                    │                    │
     │◀───────────────────┤                    │                    │
     │                    │                    │                    │
     │                    │                    │ 6. Add Things      │
     │                    │                    │    (optional)      │
     │ 7. Add Thing to    │                    │                    │
     │    Group Request   │                    │                    │
     ├───────────────────▶│                    │                    │
     │                    │                    │                    │
     │                    │ 8. Add to Group    │                    │
     │                    ├───────────────────────────────────────▶│
     │                    │                    │                    │
     │ 9. Success         │                    │                    │
     │◀───────────────────┤                    │                    │
     │                    │                    │                    │
```

## Topic Structure

### Fleet Provisioning Topics

```
$aws/certificates/create/json
$aws/certificates/create/json/accepted
$aws/certificates/create/json/rejected

$aws/provisioning-templates/{templateName}/provision/json
$aws/provisioning-templates/{templateName}/provision/json/accepted
$aws/provisioning-templates/{templateName}/provision/json/rejected
```

### Shadow Topics (Classic Shadow)

```
$aws/things/{thingName}/shadow/update
$aws/things/{thingName}/shadow/update/accepted
$aws/things/{thingName}/shadow/update/rejected
$aws/things/{thingName}/shadow/update/delta
$aws/things/{thingName}/shadow/get
$aws/things/{thingName}/shadow/get/accepted
$aws/things/{thingName}/shadow/get/rejected
$aws/things/{thingName}/shadow/delete
$aws/things/{thingName}/shadow/delete/accepted
$aws/things/{thingName}/shadow/delete/rejected
```

### Shadow Topics (Named Shadow)

```
$aws/things/{thingName}/shadow/name/{shadowName}/update
$aws/things/{thingName}/shadow/name/{shadowName}/update/accepted
$aws/things/{thingName}/shadow/name/{shadowName}/update/rejected
$aws/things/{thingName}/shadow/name/{shadowName}/update/delta
$aws/things/{thingName}/shadow/name/{shadowName}/get
...
```

## Security Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                          │
│                                                              │
│  Layer 1: Device Authentication                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ X.509 Certificate + Private Key                        │ │
│  │ - Mutual TLS (mTLS)                                    │ │
│  │ - Certificate validation by AWS IoT Core              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Layer 2: Authorization                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ IoT Policies                                           │ │
│  │ - Resource-based permissions                          │ │
│  │ - Topic-level access control                          │ │
│  │ - Operation restrictions (pub/sub/connect)            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Layer 3: Network Security                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ TLS 1.2+ Encryption                                    │ │
│  │ - Data in transit encryption                          │ │
│  │ - AWS IoT VPC endpoints (optional)                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Layer 4: Data Protection                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Encryption at Rest                                     │ │
│  │ - DynamoDB encryption (KMS)                           │ │
│  │ - CloudWatch Logs encryption                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Layer 5: Audit & Compliance                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ CloudTrail + IoT Device Defender                      │ │
│  │ - API call logging                                     │ │
│  │ - Anomaly detection                                    │ │
│  │ - Security audit                                       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```
