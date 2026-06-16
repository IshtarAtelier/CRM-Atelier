const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Order' AND column_name IN ('smartLabDetails', 'labType');
    `);
    console.log("Columns in Order table:", res.rows);
  } catch(e) {
    console.log("Error:", e.message);
  } finally {
    await client.end();
  }
}
run();
