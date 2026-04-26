import fs from 'fs';
import { GET } from '../src/app/api/reports/route';

const envFile = fs.readFileSync('.env', 'utf-8');
for (const line of envFile.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = line.split('=')[1].trim().replace(/^"|"$/g, '');
  }
}

async function main() {
  try {
    const req = new Request('http://localhost/api/reports?from=2026-04-01&to=2026-04-30');
    const res = await GET(req);
    const json = await res.json();
    console.log(JSON.stringify(json.labStats, null, 2));
  } catch (err) {
    console.error('FAILED', err);
  }
}

main();
