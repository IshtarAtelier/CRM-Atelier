const { Client } = require('pg');

async function checkDb(name, connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  console.log(`\n=== Schema for ${name} ===`);
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, column_name
    `);
    
    // Group by table
    const tables = {};
    res.rows.forEach(row => {
      if (!tables[row.table_name]) tables[row.table_name] = [];
      tables[row.table_name].push(row.column_name);
    });

    for (const [table, columns] of Object.entries(tables)) {
      console.log(`Table: ${table}`);
      console.log(`Columns: [${columns.join(', ')}]`);
    }
  } catch (err) {
    console.error(`Error checking ${name}:`, err.message);
  } finally {
    await client.end();
  }
}

async function main() {
  const db1 = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
  const db2 = "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway";

  await checkDb("Postgres (CRM-Atelier)", db1);
  await checkDb("Postgres-uInF (Pagina Web)", db2);
}

main();
