#!/usr/bin/env node

/**
 * AWS IoT Device Client with Fleet Provisioning and Shadow Management
 *
 * This example demonstrates:
 * 1. Fleet Provisioning to register a device
 * 2. Shadow updates (reported state)
 * 3. Shadow delta handling (desired state changes)
 * 4. Telemetry publishing
 */

const mqtt = require('aws-iot-device-sdk-v2');
const { iot, iotidentity, iotshadow } = mqtt;
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

class IoTDevice {
    constructor(config) {
        this.config = config;
        this.connection = null;
        this.identityClient = null;
        this.shadowClient = null;

        this.thingName = null;
        this.deviceCert = null;
        this.deviceKey = null;
        this.isProvisioned = false;
    }

    /**
     * Connect to AWS IoT using claim certificate for provisioning
     */
    async connectWithClaimCert() {
        console.log('Connecting with claim certificate...');

        const configBuilder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(
            this.config.claimCert,
            this.config.claimKey
        );

        configBuilder.with_clean_session(false);
        configBuilder.with_client_id(`provision-${uuidv4()}`);
        configBuilder.with_endpoint(this.config.endpoint);
        configBuilder.with_ca_filepath(this.config.rootCA);
        configBuilder.with_keep_alive_seconds(30);

        const mqttConfig = configBuilder.build();
        const client = new mqtt.MqttClientConnection(mqttConfig);

        this.connection = client;
        await this.connection.connect();
        console.log('Connected with claim certificate!');

        this.identityClient = new iotidentity.IotIdentityClient(this.connection);
    }

    /**
     * Provision device using Fleet Provisioning
     */
    async provisionDevice() {
        console.log(`Starting Fleet Provisioning for ${this.config.deviceType}-${this.config.serialNumber}...`);

        // Step 1: Create keys and certificate
        console.log('Creating keys and certificate...');

        await this.identityClient.subscribeToCreateKeysAndCertificateAccepted(
            {},
            mqtt.QoS.AtLeastOnce,
            (error, response) => {
                if (error) {
                    console.error('Error on certificate accepted:', error);
                    return;
                }
                this.onCreateKeysAndCertificateAccepted(response);
            }
        );

        await this.identityClient.subscribeToCreateKeysAndCertificateRejected(
            {},
            mqtt.QoS.AtLeastOnce,
            (error, response) => {
                if (error) {
                    console.error('Error on certificate rejected:', error);
                    return;
                }
                this.onCreateKeysAndCertificateRejected(response);
            }
        );

        await this.identityClient.publishCreateKeysAndCertificate(
            {},
            mqtt.QoS.AtLeastOnce
        );

        // Wait for certificate creation
        await this.sleep(2000);

        // Step 2: Register thing
        if (this.deviceCert && this.deviceKey) {
            console.log('Registering thing...');

            await this.identityClient.subscribeToRegisterThingAccepted(
                { templateName: this.config.templateName },
                mqtt.QoS.AtLeastOnce,
                (error, response) => {
                    if (error) {
                        console.error('Error on register thing accepted:', error);
                        return;
                    }
                    this.onRegisterThingAccepted(response);
                }
            );

            await this.identityClient.subscribeToRegisterThingRejected(
                { templateName: this.config.templateName },
                mqtt.QoS.AtLeastOnce,
                (error, response) => {
                    if (error) {
                        console.error('Error on register thing rejected:', error);
                        return;
                    }
                    this.onRegisterThingRejected(response);
                }
            );

            await this.identityClient.publishRegisterThing({
                templateName: this.config.templateName,
                parameters: {
                    SerialNumber: this.config.serialNumber,
                    DeviceType: this.config.deviceType
                }
            }, mqtt.QoS.AtLeastOnce);

            // Wait for registration
            await this.sleep(3000);

            if (this.isProvisioned && this.thingName) {
                console.log(`Device provisioned successfully! Thing name: ${this.thingName}`);
                return true;
            } else {
                console.log('Provisioning failed!');
                return false;
            }
        } else {
            console.log('Failed to create certificate!');
            return false;
        }
    }

    onCreateKeysAndCertificateAccepted(response) {
        console.log('Certificate created successfully!');
        this.deviceCert = response.certificatePem;
        this.deviceKey = response.privateKey;

        // Save certificate and key to files
        fs.writeFileSync('device-cert.pem', this.deviceCert);
        fs.writeFileSync('device-key.pem', this.deviceKey);

        console.log('Saved device certificate and key to files');
    }

    onCreateKeysAndCertificateRejected(error) {
        console.error('Certificate creation rejected:', error);
    }

    onRegisterThingAccepted(response) {
        console.log('Thing registered successfully!');
        this.thingName = response.thingName;
        this.isProvisioned = true;
        console.log(`Thing Name: ${this.thingName}`);
    }

    onRegisterThingRejected(error) {
        console.error('Thing registration rejected:', error);
    }

    /**
     * Reconnect using device certificate after provisioning
     */
    async connectWithDeviceCert() {
        // Disconnect claim certificate connection
        await this.connection.disconnect();

        console.log('Connecting with device certificate...');

        const configBuilder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(
            'device-cert.pem',
            'device-key.pem'
        );

        configBuilder.with_clean_session(false);
        configBuilder.with_client_id(this.thingName);
        configBuilder.with_endpoint(this.config.endpoint);
        configBuilder.with_ca_filepath(this.config.rootCA);
        configBuilder.with_keep_alive_seconds(30);

        const mqttConfig = configBuilder.build();
        const client = new mqtt.MqttClientConnection(mqttConfig);

        this.connection = client;
        await this.connection.connect();
        console.log('Connected with device certificate!');

        // Initialize shadow client
        this.shadowClient = new iotshadow.IotShadowClient(this.connection);
    }

    /**
     * Subscribe to shadow delta updates
     */
    async subscribeToShadowDelta() {
        console.log('Subscribing to shadow delta...');

        await this.shadowClient.subscribeToShadowDeltaUpdatedEvents(
            { thingName: this.thingName },
            mqtt.QoS.AtLeastOnce,
            (error, response) => {
                if (error) {
                    console.error('Error on shadow delta:', error);
                    return;
                }
                this.onShadowDelta(response);
            }
        );

        console.log('Subscribed to shadow delta!');
    }

    /**
     * Handle shadow delta (desired state changes)
     */
    onShadowDelta(delta) {
        console.log('\n=== Shadow Delta Received ===');
        console.log('Delta:', JSON.stringify(delta.state, null, 2));

        // Handle specific delta changes
        if (delta.state) {
            // Example: Handle firmware update
            if (delta.state.firmware) {
                console.log(`Firmware update requested: ${delta.state.firmware.version}`);
                // TODO: Implement firmware update logic
            }

            // Example: Handle configuration change
            if (delta.state.config) {
                console.log(`Configuration update:`, delta.state.config);
                // TODO: Apply new configuration
            }

            // Example: Handle command
            if (delta.state.command) {
                console.log(`Command received:`, delta.state.command);
                this.executeCommand(delta.state.command);
            }
        }

        // Update reported state to match desired state
        this.updateReportedState(delta.state);
    }

    /**
     * Execute remote command
     */
    executeCommand(command) {
        const action = command.action;
        console.log(`Executing command: ${action}`);

        switch (action) {
            case 'reboot':
                console.log('Rebooting device...');
                // TODO: Implement reboot
                break;
            case 'reset':
                console.log('Resetting device...');
                // TODO: Implement reset
                break;
            case 'diagnostics':
                console.log('Running diagnostics...');
                // TODO: Implement diagnostics
                break;
            default:
                console.log(`Unknown command: ${action}`);
        }
    }

    /**
     * Update shadow reported state
     */
    async updateReportedState(state) {
        console.log('Updating reported state...');

        try {
            await this.shadowClient.publishUpdateShadow({
                thingName: this.thingName,
                state: {
                    reported: state
                }
            }, mqtt.QoS.AtLeastOnce);

            console.log('Reported state updated!');
        } catch (error) {
            console.error('Error updating reported state:', error);
        }
    }

    /**
     * Publish telemetry data and update shadow
     */
    async publishTelemetry(telemetryData) {
        console.log('Publishing telemetry...');

        const reported = {
            connected: true,
            timestamp: new Date().toISOString(),
            telemetry: telemetryData,
            status: 'online'
        };

        try {
            await this.shadowClient.publishUpdateShadow({
                thingName: this.thingName,
                state: {
                    reported: reported
                }
            }, mqtt.QoS.AtLeastOnce);

            console.log('Telemetry published!');
        } catch (error) {
            console.error('Error publishing telemetry:', error);
        }
    }

    /**
     * Main device loop
     */
    async run() {
        try {
            // Step 1: Connect with claim certificate
            await this.connectWithClaimCert();

            // Step 2: Provision device
            if (await this.provisionDevice()) {
                // Step 3: Reconnect with device certificate
                await this.connectWithDeviceCert();

                // Step 4: Subscribe to shadow delta
                await this.subscribeToShadowDelta();

                // Step 5: Main loop - publish telemetry
                console.log('\nStarting main loop...');
                this.telemetryInterval = setInterval(async () => {
                    // Simulate sensor data
                    const telemetry = {
                        temperature: 25.5 + Math.random() * 2,
                        humidity: 60 + Math.random() * 10,
                        battery: 85 - Math.random() * 5,
                        uptime: Math.floor(Date.now() / 1000)
                    };

                    await this.publishTelemetry(telemetry);
                }, 30000); // Publish every 30 seconds
            } else {
                console.log('Device provisioning failed!');
                process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }

    /**
     * Cleanup
     */
    async cleanup() {
        console.log('\nShutting down...');

        if (this.telemetryInterval) {
            clearInterval(this.telemetryInterval);
        }

        if (this.connection) {
            await this.connection.disconnect();
            console.log('Disconnected!');
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main
async function main() {
    const args = require('yargs')
        .option('endpoint', {
            describe: 'AWS IoT endpoint',
            type: 'string',
            demandOption: true
        })
        .option('claim-cert', {
            describe: 'Claim certificate path',
            type: 'string',
            demandOption: true
        })
        .option('claim-key', {
            describe: 'Claim private key path',
            type: 'string',
            demandOption: true
        })
        .option('root-ca', {
            describe: 'Root CA certificate path',
            type: 'string',
            demandOption: true
        })
        .option('template-name', {
            describe: 'Provisioning template name',
            type: 'string',
            demandOption: true
        })
        .option('serial-number', {
            describe: 'Device serial number',
            type: 'string',
            demandOption: true
        })
        .option('device-type', {
            describe: 'Device type',
            type: 'string',
            choices: ['Sensor', 'Gateway', 'Actuator'],
            demandOption: true
        })
        .argv;

    const device = new IoTDevice({
        endpoint: args.endpoint,
        claimCert: args['claim-cert'],
        claimKey: args['claim-key'],
        rootCA: args['root-ca'],
        templateName: args['template-name'],
        serialNumber: args['serial-number'],
        deviceType: args['device-type']
    });

    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
        await device.cleanup();
        process.exit(0);
    });

    await device.run();
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = IoTDevice;
