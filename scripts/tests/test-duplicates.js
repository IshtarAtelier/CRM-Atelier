const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDuplicates() {
    const clientsThisMonth = await prisma.client.findMany({
        where: {
            createdAt: {
                gte: new Date('2026-06-01T00:00:00.000Z')
            }
        },
        select: { id: true, name: true, phone: true, createdAt: true }
    });

    const normalizePhone = (phone) => {
        if (!phone) return null;
        let base = phone.replace(/\D/g, '');
        if (!base) return null;
        return base.slice(-8); // We just need the last 8 digits for matching
    };

    const nameMap = {};
    const phoneMap = {};
    const duplicates = [];

    for (const client of clientsThisMonth) {
        // Check by Name
        const normName = client.name.trim().toLowerCase();
        if (nameMap[normName]) {
            duplicates.push({ type: 'NAME', name: client.name, ids: [nameMap[normName].id, client.id] });
        } else {
            nameMap[normName] = client;
        }

        // Check by Phone
        const suffix = normalizePhone(client.phone);
        if (suffix) {
            if (phoneMap[suffix]) {
                // To avoid logging same duplicate twice if name matches too
                const alreadyFound = duplicates.find(d => d.ids.includes(client.id) && d.ids.includes(phoneMap[suffix].id));
                if (!alreadyFound) {
                    duplicates.push({ type: 'PHONE', suffix, name1: phoneMap[suffix].name, name2: client.name, ids: [phoneMap[suffix].id, client.id] });
                }
            } else {
                phoneMap[suffix] = client;
            }
        }
    }

    // Now check if any of these month's clients duplicate historical clients
    const historicalDuplicates = [];
    for (const client of clientsThisMonth) {
        const normName = client.name.trim().toLowerCase();
        const suffix = normalizePhone(client.phone);

        // Name check against all time
        const pastNameMatches = await prisma.client.findMany({
            where: {
                name: { equals: normName, mode: 'insensitive' },
                id: { not: client.id },
                createdAt: { lt: new Date('2026-06-01T00:00:00.000Z') }
            },
            select: { id: true, name: true, phone: true }
        });
        
        if (pastNameMatches.length > 0) {
            historicalDuplicates.push({ type: 'HISTORICAL_NAME', newClient: client, pastClients: pastNameMatches });
        }

        // Phone check against all time
        if (suffix) {
            const pastPhoneMatches = await prisma.$queryRawUnsafe(`
                SELECT id, name, phone 
                FROM "Client" 
                WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%${suffix}%'
                AND id != '${client.id}'
                AND "createdAt" < '2026-06-01'
            `);
            if (pastPhoneMatches.length > 0) {
                historicalDuplicates.push({ type: 'HISTORICAL_PHONE', newClient: client, pastClients: pastPhoneMatches });
            }
        }
    }

    console.log("=== NEW DUPLICATES CREATED THIS MONTH (AMONG THEMSELVES) ===");
    console.log(JSON.stringify(duplicates, null, 2));
    
    console.log("\n=== NEW CLIENTS THIS MONTH THAT DUPLICATE HISTORICAL DATA ===");
    console.log(JSON.stringify(historicalDuplicates, null, 2));

    await prisma.$disconnect();
}

findDuplicates().catch(console.error);
