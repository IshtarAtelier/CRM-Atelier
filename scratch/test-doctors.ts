import { GET } from '../src/app/api/doctors/commissions/route';

async function main() {
  try {
    const req = new Request('http://localhost/api/doctors/commissions?doctor=TEST');
    const res = await GET(req);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('FAILED', err);
  }
}

main();
