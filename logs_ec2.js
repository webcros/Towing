const { SSMClient, SendCommandCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ region: 'ap-south-1' });

async function run() {
  const cmd = new SendCommandCommand({
    InstanceIds: ['i-08c7c082464d3499a'],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [
        'docker ps',
        'docker logs ec2-user-backend-1 --tail 50'
      ]
    }
  });
  const res = await ssm.send(cmd);
  const commandId = res.Command.CommandId;
  
  // wait 5 seconds
  await new Promise(r => setTimeout(r, 5000));
  
  const getCmd = new GetCommandInvocationCommand({
    CommandId: commandId,
    InstanceId: 'i-08c7c082464d3499a'
  });
  
  try {
    const result = await ssm.send(getCmd);
    console.log(result.StandardOutputContent);
    console.error(result.StandardErrorContent);
  } catch(e) {
    console.log(e.message);
  }
}
run();
