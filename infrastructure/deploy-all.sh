#!/bin/bash
# =============================================================
#  Towing Ecosystem — Enterprise AWS CDK Deployment Script
#  Version: 2.0 (Production-Grade, Phase 1 MVP)
#  Author: Cloud Architecture Team
# =============================================================
set -euo pipefail

ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
CDK_DIR="./towing-aws-infra"

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
  echo "❌ Invalid environment. Use: dev | staging | prod"
  exit 1
fi

echo "▶ [1/8] Running pre-flight checks..."
if ! command -v aws &> /dev/null; then echo "❌ AWS CLI not found."; exit 1; fi
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "▶ [2/8] Installing AWS CDK..."
if ! command -v cdk &> /dev/null; then npm install -g aws-cdk@latest; fi

echo "▶ [3/8] Setting up CDK project..."
# Set dummy git config to prevent cdk init git failure in CloudShell
git config --global user.email "devops@company.com" || true
git config --global user.name "Cloud Engineer" || true

if [ ! -d "$CDK_DIR" ] || [ -z "$(ls -A $CDK_DIR)" ]; then
  mkdir -p "$CDK_DIR"
  cd "$CDK_DIR"
  npx cdk init app --language typescript
else
  cd "$CDK_DIR"
fi

# Explicitly install typescript and tsx to prevent 'fileExists' crash
npm install -D typescript tsx @types/node
npm install aws-cdk-lib@^2.150.0 constructs@^10.0.0 @aws-cdk/aws-amplify-alpha@^2.150.0-alpha.0

echo "▶ [4/8] Generating CDK stacks..."
mkdir -p lib .github/workflows

# Use tee instead of cat to comply with strict shell scripting rules

tee cdk.json > /dev/null << 'EOF'
{
  "app": "npx tsx bin/towing-aws-infra.ts",
  "watch": { "include": ["**"], "exclude": ["README.md", "cdk*.json", "**/*.js", "node_modules", "cdk.out"] }
}
EOF

tee lib/config.ts > /dev/null << 'EOF'
export type Environment = 'dev' | 'staging' | 'prod';
export interface TowingConfig {
  env: Environment; fargateTaskCpu: number; fargateTaskMemoryMiB: number; fargateMinCapacity: number; fargateMaxCapacity: number;
  rdsInstanceType: string; rdsMultiAz: boolean; rdsAllocatedStorageGb: number; rdsBackupRetentionDays: number;
  redisNodeType: string; redisReplicasPerShard: number; natGateways: number; maxAzs: number; alarmEmailEndpoint: string;
  enableWaf: boolean; enableDeletionProtection: boolean; enableEnhancedMonitoring: boolean;
}
const configs: Record<Environment, TowingConfig> = {
  dev: { env: 'dev', fargateTaskCpu: 512, fargateTaskMemoryMiB: 1024, fargateMinCapacity: 1, fargateMaxCapacity: 2, rdsInstanceType: 'db.t2.micro', rdsMultiAz: false, rdsAllocatedStorageGb: 20, rdsBackupRetentionDays: 1, redisNodeType: 'cache.t2.micro', redisReplicasPerShard: 0, natGateways: 1, maxAzs: 2, alarmEmailEndpoint: 'devops@company.com', enableWaf: false, enableDeletionProtection: false, enableEnhancedMonitoring: false },
  staging: { env: 'staging', fargateTaskCpu: 512, fargateTaskMemoryMiB: 1024, fargateMinCapacity: 1, fargateMaxCapacity: 3, rdsInstanceType: 'db.t3.small', rdsMultiAz: false, rdsAllocatedStorageGb: 20, rdsBackupRetentionDays: 3, redisNodeType: 'cache.t3.micro', redisReplicasPerShard: 0, natGateways: 1, maxAzs: 2, alarmEmailEndpoint: 'devops@company.com', enableWaf: true, enableDeletionProtection: false, enableEnhancedMonitoring: false },
  prod: { env: 'prod', fargateTaskCpu: 1024, fargateTaskMemoryMiB: 2048, fargateMinCapacity: 2, fargateMaxCapacity: 10, rdsInstanceType: 'db.t3.medium', rdsMultiAz: true, rdsAllocatedStorageGb: 100, rdsBackupRetentionDays: 14, redisNodeType: 'cache.t3.small', redisReplicasPerShard: 1, natGateways: 2, maxAzs: 2, alarmEmailEndpoint: 'devops@company.com', enableWaf: true, enableDeletionProtection: true, enableEnhancedMonitoring: true }
};
export const getConfig = (env: Environment): TowingConfig => configs[env];
EOF

tee lib/vpc-stack.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { TowingConfig } from './config';
export interface VpcStackProps extends cdk.StackProps { config: TowingConfig; }
export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);
    const { config } = props;
    this.vpc = new ec2.Vpc(this, 'TowingVpc', {
      maxAzs: config.maxAzs, natGateways: config.natGateways,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED }
      ]
    });
    this.vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    this.vpc.addInterfaceEndpoint('SecretsEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER, subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } });
    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER, subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } });
    this.vpc.addInterfaceEndpoint('EcrEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.ECR, subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } });
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS, subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } });
  }
}
EOF

tee lib/database-stack.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { TowingConfig } from './config';
export interface DatabaseStackProps extends cdk.StackProps { vpc: ec2.Vpc; config: TowingConfig; }
export class DatabaseStack extends cdk.Stack {
  public readonly dbProxyEndpoint: string; public readonly dbSecret: secretsmanager.ISecret;
  public readonly redisEndpoint: string; public readonly redisPort: string;
  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);
    const { vpc, config } = props;
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', { vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, description: 'DB Subnet' });
    const dbInstance = new rds.DatabaseInstance(this, 'TowingDb', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: new ec2.InstanceType(config.rdsInstanceType), vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      subnetGroup: dbSubnetGroup, databaseName: 'towing', allocatedStorage: config.rdsAllocatedStorageGb, multiAz: config.rdsMultiAz,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
    });
    this.dbSecret = dbInstance.secret!;
    const dbProxy = new rds.DatabaseProxy(this, 'TowingDbProxy', { proxyTarget: rds.ProxyTarget.fromInstance(dbInstance), secrets: [this.dbSecret], vpc });
    this.dbProxyEndpoint = dbProxy.endpoint;
    
    const redisSg = new ec2.SecurityGroup(this, 'RedisSg', { vpc });
    redisSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(6379));
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnet', { description: 'Redis Subnet', subnetIds: vpc.privateSubnets.map(s => s.subnetId) });
    const redis = new elasticache.CfnCacheCluster(this, 'TowingRedis', { engine: 'redis', cacheNodeType: config.redisNodeType, numCacheNodes: 1, cacheSubnetGroupName: redisSubnetGroup.ref, vpcSecurityGroupIds: [redisSg.securityGroupId] });
    this.redisEndpoint = redis.attrRedisEndpointAddress; this.redisPort = redis.attrRedisEndpointPort;
  }
}
EOF

tee lib/storage-event-stack.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { TowingConfig } from './config';
export class StorageEventStack extends cdk.Stack {
  public readonly kycBucket: s3.Bucket; public readonly publicBucket: s3.Bucket; public readonly notificationQueue: sqs.Queue;
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    this.kycBucket = new s3.Bucket(this, 'KycBucket', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.KMS_MANAGED });
    this.publicBucket = new s3.Bucket(this, 'PublicAssets', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL });
    this.notificationQueue = new sqs.Queue(this, 'NotificationQueue');
  }
}
EOF

tee lib/compute-stack.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { TowingConfig } from './config';
export interface ComputeStackProps extends cdk.StackProps { vpc: ec2.Vpc; dbProxyEndpoint: string; dbSecret: secretsmanager.ISecret; redisEndpoint: string; redisPort: string; kycBucket: s3.Bucket; publicBucket: s3.Bucket; notificationQueue: sqs.Queue; config: TowingConfig; }
export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);
    const { vpc, config } = props;
    const ecrRepo = new ecr.Repository(this, 'BackendRepo', { repositoryName: 'towing-backend', lifecycleRules: [{ maxImageCount: 5 }] });
    const cluster = new ecs.Cluster(this, 'TowingCluster', { vpc });
    
    const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', { cpu: config.fargateTaskCpu, memoryLimitMiB: config.fargateTaskMemoryMiB });
    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', { retention: logs.RetentionDays.ONE_MONTH });
    const container = taskDef.addContainer('towing-backend-container', { 
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'), 
      portMappings: [{ containerPort: 3000 }], 
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'api' }),
      environment: { NODE_ENV: config.env },
      secrets: { DB_CRED: ecs.Secret.fromSecretsManager(props.dbSecret) }
    });
    
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', { vpc }); albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    const alb = new elbv2.ApplicationLoadBalancer(this, 'TowingAlb', { vpc, internetFacing: true, securityGroup: albSg });
    
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      vpc, port: 3000, protocol: elbv2.ApplicationProtocol.HTTP, targetType: elbv2.TargetType.IP,
      healthCheck: { path: '/health', interval: cdk.Duration.seconds(30) },
      stickinessCookieDuration: cdk.Duration.hours(24), stickinessCookieName: 'TOWING_LB_COOKIE'
    });
    alb.addListener('HttpListener', { port: 80, defaultAction: elbv2.ListenerAction.forward([targetGroup]) });
    
    const fargateSg = new ec2.SecurityGroup(this, 'FargateSg', { vpc }); fargateSg.addIngressRule(albSg, ec2.Port.tcp(3000));
    const service = new ecs.FargateService(this, 'ApiService', { cluster, taskDefinition: taskDef, desiredCount: config.fargateMinCapacity, securityGroups: [fargateSg] });
    service.attachToApplicationTargetGroup(targetGroup);
    
    if (config.enableWaf) {
      const waf = new wafv2.CfnWebACL(this, 'TowingWaf', { defaultAction: { allow: {} }, scope: 'REGIONAL', visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'WAF', sampledRequestsEnabled: true }, rules: [] });
      new wafv2.CfnWebACLAssociation(this, 'WafAssoc', { resourceArn: alb.loadBalancerArn, webAclArn: waf.attrArn });
    }
  }
}
EOF

tee lib/monitoring-stack.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { TowingConfig } from './config';
export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps & { config: TowingConfig }) {
    super(scope, id, props);
    const dashboard = new cloudwatch.Dashboard(this, 'SloDashboard', { dashboardName: `Towing-${props.config.env}-SLO` });
    // Add latency and error rate widgets here
  }
}
EOF

tee bin/towing-aws-infra.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { DatabaseStack } from '../lib/database-stack';
import { StorageEventStack } from '../lib/storage-event-stack';
import { ComputeStack } from '../lib/compute-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { getConfig, Environment } from '../lib/config';

const app = new cdk.App();
const envName = (process.env.APP_ENV || 'dev') as Environment;
const config = getConfig(envName);
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const vpcStack = new VpcStack(app, 'VpcStack', { env, config });
const dbStack = new DatabaseStack(app, 'DbStack', { env, config, vpc: vpcStack.vpc });
const storageStack = new StorageEventStack(app, 'StorageStack', { env, config });
const computeStack = new ComputeStack(app, 'ComputeStack', { env, config, vpc: vpcStack.vpc, dbProxyEndpoint: dbStack.dbProxyEndpoint, dbSecret: dbStack.dbSecret, redisEndpoint: dbStack.redisEndpoint, redisPort: dbStack.redisPort, kycBucket: storageStack.kycBucket, publicBucket: storageStack.publicBucket, notificationQueue: storageStack.notificationQueue });
new MonitoringStack(app, 'MonitoringStack', { env, config });
EOF

echo "▶ [5/8] Generating GitHub Actions pipeline..."
tee .github/workflows/deploy-backend.yml > /dev/null << 'EOF'
name: Deploy Backend
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Dummy build and push
        run: echo "Replace with actual ECR login and docker push"
EOF

echo "▶ [6/8] Bootstrapping AWS Environment..."
npx cdk bootstrap

echo "▶ [7/8] Deploying Infrastructure..."
APP_ENV=$ENVIRONMENT npx cdk deploy --all --require-approval never

echo "=========================================================="
echo " DEPLOYMENT COMPLETE FOR $ENVIRONMENT!"
echo "=========================================================="
