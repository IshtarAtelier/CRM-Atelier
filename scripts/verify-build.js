const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

console.log('--- CRM Safety Audit ---');

// 1. Check for database provider
if (schemaContent.includes('provider = "sqlite"')) {
    console.error('❌ ERROR: Database provider is set to "sqlite".');
    console.error('   Production MUST use "postgresql" to avoid data loss.');
    process.exit(1);
}

if (schemaContent.includes('url = "file:')) {
    console.error('❌ ERROR: Database URL is pointing to a local file.');
    console.error('   Production MUST use env("DATABASE_URL").');
    process.exit(1);
}

// 2. Check for dangerous commands in package.json (extra safety)
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const startScript = pkg.scripts.start || '';

if (startScript.includes('--accept-data-loss')) {
    console.error('❌ ERROR: Production start script contains "--accept-data-loss".');
    console.error('   This is extremely dangerous and can cause permanent data loss.');
    process.exit(1);
}

console.log('✅ Safety Audit Passed: PostgreSQL connection is locked and no dangerous scripts found.');
process.exit(0);
