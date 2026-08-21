import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class FreeTierStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Get default VPC
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // 2. Create Security Group for HTTP, HTTPS, SSH, and API port
    const securityGroup = new ec2.SecurityGroup(this, 'FreeTierSG', {
      vpc,
      description: 'Allow web and ssh traffic',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(4000), 'Allow Backend API');

    // 3. Create IAM Role with SSM permissions (so you can connect without SSH keys)
    const role = new iam.Role(this, 'FreeTierEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // 4. Create the t3.micro EC2 Instance (12 months free tier)
    const instance = new ec2.Instance(this, 'FreeTierInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: securityGroup,
      role: role,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(8, { volumeType: ec2.EbsDeviceVolumeType.GP3 }), // 8GB Free Tier
      }],
    });

    // 5. User Data Script: Install Docker, configure swap space, and run the backend!
    instance.addUserData(
      '#!/bin/bash',
      'set -e',
      'echo "Starting Setup..." > /var/log/setup.log',
      
      '# Add 2GB Swap Space to prevent Out of Memory during PNPM install',
      'dd if=/dev/zero of=/swapfile bs=128M count=16',
      'chmod 600 /swapfile',
      'mkswap /swapfile',
      'swapon /swapfile',
      'echo "/swapfile swap swap defaults 0 0" >> /etc/fstab',

      '# Install Docker and Git',
      'dnf update -y',
      'dnf install -y docker git',
      'systemctl enable docker',
      'systemctl start docker',
      'usermod -aG docker ec2-user',
      'curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
      'chmod +x /usr/local/bin/docker-compose',

      '# Clone Repository',
      'cd /home/ec2-user',
      'git clone https://github.com/web098cros7/Towing.git',

      '# Create Docker Compose file to run everything',
      'cat <<EOF > docker-compose.yml',
      'version: "3.8"',
      'services:',
      '  postgres:',
      '    image: postgis/postgis:16-3.4',
      '    restart: always',
      '    environment:',
      '      POSTGRES_USER: towfleet',
      '      POSTGRES_PASSWORD: towfleet',
      '      POSTGRES_DB: towfleet',
      '    ports:',
      '      - "5432:5432"',
      '    volumes:',
      '      - db_data:/var/lib/postgresql/data',
      '  redis:',
      '    image: redis:7',
      '    restart: always',
      '    ports:',
      '      - "6379:6379"',
      '  backend:',
      '    image: node:20-alpine',
      '    restart: always',
      '    working_dir: /app',
      '    volumes:',
      '      - ./Towing:/app',
      '    command: sh -c "npm install -g pnpm && pnpm install && cd apps/backend && pnpm run start:dev"',
      '    ports:',
      '      - "4000:4000"',
      '    environment:',
      '      DATABASE_URL: postgres://towfleet:towfleet@postgres:5432/towfleet',
      '      REDIS_URL: redis://redis:6379',
      '      PORT: 4000',
      '    depends_on:',
      '      - postgres',
      '      - redis',
      'volumes:',
      '  db_data:',
      'EOF',

      '# Start everything',
      'chown -R ec2-user:ec2-user /home/ec2-user',
      'docker-compose up -d',
      'echo "Setup Complete!" >> /var/log/setup.log'
    );

    // 6. Assign an Elastic IP so the IP doesn't change on reboot (Free as long as instance is running)
    const eip = new ec2.CfnEIP(this, 'FreeTierEIP', {
      instanceId: instance.instanceId,
    });

    new cdk.CfnOutput(this, 'BackendIP', {
      value: eip.ref,
      description: 'The Public IP of your Free Tier Backend',
    });
    new cdk.CfnOutput(this, 'BackendURL', {
      value: `http://${eip.ref}:4000`,
      description: 'The URL to test your backend',
    });
  }
}
