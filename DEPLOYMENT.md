# Deployment Guide

Quick reference guide for deploying the AWS IoT Shadow Management infrastructure.

## Pre-Deployment Checklist

- [ ] AWS CLI installed and configured
- [ ] Node.js 18.x or later installed
- [ ] Serverless Framework installed (`npm install -g serverless`)
- [ ] AWS credentials configured with appropriate permissions
- [ ] Target AWS region selected

## Step 1: Install Dependencies

```bash
cd iot
npm install
```

## Step 2: Configure Deployment

Edit `serverless.yml` if needed to customize:

- Region (default: us-east-1)
- Stage (default: dev)
- Table names
- Lambda memory/timeout settings
- IoT policy permissions

## Step 3: Deploy Infrastructure

```bash
# Deploy to development
serverless deploy --stage dev --region us-east-1

# Deploy to production
serverless deploy --stage prod --region us-east-1
```

Expected deployment time: **5-10 minutes**

## Step 4: Save Deployment Outputs

After deployment completes, save the following outputs:

```bash
# Get outputs
serverless info --stage dev --region us-east-1
```

Save these values:

| Output | Example | Usage |
|--------|---------|-------|
| DeviceTableName | iot-shadow-management-devices-dev | DynamoDB device registry |
| ShadowHistoryTableName | iot-shadow-management-shadow-history-dev | DynamoDB shadow history |
| FleetAnalyticsTableName | iot-shadow-management-fleet-analytics-dev | DynamoDB fleet analytics |
| GreengrassDeploymentsTableName | iot-shadow-management-greengrass-deployments-dev | DynamoDB Greengrass deployments |
| DeviceAlertTopicArn | arn:aws:sns:us-east-1:...:iot-shadow-management-device-alerts-dev | SNS alert topic |
| ProvisioningTemplateName | iot-shadow-management-template-dev | Fleet provisioning |
| ClaimPolicyName | iot-shadow-management-claim-policy-dev | Claim certificates |
| DevicePolicyName | iot-shadow-management-device-policy-dev | Device certificates |
| IoTEndpoint | xxxxx.iot.us-east-1.amazonaws.com | Device connections |
| ApiEndpoint | https://xxxxx.execute-api.us-east-1.amazonaws.com/dev | REST API |

## Step 5: Create Claim Certificate

```bash
# Set variables
STAGE=dev
REGION=us-east-1
CLAIM_POLICY="iot-shadow-management-claim-policy-${STAGE}"

# Create certificate
aws iot create-keys-and-certificate \
  --set-as-active \
  --certificate-pem-outfile claim-cert.pem \
  --public-key-outfile claim-public-key.pem \
  --private-key-outfile claim-private-key.pem \
  --region $REGION

# IMPORTANT: Save the certificate ARN from the output
CERT_ARN="<paste-certificate-arn-here>"

# Attach claim policy
aws iot attach-policy \
  --policy-name $CLAIM_POLICY \
  --target $CERT_ARN \
  --region $REGION

echo "✓ Claim certificate created and policy attached"
```

## Step 6: Download Root CA

```bash
curl -o AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem
echo "✓ Root CA certificate downloaded"
```

## Step 7: Get IoT Endpoint

```bash
IOT_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --region $REGION --query 'endpointAddress' --output text)
echo "IoT Endpoint: $IOT_ENDPOINT"
```

## Step 8: Verify Deployment

### Verify DynamoDB Tables

```bash
aws dynamodb list-tables --region $REGION | grep iot-shadow-management
```

Expected tables:
- `iot-shadow-management-devices-dev`
- `iot-shadow-management-shadow-history-dev`
- `iot-shadow-management-provisioning-logs-dev`
- `iot-shadow-management-fleet-analytics-dev`
- `iot-shadow-management-greengrass-deployments-dev`

### Verify Lambda Functions

```bash
aws lambda list-functions --region $REGION | grep iot-shadow-management
```

Expected functions (27 total):
- `iot-shadow-management-dev-preProvisioningHook`
- `iot-shadow-management-dev-postProvisioningHook`
- `iot-shadow-management-dev-shadowUpdateHandler`
- `iot-shadow-management-dev-shadowDeltaHandler`
- `iot-shadow-management-dev-fleetAnalyticsAggregator`
- `iot-shadow-management-dev-deviceAlertHandler`
- `iot-shadow-management-dev-createDevice`
- `iot-shadow-management-dev-getDevice`
- `iot-shadow-management-dev-listDevices`
- `iot-shadow-management-dev-updateDeviceShadow`
- `iot-shadow-management-dev-getDeviceShadow`
- `iot-shadow-management-dev-getShadowHistory`
- `iot-shadow-management-dev-getFleetAnalytics`
- `iot-shadow-management-dev-getDeviceMetrics`
- `iot-shadow-management-dev-createGreengrassDeployment`
- `iot-shadow-management-dev-getGreengrassDeployment`
- `iot-shadow-management-dev-listGreengrassDeployments`
- `iot-shadow-management-dev-cancelGreengrassDeployment`
- `iot-shadow-management-dev-createThingType`
- `iot-shadow-management-dev-listThingTypes`
- `iot-shadow-management-dev-getThingType`
- `iot-shadow-management-dev-deleteThingType`
- `iot-shadow-management-dev-createThingGroup`
- `iot-shadow-management-dev-listThingGroups`
- `iot-shadow-management-dev-getThingGroup`
- `iot-shadow-management-dev-deleteThingGroup`
- `iot-shadow-management-dev-addThingToGroup`

### Verify IoT Resources

```bash
# Check provisioning template
aws iot describe-provisioning-template \
  --template-name iot-shadow-management-template-dev \
  --region $REGION

# Check policies
aws iot get-policy \
  --policy-name iot-shadow-management-claim-policy-dev \
  --region $REGION

aws iot get-policy \
  --policy-name iot-shadow-management-device-policy-dev \
  --region $REGION

# Check thing types
aws iot list-thing-types --region $REGION | grep -E "Sensor|Gateway|Actuator"

# Check thing groups
aws iot list-thing-groups --region $REGION | grep production
```

### Test API Endpoint

```bash
# Get API endpoint
API_ENDPOINT=$(serverless info --stage dev --region $REGION | grep "endpoint:" | awk '{print $2}')

# Test list devices endpoint
curl "${API_ENDPOINT}/devices"
```

Expected response:
```json
{
  "devices": [],
  "count": 0,
  "lastKey": null
}
```

## Step 9: Test Device Provisioning

### Option A: Python Client

```bash
cd examples/device-client-python
pip install -r requirements.txt

python device_client.py \
  --endpoint $IOT_ENDPOINT \
  --claim-cert ../../claim-cert.pem \
  --claim-key ../../claim-private-key.pem \
  --root-ca ../../AmazonRootCA1.pem \
  --template-name iot-shadow-management-template-dev \
  --serial-number TEST001 \
  --device-type Sensor
```

### Option B: Node.js Client

```bash
cd examples/device-client-nodejs
npm install

node device-client.js \
  --endpoint $IOT_ENDPOINT \
  --claim-cert ../../claim-cert.pem \
  --claim-key ../../claim-private-key.pem \
  --root-ca ../../AmazonRootCA1.pem \
  --template-name iot-shadow-management-template-dev \
  --serial-number TEST001 \
  --device-type Sensor
```

Expected output:
```
Connecting with claim certificate...
Connected with claim certificate!
Starting Fleet Provisioning...
Certificate created successfully!
Thing registered successfully!
Thing Name: Sensor-TEST001
Device provisioned successfully!
...
```

## Step 10: Configure SNS Alert Subscriptions

Subscribe to device alerts:

```bash
# Get the SNS topic ARN from deployment outputs
SNS_TOPIC_ARN=$(serverless info --stage dev --region $REGION | grep "DeviceAlertTopicArn" | awk '{print $2}')

# Subscribe email to alerts
aws sns subscribe \
  --topic-arn $SNS_TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region $REGION

echo "✓ Email subscription created. Check your email to confirm subscription."

# Optional: Subscribe SMS
aws sns subscribe \
  --topic-arn $SNS_TOPIC_ARN \
  --protocol sms \
  --notification-endpoint +1234567890 \
  --region $REGION
```

## Step 11: Monitor Deployment

### CloudWatch Logs

```bash
# Watch pre-provisioning hook
serverless logs -f preProvisioningHook --stage dev --tail

# Watch shadow update handler
serverless logs -f shadowUpdateHandler --stage dev --tail
```

### CloudWatch Metrics

Go to AWS Console → CloudWatch → Metrics → AWS/IoT

Key metrics to monitor:
- `Connect.Success` - Device connections
- `PublishIn.Success` - Messages from devices
- `PublishOut.Success` - Messages to devices
- `UpdateThingShadow.Success` - Shadow updates

### DynamoDB Console

Go to AWS Console → DynamoDB → Tables

Check data in:
- Device Registry Table
- Shadow History Table
- Provisioning Logs Table

## Deployment Validation Checklist

- [ ] All Lambda functions deployed successfully (27 functions)
- [ ] All DynamoDB tables created (5 tables)
- [ ] DynamoDB streams enabled on DeviceRegistry and ShadowHistory
- [ ] SNS topic created for device alerts
- [ ] IoT provisioning template created
- [ ] IoT policies created (claim and device)
- [ ] Thing types can be created dynamically via API
- [ ] Thing groups can be created dynamically via API
- [ ] API Gateway endpoint accessible
- [ ] Claim certificate created and policy attached
- [ ] Device successfully provisioned
- [ ] Shadow updates working
- [ ] API endpoints returning expected responses
- [ ] Fleet analytics endpoints accessible
- [ ] Greengrass deployment endpoints accessible
- [ ] Thing type management endpoints accessible
- [ ] Thing group management endpoints accessible
- [ ] SNS alert subscriptions configured and confirmed

## Rollback

If deployment fails or needs to be rolled back:

```bash
# Remove all resources
serverless remove --stage dev --region us-east-1
```

**Warning**: This will delete all DynamoDB tables and data!

To preserve data, manually export DynamoDB tables before removal:

```bash
# Export device registry
aws dynamodb scan --table-name iot-shadow-management-devices-dev > devices-backup.json

# Export shadow history
aws dynamodb scan --table-name iot-shadow-management-shadow-history-dev > shadow-history-backup.json
```

## Update Existing Deployment

To update an existing deployment:

```bash
# Make changes to code or configuration

# Deploy changes
serverless deploy --stage dev --region us-east-1

# Deploy only specific function (faster)
serverless deploy function -f shadowUpdateHandler --stage dev
```

## Multi-Region Deployment

To deploy to multiple regions:

```bash
# Deploy to us-east-1
serverless deploy --stage prod --region us-east-1

# Deploy to eu-west-1
serverless deploy --stage prod --region eu-west-1

# Deploy to ap-northeast-1
serverless deploy --stage prod --region ap-northeast-1
```

Each region will have independent:
- DynamoDB tables
- Lambda functions
- IoT endpoints
- API endpoints
- Claim certificates (create separately per region)

## Production Deployment Best Practices

1. **Use separate AWS account** for production
2. **Enable CloudTrail** for audit logging
3. **Set up CloudWatch alarms** for critical metrics
4. **Enable DynamoDB point-in-time recovery**
5. **Configure DynamoDB auto-scaling** (or use on-demand)
6. **Set up SNS topics** for alerts
7. **Enable X-Ray tracing** for debugging
8. **Configure VPC endpoints** for better security
9. **Implement certificate rotation** strategy
10. **Set up backup/disaster recovery** plan

## Troubleshooting Deployment

### Issue: Deployment fails with timeout

**Solution**: Increase timeout in serverless.yml or check AWS service limits

### Issue: Permission denied errors

**Solution**: Verify AWS credentials have required permissions (CloudFormation, Lambda, DynamoDB, IoT, IAM)

### Issue: Resource already exists

**Solution**: Either use different stage/region or remove existing resources first

### Issue: Lambda function fails to create

**Solution**: Check CloudWatch Logs for specific error, verify dependencies in package.json

### Issue: IoT resources not created

**Solution**: Check CloudFormation console for detailed error messages

## Next Steps

After successful deployment:

1. Review [README.md](./README.md) for usage instructions
2. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
3. Review [COMPONENTS.md](./COMPONENTS.md) for component details
4. Set up monitoring and alerting
5. Configure production security measures
6. Test with real devices
7. Implement CI/CD pipeline

## Support

For deployment issues:

1. Check CloudFormation events in AWS Console
2. Review CloudWatch Logs
3. Verify AWS service quotas
4. Check Serverless Framework documentation
5. Open an issue in the repository
