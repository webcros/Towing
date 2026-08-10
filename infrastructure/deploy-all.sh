#!/bin/bash
# =============================================================
#  Towing Ecosystem — Enterprise AWS CDK Deployment Script
#  Version: 3.0 (Production-Grade, Phase 9 Compliant)
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
git config --global user.email "devops@company.com" || true
git config --global user.name "Cloud Engineer" || true

if [ ! -d "$CDK_DIR" ] || [ -z "$(ls -A $CDK_DIR)" ]; then
  mkdir -p "$CDK_DIR"
  cd "$CDK_DIR"
  npx cdk init app --language typescript
else
  cd "$CDK_DIR"
fi

npm install -D typescript tsx @types/node
npm install aws-cdk-lib@^2.150.0 constructs@^10.0.0

echo "▶ [4/8] Generating CDK stacks..."
mkdir -p lib .github/workflows

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
  dev: { env: 'dev', fargateTaskCpu: 512, fargateTaskMemoryMiB: 1024, fargateMinCapacity: 1, fargateMaxCapacity: 2, rdsInstanceType: 't3.micro', rdsMultiAz: false, rdsAllocatedStorageGb: 20, rdsBackupRetentionDays: 1, redisNodeType: 'cache.t3.micro', redisReplicasPerShard: 0, natGateways: 1, maxAzs: 2, alarmEmailEndpoint: 'devops@company.com', enableWaf: false, enableDeletionProtection: false, enableEnhancedMonitoring: false },
  staging: { env: 'staging', fargateTaskCpu: 512, fargateTaskMemoryMiB: 1024, fargateMinCapacity: 1, fargateMaxCapacity: 3, rdsInstanceType: 't3.small', rdsMultiAz: false, rdsAllocatedStorageGb: 20, rdsBackupRetentionDays: 3, redisNodeType: 'cache.t3.micro', redisReplicasPerShard: 0, natGateways: 1, maxAzs: 2, alarmEmailEndpoint: 'devops@company.com', enableWaf: true, enableDeletionProtection: false, enableEnhancedMonitoring: false },
  prod: { env: 'prod', fargateTaskCpu: 1024, fargateTaskMemoryMiB: 2048, fargateMinCapacity: 2, fargateMaxCapacity: 10, rdsInstanceType: 't3.medium', rdsMultiAz: true, rdsAllocatedStorageGb: 100, rdsBackupRetentionDays: 14, redisNodeType: 'cache.t3.small', redisReplicasPerShard: 1, natGateways: 2, maxAzs: 2, alarmEmailEndpoint: 'devops@company.com', enableWaf: true, enableDeletionProtection: true, enableEnhancedMonitoring: true }
};
export const getConfig = (env: Environment): TowingConfig => configs[env];
EOF

tee lib/vpc-stack.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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
    this.vpc.addInterfaceEndpoint('SqsEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SQS, subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } });
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
  public readonly dbEndpoint: string; public readonly dbSecret: secretsmanager.ISecret;
  public readonly redisEndpoint: string; public readonly redisPort: string;
  public readonly fargateSg: ec2.SecurityGroup;
  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);
    const { vpc, config } = props;
    
    this.fargateSg = new ec2.SecurityGroup(this, 'FargateSg', { vpc, description: 'Security group for Fargate tasks' });

    const dbSubnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', { vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, description: 'DB Subnet' });
    const dbInstance = new rds.DatabaseInstance(this, 'TowingDb', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: new ec2.InstanceType(config.rdsInstanceType), vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      subnetGroup: dbSubnetGroup, databaseName: 'towing', allocatedStorage: config.rdsAllocatedStorageGb, multiAz: config.rdsMultiAz,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      backupRetention: cdk.Duration.days(config.rdsBackupRetentionDays),
      deletionProtection: config.enableDeletionProtection,
    });
    dbInstance.connections.allowFrom(this.fargateSg, ec2.Port.tcp(5432));
    this.dbSecret = dbInstance.secret!;
    this.dbEndpoint = dbInstance.instanceEndpoint.socketAddress;
    
    const redisSg = new ec2.SecurityGroup(this, 'RedisSg', { vpc });
    redisSg.addIngressRule(this.fargateSg, ec2.Port.tcp(6379));
    
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', { description: 'Redis Subnets', subnetIds: vpc.isolatedSubnets.map(s => s.subnetId) });
    const redis = new elasticache.CfnReplicationGroup(this, 'TowingRedis', {
      replicationGroupDescription: 'Towing Redis Cache',
      engine: 'redis',
      cacheNodeType: config.redisNodeType,
      numNodeGroups: 1,
      replicasPerNodeGroup: config.redisReplicasPerShard,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [redisSg.securityGroupId],
      transitEncryptionEnabled: true,
      atRestEncryptionEnabled: true,
    });
    this.redisEndpoint = redis.attrConfigurationEndPointAddress;
    this.redisPort = redis.attrConfigurationEndPointPort;
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
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { TowingConfig } from './config';
export interface ComputeStackProps extends cdk.StackProps { vpc: ec2.Vpc; dbEndpoint: string; dbSecret: secretsmanager.ISecret; redisEndpoint: string; redisPort: string; config: TowingConfig; fargateSg: ec2.SecurityGroup; }
export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);
    const { vpc, config, fargateSg } = props;
    
    const backendRepo = new ecr.Repository(this, 'BackendRepo', { repositoryName: 'towing-backend', lifecycleRules: [{ maxImageCount: 5 }] });
    const webRepo = new ecr.Repository(this, 'WebRepo', { repositoryName: 'towfleet-web', lifecycleRules: [{ maxImageCount: 5 }] });
    const cluster = new ecs.Cluster(this, 'TowingCluster', { vpc });
    
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', { generateSecretString: { passwordLength: 64, excludePunctuation: true } });
    
    const commonEnv = {
      NODE_ENV: config.env,
      PORT: '4000',
      REDIS_URL: `rediss://${props.redisEndpoint}:${props.redisPort}`,
      DATABASE_POOL_MAX: '10',
      CORS_ORIGINS: '*',
    };
    
    // BACKEND SERVICE
    const backendTaskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', { cpu: config.fargateTaskCpu, memoryLimitMiB: config.fargateTaskMemoryMiB });
    const backendLogGroup = new logs.LogGroup(this, 'BackendLogGroup', { retention: logs.RetentionDays.ONE_MONTH });
    backendTaskDef.addContainer('towing-backend-container', { 
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'), 
      portMappings: [{ containerPort: 4000 }], 
      logging: ecs.LogDrivers.awsLogs({ logGroup: backendLogGroup, streamPrefix: 'api' }),
      environment: { ...commonEnv, DB_HOST: props.dbEndpoint, DB_PORT: '5432' },
      secrets: { DB_USER: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'), DB_PASS: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'), JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(jwtSecret) }
    });
    
    // WEB SERVICE
    const webTaskDef = new ecs.FargateTaskDefinition(this, 'WebTaskDef', { cpu: config.fargateTaskCpu, memoryLimitMiB: config.fargateTaskMemoryMiB });
    const webLogGroup = new logs.LogGroup(this, 'WebLogGroup', { retention: logs.RetentionDays.ONE_MONTH });
    webTaskDef.addContainer('towfleet-web-container', { 
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'), 
      portMappings: [{ containerPort: 3000 }], 
      logging: ecs.LogDrivers.awsLogs({ logGroup: webLogGroup, streamPrefix: 'web' }),
      environment: { NODE_ENV: config.env, PORT: '3000', NEXT_PUBLIC_USE_MOCKS: 'false', API_BASE_URL: 'http://localhost:4000' }
    });
    
    // LOAD BALANCER
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', { vpc }); albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    const alb = new elbv2.ApplicationLoadBalancer(this, 'TowingAlb', { vpc, internetFacing: true, securityGroup: albSg, idleTimeout: cdk.Duration.seconds(75) });
    
    const backendTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BackendTargetGroup', {
      vpc, port: 4000, protocol: elbv2.ApplicationProtocol.HTTP, targetType: elbv2.TargetType.IP,
      healthCheck: { path: '/v1/health', interval: cdk.Duration.seconds(30) }
    });
    
    const webTargetGroup = new elbv2.ApplicationTargetGroup(this, 'WebTargetGroup', {
      vpc, port: 3000, protocol: elbv2.ApplicationProtocol.HTTP, targetType: elbv2.TargetType.IP,
      healthCheck: { path: '/', interval: cdk.Duration.seconds(30) },
      stickinessCookieDuration: cdk.Duration.hours(24), stickinessCookieName: 'TOWING_WEB_LB_COOKIE'
    });
    
    const listener = alb.addListener('HttpListener', { port: 80, defaultAction: elbv2.ListenerAction.forward([webTargetGroup]) });
    listener.addAction('ApiRoute', { priority: 10, conditions: [elbv2.ListenerCondition.pathPatterns(['/v1/*', '/socket.io/*'])], action: elbv2.ListenerAction.forward([backendTargetGroup]) });
    
    fargateSg.addIngressRule(albSg, ec2.Port.tcp(4000));
    fargateSg.addIngressRule(albSg, ec2.Port.tcp(3000));
    
    const backendService = new ecs.FargateService(this, 'BackendService', { cluster, taskDefinition: backendTaskDef, desiredCount: config.fargateMinCapacity, securityGroups: [fargateSg] });
    backendService.attachToApplicationTargetGroup(backendTargetGroup);
    
    const webService = new ecs.FargateService(this, 'WebService', { cluster, taskDefinition: webTaskDef, desiredCount: config.fargateMinCapacity, securityGroups: [fargateSg] });
    webService.attachToApplicationTargetGroup(webTargetGroup);
    
    // MIGRATION / SEED RUN TASKS
    new ecs.FargateTaskDefinition(this, 'MigrateTaskDef', { cpu: 512, memoryLimitMiB: 1024 })
      .addContainer('migrate', { image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'), environment: { ...commonEnv, DB_HOST: props.dbEndpoint }, secrets: { DB_USER: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'), DB_PASS: ecs.Secret.fromSecretsManager(props.dbSecret, 'password') }, logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migrate' }) });
    new ecs.FargateTaskDefinition(this, 'SeedTaskDef', { cpu: 512, memoryLimitMiB: 1024 })
      .addContainer('seed', { image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'), environment: { ...commonEnv, DB_HOST: props.dbEndpoint }, secrets: { DB_USER: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'), DB_PASS: ecs.Secret.fromSecretsManager(props.dbSecret, 'password') }, logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'seed' }) });
  }
}
EOF

tee bin/towing-aws-infra.ts > /dev/null << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ComputeStack } from '../lib/compute-stack';
import { getConfig, Environment } from '../lib/config';

const app = new cdk.App();
const envName = (process.env.APP_ENV || 'dev') as Environment;
const config = getConfig(envName);
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const vpcStack = new VpcStack(app, 'VpcStack', { env, config });
const dbStack = new DatabaseStack(app, 'DbStack', { env, config, vpc: vpcStack.vpc });
const computeStack = new ComputeStack(app, 'ComputeStack', { env, config, vpc: vpcStack.vpc, dbEndpoint: dbStack.dbEndpoint, dbSecret: dbStack.dbSecret, redisEndpoint: dbStack.redisEndpoint, redisPort: dbStack.redisPort, fargateSg: dbStack.fargateSg });
EOF

echo "▶ [5/8] Bootstrapping AWS Environment..."
npx cdk bootstrap

echo "▶ [6/8] Deploying Infrastructure..."
APP_ENV=$ENVIRONMENT npx cdk deploy --all --require-approval never

echo "=========================================================="
echo " DEPLOYMENT COMPLETE FOR $ENVIRONMENT!"
echo "=========================================================="
