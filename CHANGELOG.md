# Changelog

All notable changes to the AWS IoT Shadow Management with Fleet Provisioning project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-14

### Added

#### Core Infrastructure
- Complete serverless infrastructure using Serverless Framework
- Production-ready AWS IoT Core integration with Device Shadows
- Fleet Provisioning system for automated device registration
- Comprehensive DynamoDB schema for device registry and shadow history

#### Fleet Provisioning
- Pre-provisioning validation hook with Lambda
- Post-provisioning automation for device setup
- Claim certificate-based device onboarding
- Unique device certificate generation per device
- Support for multiple device types (Sensor, Gateway, Actuator)
- Serial number validation and whitelist checking
- Automated thing creation and policy attachment

#### Shadow Management
- Classic shadow support for all devices
- Named shadow support for advanced use cases
- Real-time shadow delta processing
- Shadow update handlers with Lambda functions
- Automatic shadow state synchronization
- Shadow history tracking with 90-day TTL
- Support for desired and reported states

#### REST API
- Complete device management API with API Gateway
- Create device endpoint (manual provisioning)
- List devices with filtering and pagination
- Get device details endpoint
- Update device shadow endpoint
- Get device shadow (classic and named)
- Get shadow history with time range filtering

#### Device Clients
- **Python Device Client**:
  - Fleet Provisioning support
  - Shadow state management
  - Delta handling and synchronization
  - Telemetry reporting
  - Command execution
  - Automatic reconnection
  - TLS 1.2+ support

- **Node.js Device Client**:
  - Complete AWS IoT SDK v2 integration
  - Fleet Provisioning workflow
  - Shadow synchronization
  - Delta processing
  - Connection management
  - Error handling and retries

#### Database Schema
- Device Registry Table:
  - Device metadata storage
  - Certificate tracking
  - Provisioning timestamps
  - Device status management
  - GSI for serial number lookups

- Shadow History Table:
  - Time-series shadow state storage
  - Composite key (thingName + timestamp)
  - Delta tracking
  - 90-day TTL for automatic cleanup

- Provisioning Logs Table:
  - Audit trail for device provisioning
  - Request/response logging
  - Error tracking

#### Security
- X.509 certificate-based authentication
- Mutual TLS (mTLS) for all connections
- Fine-grained IoT policies for claim and device certificates
- Least privilege access control
- Pre-provisioning validation and authorization
- CloudTrail integration ready
- DynamoDB encryption at rest support

#### Monitoring & Observability
- CloudWatch Logs integration for all Lambda functions
- Structured logging with correlation IDs
- IoT Rules Engine metrics
- Shadow update tracking
- Provisioning success/failure metrics
- API Gateway access logs

#### Documentation
- Comprehensive README.md with usage examples
- Detailed ARCHITECTURE.md with system diagrams
- DEPLOYMENT.md with step-by-step deployment guide
- COMPONENTS.md with component descriptions
- Python device client documentation
- Node.js device client documentation
- API usage examples and curl commands
- Troubleshooting guides
- Security best practices
- Cost optimization tips

#### DevOps & Tooling
- npm scripts for deployment and management
- Support for multiple stages (dev, prod)
- Multi-region deployment support
- CloudFormation outputs for easy configuration
- Automated resource naming with stage prefixes
- Rollback procedures

### Features

#### Thing Registry
- Thing types: Sensor, Gateway, Actuator
- Thing groups with hierarchical organization
- Searchable device attributes
- Device metadata management

#### IoT Rules Engine
- Shadow update rule with Lambda invocation
- Shadow delta rule for device notifications
- Automatic shadow history storage
- Error handling and dead letter queues

#### API Features
- RESTful design with JSON payloads
- Query parameters for filtering
- Pagination support with lastKey
- Comprehensive error responses
- CORS support for web applications

### Configuration
- Configurable DynamoDB capacity modes
- Adjustable Lambda memory and timeout settings
- Customizable IoT policy permissions
- Flexible stage and region configuration
- Environment-based resource naming

### Examples
- Complete device provisioning flow examples
- Shadow update examples (cloud to device)
- Shadow update examples (device to cloud)
- REST API usage with curl
- AWS CLI command examples
- Python and Node.js device implementations

### Testing
- Shadow update test procedures
- API endpoint testing
- Device provisioning validation
- End-to-end integration testing guides

### Dependencies
- @aws-sdk/client-dynamodb ^3.450.0
- @aws-sdk/client-iot ^3.450.0
- @aws-sdk/client-iot-data-plane ^3.450.0
- @aws-sdk/lib-dynamodb ^3.450.0
- uuid ^9.0.1
- serverless ^3.38.0

## Version History

### [1.0.0] - 2025-11-14
- Initial release with complete IoT Shadow Management and Fleet Provisioning solution

---

## Upgrade Guide

### From Initial Setup to v1.0.0
This is the initial release. Follow the deployment guide in [DEPLOYMENT.md](./DEPLOYMENT.md) for first-time setup.

## Breaking Changes

None - Initial release

## Deprecations

None - Initial release

## Known Issues

None currently identified

## Roadmap

Future enhancements being considered:

- [ ] Add support for IoT Jobs for firmware updates
- [ ] Implement device certificate rotation
- [ ] Add GraphQL API option
- [ ] Create dashboard UI for device management
- [ ] Add support for bulk device provisioning
- [ ] Implement device groups management API
- [ ] Add WebSocket support for real-time updates
- [ ] Create Terraform alternative to Serverless Framework
- [ ] Add support for custom domains
- [ ] Implement rate limiting and throttling
- [ ] Add multi-tenancy support
- [ ] Create CloudFormation nested stacks option

## Support

For issues, questions, or contributions:
- Review existing documentation in `/docs`
- Check CloudWatch Logs for errors
- Open an issue in the repository
- Follow troubleshooting guide in README.md

---

**Note**: This changelog follows the [Keep a Changelog](https://keepachangelog.com/) format and uses [Semantic Versioning](https://semver.org/).
