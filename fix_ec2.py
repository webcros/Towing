import boto3
import base64

ssm = boto3.client('ssm', region_name='ap-south-1')

compose = """version: "3.8"
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
    command: sh -c "npm install -g pnpm && pnpm install && sleep 10 && cd apps/backend && pnpm run build && pnpm run db:migrate && node dist/main.js"
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgres://towfleet:towfleet@postgres:5432/towfleet
      REDIS_URL: redis://redis:6379
      PORT: 4000
      NODE_OPTIONS: --max-old-space-size=1536
    depends_on:
      - postgres
      - redis
volumes:
  db_data:
"""

b64 = base64.b64encode(compose.encode('utf-8')).decode('utf-8')

response = ssm.send_command(
    InstanceIds=['i-08c7c082464d3499a'],
    DocumentName='AWS-RunShellScript',
    Parameters={
        'commands': [
            f'echo {b64} | base64 -d > /home/ec2-user/docker-compose.yml',
            'cd /home/ec2-user',
            'docker-compose down',
            'docker-compose up -d'
        ]
    }
)
print(response['Command']['CommandId'])
