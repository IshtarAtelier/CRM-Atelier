async function fetchProducts() {
    const res = await fetch("https://crm-atelier-production.up.railway.app/api/products");
    const text = await res.text();
    console.log("API response:", text.substring(0, 500));
}
fetchProducts().catch(console.error);
