const http = require('http');

async function testPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/tasks/pending`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Port ${port} responded with status ${res.statusCode}`);
        if(res.statusCode !== 200) {
            console.log(data.substring(0, 1500));
        } else {
            console.log(data.substring(0, 500));
        }
        resolve(true);
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function main() {
  const ports = [3000, 3001, 3002, 8080, 5000];
  for (const p of ports) {
     const found = await testPort(p);
     if(found) break;
  }
}

main();
