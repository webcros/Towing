#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FreeTierStack } from '../lib/ec2-free-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

new FreeTierStack(app, 'TowingFreeTierStack', {
  env,
  description: '$0/Month Free Tier Stack for Development',
});
