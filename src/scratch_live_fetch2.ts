async function main() {
    console.log("Fetching live products...");
    const res = await fetch('https://crm-atelier-production-ae72.up.railway.app/api/products');
    const text = await res.text();
    console.log(text.substring(0, 500));
}

main().catch(console.error);
