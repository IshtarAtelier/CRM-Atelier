const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name IN (
        'nearDistanceOD', 'nearDistanceOI', 'nearPd',
        'labType', 'origin',
        'labEdgeInStore', 'labHeightOD', 'labHeightOI', 'labMaterial', 
        'labNearPdOd', 'labNearPdOi', 'smartLabDetails',
        'observations'
      );
    `);
    console.log(res.rows);
  } catch(e) {
    console.log("Error:", e.message);
  } finally {
    await client.end();
  }
}
run();
