const { SSMClient, SendCommandCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ region: 'ap-south-1' });
const compose = `version: "3.8"
services:
  postgres:
    image: postgis/postgis:16-3.4
    restart: always
    environment:
      POSTGRES_USER: towfleet
      POSTGRES_PASSWORD: towfleet
      POSTGRES_DB: towfleet
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
  redis:
    image: redis:7
    restart: always
    ports:
      - "6379:6379"
  backend:
    image: node:22-alpine
    restart: always
    working_dir: /app
    volumes:
      - ./Towing:/app
    command: sh -c "npm install -g pnpm && pnpm install && sleep 10 && pnpm run build && cd apps/backend && pnpm run db:migrate && node dist/main.js"
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgres://towfleet:towfleet@postgres:5432/towfleet
      REDIS_URL: redis://redis:6379
      PORT: 4000
      NODE_OPTIONS: --max-old-space-size=1536
      JWT_ACCESS_SECRET: default_secret_key_12345678901234567890
      FILE_SIGNING_SECRET: default_file_key_12345678901234567890
      JWT_REFRESH_SECRET: default_refresh_key_12345678901234567890
    depends_on:
      - postgres
      - redis
volumes:
  db_data:
`;

const b64 = Buffer.from(compose).toString('base64');

async function run() {
  const cmd = new SendCommandCommand({
    InstanceIds: ['i-08c7c082464d3499a'],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [
        `echo ${b64} | base64 -d > /home/ec2-user/docker-compose.yml`,
        'cd /home/ec2-user',
        'docker-compose down',
        'docker-compose up -d'
      ]
    }
  });
  const res = await ssm.send(cmd);
  console.log(res.Command.CommandId);
}
run();
