const https = require('https');

const req = https.request('https://crm.atelieroptica.com/api/orders/cmpym50nr000tv0dl2d9g5nhw/notify-ready', { method: 'POST' }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});
req.on('error', console.error);
req.end();
