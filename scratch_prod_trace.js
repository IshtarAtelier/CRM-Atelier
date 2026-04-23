async function main() {
  try {
    console.log("Fetching contacts...");
    const res = await fetch("https://crm-atelier-production-ae72.up.railway.app/api/contacts");
    const data = await res.json();
    console.log("Data keys:", Object.keys(data));
    console.log("Data preview:", JSON.stringify(data).substring(0, 100));
  } catch (error) {
    console.error("Fetch error:", error);
  }
}
main();
