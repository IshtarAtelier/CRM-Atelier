
// Mock products and items to test the new logic
const products = [
    { id: '1', name: 'Lens Pair', cost: 100000, unitType: 'PAR' },
    { id: '2', name: 'Frame', cost: 50000, unitType: 'UNIDAD' }
];

const items = [
    { productId: '1', quantity: 1, eye: 'OD', price: 150000 },
    { productId: '1', quantity: 1, eye: 'OI', price: 150000 },
    { productId: '2', quantity: 1, eye: null, price: 120000 }
];

function calculateCost(product, item) {
    let itemCost = (product.cost || 0) * item.quantity;
    
    // The Fix Logic
    if (product.unitType === 'PAR' && item.eye && (product.cost || 0) > 0) {
        itemCost = ((product.cost || 0) / 2) * item.quantity;
    }
    
    return itemCost;
}

console.log('--- COST CALCULATION TEST ---');
let totalCost = 0;
items.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    const cost = calculateCost(product, item);
    console.log(`Product: ${product.name} | Eye: ${item.eye} | Calculated Cost: ${cost}`);
    totalCost += cost;
});

console.log('---------------------------');
console.log(`Total Calculated Cost: ${totalCost}`);
console.log(`Expected Cost: 150000 (100k lenses pair + 50k frame)`);

if (totalCost === 150000) {
    console.log('✅ TEST PASSED');
} else {
    console.log('❌ TEST FAILED');
}
