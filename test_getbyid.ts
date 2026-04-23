import { prisma } from './src/lib/db';
import { ContactService } from './src/services/contact.service';

async function main() {
    try {
        const clients = await prisma.client.findMany({ select: { id: true, name: true } });
        console.log(`Testing ${clients.length} clients...`);
        let errors = 0;
        for (const c of clients) {
            try {
                await ContactService.getById(c.id);
            } catch (err: any) {
                console.error(`Error with client ${c.name} (${c.id}):`, err.message);
                errors++;
            }
        }
        console.log(`Done. Errors: ${errors}`);
    } catch (e) {
        console.error("Fatal error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
