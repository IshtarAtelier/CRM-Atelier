import { ContactService } from './src/services/contact.service';

async function test() {
    console.log('Testing getOrdersWithBalance...');
    try {
        const clientsWithBalance = await ContactService.getOrdersWithBalance();
        console.log(`Found ${clientsWithBalance.length} clients with balance.`);
        for (const client of clientsWithBalance) {
            console.log(`- ${client.name} | Balance: ${client.balance}`);
        }
    } catch(e) {
        console.error('Error in getOrdersWithBalance', e);
    }
}
test();
