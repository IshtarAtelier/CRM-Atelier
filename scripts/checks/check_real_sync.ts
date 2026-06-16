import { SmartLabService } from './src/services/smartlab.service';

async function test() {
    console.log("Iniciando sincronización manual...");
    const result = await SmartLabService.syncOrders();
    console.log("Resultado:", JSON.stringify(result, null, 2));
}

test().catch(console.error).finally(() => process.exit(0));
