#!/usr/bin/env python3
"""
AWS IoT Device Client with Fleet Provisioning and Shadow Management

This example demonstrates:
1. Fleet Provisioning to register a device
2. Shadow updates (reported state)
3. Shadow delta handling (desired state changes)
4. Telemetry publishing

Requirements:
    pip install awsiotsdk
"""

import json
import time
import uuid
import argparse
from datetime import datetime
from awscrt import mqtt
from awsiot import mqtt_connection_builder
from awsiot.iotidentity import (
    IotIdentityClient,
    CreateKeysAndCertificateRequest,
    RegisterThingRequest
)
from awsiot.iotshadow import (
    IotShadowClient,
    UpdateShadowRequest,
    UpdateShadowSubscriptionRequest,
    GetShadowRequest,
    ShadowState
)


class IoTDevice:
    """IoT Device with Fleet Provisioning and Shadow Management"""

    def __init__(self, endpoint, claim_cert, claim_key, root_ca, template_name):
        self.endpoint = endpoint
        self.claim_cert = claim_cert
        self.claim_key = claim_key
        self.root_ca = root_ca
        self.template_name = template_name

        self.mqtt_connection = None
        self.identity_client = None
        self.shadow_client = None

        self.thing_name = None
        self.device_cert = None
        self.device_key = None

        self.is_provisioned = False

    def connect_with_claim_cert(self):
        """Connect to AWS IoT using claim certificate for provisioning"""
        print("Connecting with claim certificate...")

        self.mqtt_connection = mqtt_connection_builder.mtls_from_path(
            endpoint=self.endpoint,
            cert_filepath=self.claim_cert,
            pri_key_filepath=self.claim_key,
            ca_filepath=self.root_ca,
            client_id=f"provision-{uuid.uuid4()}",
            clean_session=False,
            keep_alive_secs=30
        )

        connect_future = self.mqtt_connection.connect()
        connect_future.result()
        print("Connected with claim certificate!")

        self.identity_client = IotIdentityClient(self.mqtt_connection)

    def provision_device(self, serial_number, device_type):
        """Provision device using Fleet Provisioning"""
        print(f"Starting Fleet Provisioning for {device_type}-{serial_number}...")

        # Step 1: Create keys and certificate
        print("Creating keys and certificate...")
        create_cert_future = self.identity_client.subscribe_to_create_keys_and_certificate_accepted(
            request=CreateKeysAndCertificateRequest(),
            qos=mqtt.QoS.AT_LEAST_ONCE,
            callback=self.on_create_keys_and_certificate_accepted
        )
        create_cert_future.result()

        create_cert_rejected_future = self.identity_client.subscribe_to_create_keys_and_certificate_rejected(
            request=CreateKeysAndCertificateRequest(),
            qos=mqtt.QoS.AT_LEAST_ONCE,
            callback=self.on_create_keys_and_certificate_rejected
        )
        create_cert_rejected_future.result()

        # Publish create certificate request
        publish_future = self.identity_client.publish_create_keys_and_certificate(
            request=CreateKeysAndCertificateRequest(),
            qos=mqtt.QoS.AT_LEAST_ONCE
        )
        publish_future.result()

        # Wait for certificate creation
        time.sleep(2)

        # Step 2: Register thing
        if self.device_cert and self.device_key:
            print("Registering thing...")

            register_future = self.identity_client.subscribe_to_register_thing_accepted(
                request=RegisterThingRequest(
                    template_name=self.template_name,
                    parameters={
                        "SerialNumber": serial_number,
                        "DeviceType": device_type
                    }
                ),
                qos=mqtt.QoS.AT_LEAST_ONCE,
                callback=self.on_register_thing_accepted
            )
            register_future.result()

            register_rejected_future = self.identity_client.subscribe_to_register_thing_rejected(
                request=RegisterThingRequest(
                    template_name=self.template_name
                ),
                qos=mqtt.QoS.AT_LEAST_ONCE,
                callback=self.on_register_thing_rejected
            )
            register_rejected_future.result()

            # Publish register thing request
            publish_register = self.identity_client.publish_register_thing(
                request=RegisterThingRequest(
                    template_name=self.template_name,
                    parameters={
                        "SerialNumber": serial_number,
                        "DeviceType": device_type
                    }
                ),
                qos=mqtt.QoS.AT_LEAST_ONCE
            )
            publish_register.result()

            # Wait for registration
            time.sleep(3)

            if self.is_provisioned and self.thing_name:
                print(f"Device provisioned successfully! Thing name: {self.thing_name}")
                return True
            else:
                print("Provisioning failed!")
                return False
        else:
            print("Failed to create certificate!")
            return False

    def on_create_keys_and_certificate_accepted(self, response):
        """Callback for successful certificate creation"""
        print("Certificate created successfully!")
        self.device_cert = response.certificate_pem
        self.device_key = response.private_key

        # Save certificate and key to files
        with open('device-cert.pem', 'w') as f:
            f.write(self.device_cert)
        with open('device-key.pem', 'w') as f:
            f.write(self.device_key)

        print("Saved device certificate and key to files")

    def on_create_keys_and_certificate_rejected(self, error):
        """Callback for certificate creation failure"""
        print(f"Certificate creation rejected: {error}")

    def on_register_thing_accepted(self, response):
        """Callback for successful thing registration"""
        print("Thing registered successfully!")
        self.thing_name = response.thing_name
        self.is_provisioned = True
        print(f"Thing Name: {self.thing_name}")

    def on_register_thing_rejected(self, error):
        """Callback for thing registration failure"""
        print(f"Thing registration rejected: {error}")

    def connect_with_device_cert(self):
        """Reconnect using device certificate after provisioning"""
        if self.mqtt_connection:
            disconnect_future = self.mqtt_connection.disconnect()
            disconnect_future.result()

        print("Connecting with device certificate...")

        self.mqtt_connection = mqtt_connection_builder.mtls_from_path(
            endpoint=self.endpoint,
            cert_filepath='device-cert.pem',
            pri_key_filepath='device-key.pem',
            ca_filepath=self.root_ca,
            client_id=self.thing_name,
            clean_session=False,
            keep_alive_secs=30
        )

        connect_future = self.mqtt_connection.connect()
        connect_future.result()
        print("Connected with device certificate!")

        # Initialize shadow client
        self.shadow_client = IotShadowClient(self.mqtt_connection)

    def subscribe_to_shadow_delta(self):
        """Subscribe to shadow delta updates"""
        print("Subscribing to shadow delta...")

        delta_future = self.shadow_client.subscribe_to_shadow_delta_updated_events(
            request=UpdateShadowSubscriptionRequest(thing_name=self.thing_name),
            qos=mqtt.QoS.AT_LEAST_ONCE,
            callback=self.on_shadow_delta
        )
        delta_future.result()
        print("Subscribed to shadow delta!")

    def on_shadow_delta(self, delta):
        """Handle shadow delta (desired state changes)"""
        print(f"\n=== Shadow Delta Received ===")
        print(f"Delta: {json.dumps(delta.state, indent=2)}")

        # Handle specific delta changes
        if delta.state:
            # Example: Handle firmware update
            if 'firmware' in delta.state:
                firmware = delta.state['firmware']
                print(f"Firmware update requested: {firmware.get('version')}")
                # TODO: Implement firmware update logic

            # Example: Handle configuration change
            if 'config' in delta.state:
                config = delta.state['config']
                print(f"Configuration update: {config}")
                # TODO: Apply new configuration

            # Example: Handle command
            if 'command' in delta.state:
                command = delta.state['command']
                print(f"Command received: {command}")
                self.execute_command(command)

        # Update reported state to match desired state
        self.update_reported_state(delta.state)

    def execute_command(self, command):
        """Execute remote command"""
        action = command.get('action')
        print(f"Executing command: {action}")

        if action == 'reboot':
            print("Rebooting device...")
            # TODO: Implement reboot
        elif action == 'reset':
            print("Resetting device...")
            # TODO: Implement reset
        elif action == 'diagnostics':
            print("Running diagnostics...")
            # TODO: Implement diagnostics
        else:
            print(f"Unknown command: {action}")

    def update_reported_state(self, state):
        """Update shadow reported state"""
        print(f"Updating reported state...")

        shadow_state = ShadowState(
            reported=state
        )

        request = UpdateShadowRequest(
            thing_name=self.thing_name,
            state=shadow_state
        )

        update_future = self.shadow_client.publish_update_shadow(
            request=request,
            qos=mqtt.QoS.AT_LEAST_ONCE
        )
        update_future.result()
        print("Reported state updated!")

    def publish_telemetry(self, telemetry_data):
        """Publish telemetry data and update shadow"""
        print(f"Publishing telemetry...")

        # Update shadow with telemetry and status
        reported = {
            'connected': True,
            'timestamp': datetime.utcnow().isoformat(),
            'telemetry': telemetry_data,
            'status': 'online'
        }

        shadow_state = ShadowState(reported=reported)
        request = UpdateShadowRequest(
            thing_name=self.thing_name,
            state=shadow_state
        )

        update_future = self.shadow_client.publish_update_shadow(
            request=request,
            qos=mqtt.QoS.AT_LEAST_ONCE
        )
        update_future.result()
        print("Telemetry published!")

    def run(self, serial_number, device_type):
        """Main device loop"""
        try:
            # Step 1: Connect with claim certificate
            self.connect_with_claim_cert()

            # Step 2: Provision device
            if self.provision_device(serial_number, device_type):
                # Step 3: Reconnect with device certificate
                self.connect_with_device_cert()

                # Step 4: Subscribe to shadow delta
                self.subscribe_to_shadow_delta()

                # Step 5: Main loop - publish telemetry
                print("\nStarting main loop...")
                while True:
                    # Simulate sensor data
                    telemetry = {
                        'temperature': 25.5,
                        'humidity': 60,
                        'battery': 85,
                        'uptime': int(time.time())
                    }

                    self.publish_telemetry(telemetry)
                    time.sleep(30)  # Publish every 30 seconds

            else:
                print("Device provisioning failed!")

        except KeyboardInterrupt:
            print("\nShutting down...")
        except Exception as e:
            print(f"Error: {e}")
            raise
        finally:
            if self.mqtt_connection:
                disconnect_future = self.mqtt_connection.disconnect()
                disconnect_future.result()
                print("Disconnected!")


def main():
    parser = argparse.ArgumentParser(description='IoT Device Client with Fleet Provisioning')
    parser.add_argument('--endpoint', required=True, help='AWS IoT endpoint')
    parser.add_argument('--claim-cert', required=True, help='Claim certificate path')
    parser.add_argument('--claim-key', required=True, help='Claim private key path')
    parser.add_argument('--root-ca', required=True, help='Root CA certificate path')
    parser.add_argument('--template-name', required=True, help='Provisioning template name')
    parser.add_argument('--serial-number', required=True, help='Device serial number')
    parser.add_argument('--device-type', required=True, choices=['Sensor', 'Gateway', 'Actuator'],
                        help='Device type')

    args = parser.parse_args()

    device = IoTDevice(
        endpoint=args.endpoint,
        claim_cert=args.claim_cert,
        claim_key=args.claim_key,
        root_ca=args.root_ca,
        template_name=args.template_name
    )

    device.run(args.serial_number, args.device_type)


if __name__ == '__main__':
    main()
