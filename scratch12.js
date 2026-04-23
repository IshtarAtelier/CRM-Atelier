const fetch = require('node-fetch');

async function test() {
    console.log('Fetching tasks from local Next.js prod server...');
    const res = await fetch('http://localhost:3000/api/tasks/pending', {
        headers: {
            'Cookie': `session=mock_token_to_bypass_or_just_see_what_happens`
        }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
}
test();
