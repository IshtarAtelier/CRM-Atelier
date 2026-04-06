const http = require('http');

const testApi = (url) => {
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`URL: ${url}`);
            console.log(`Status: ${res.statusCode}`);
            try {
                const json = JSON.parse(data);
                if (Array.isArray(json)) {
                    console.log(`Response is Array: true (Length: ${json.length})`);
                } else {
                    console.log(`Response is Object: true`);
                    console.log(`Keys: ${Object.keys(json).join(', ')}`);
                    if (json.pagination) {
                        console.log(`Pagination:`, json.pagination);
                        console.log(`Orders Length: ${json.orders.length}`);
                    }
                }
            } catch (e) {
                console.log(`Raw data (first 100 bytes): ${data.substring(0, 100)}`);
            }
            console.log('---');
        });
    }).on('error', (err) => {
        console.error(`Error: ${err.message}`);
    });
};

// Test both forms
const host = 'http://localhost:3000';
testApi(`${host}/api/orders`);
setTimeout(() => testApi(`${host}/api/orders?paginate=true&limit=5`), 2000);
