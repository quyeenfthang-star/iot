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
│  │  Thing Types: [Sensor, Gateway, Actuator]                             │ │
│  │  Thing Groups: /production/region-1/sensors                            │ │
│  │  Attributes: {model, version, location, capabilities}                  │ │
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
                   └────────────────────────────────┘

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
