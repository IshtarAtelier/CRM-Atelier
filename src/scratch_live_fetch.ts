async function main() {
    console.log("Fetching live products...");
    const res = await fetch('https://crm-atelier-production-ae72.up.railway.app/api/products');
    const products = await res.json();
    
    const smartLenses = products.filter((p: any) => p.name?.toUpperCase().includes('SMART FREE'));
    
    for (const p of smartLenses) {
        console.log(`[${p.id}] ${p.name} | Type: ${p.type}`);
    }
}

main().catch(console.error);
