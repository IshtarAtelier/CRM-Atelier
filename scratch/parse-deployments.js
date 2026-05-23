const { execSync } = require('child_process');

try {
  const jsonStr = execSync('railway status --json', { encoding: 'utf8' });
  const data = JSON.parse(jsonStr);
  
  const edges = data.environments.edges[0].node.serviceInstances.edges;
  edges.forEach((edge, index) => {
    const node = edge.node;
    const serviceNameEdge = data.services.edges.find(e => e.node.id === node.serviceId);
    const serviceName = serviceNameEdge ? serviceNameEdge.node.name : 'Unknown';
    
    if (node.latestDeployment) {
      console.log(`Service: ${serviceName}`);
      console.log(`  Latest Deployment ID: ${node.latestDeployment.id}`);
      console.log(`  Latest Deployment Status: ${node.latestDeployment.status}`);
      console.log(`  Instances:`);
      if (node.latestDeployment.instances && node.latestDeployment.instances.length > 0) {
        node.latestDeployment.instances.forEach(ins => {
          console.log(`    - ID: ${ins.id}, Status: ${ins.status}`);
        });
      } else {
        console.log(`    - None`);
      }
      console.log('-----------------------------');
    }
  });
} catch (err) {
  console.error("Error:", err.message);
}
