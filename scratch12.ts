import * as jose from 'jose';

const secretKey = process.env.JWT_SECRET || 'atelier-optica-super-secret-key-for-dev';
const key = new TextEncoder().encode(secretKey);

async function test() {
    const token = await new jose.SignJWT({ id: 'cm28x9', role: 'ADMIN', name: 'Ish Admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(key);

    console.log('Fetching from Railway...');
    
    for (const path of ['/api/tasks/pending', '/api/orders/with-balance']) {
        const res = await fetch(`https://crm-atelier-production-ae72.up.railway.app${path}`, {
            headers: {
                'Cookie': `session=${token}`
            }
        });
        console.log(`\n--- ${path} ---`);
        console.log('Status:', res.status);
        console.log('Response:', await res.text());
    }
}
test();
