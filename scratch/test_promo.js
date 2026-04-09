const { calculateQuoteTotals } = require('../src/lib/promo-utils');

const mockProducts = [
    { id: '1', name: 'Multifocal 2x1 Crystal', brand: 'Zeiss', type: 'Multifocal 2x1', category: 'LENS', price: 1000, is2x1: true },
    { id: '2', name: 'Atelier Frame', brand: 'Atelier', type: 'Armazon', category: 'FRAME', price: 500 },
    { id: '3', name: 'Other Frame', brand: 'RayBan', type: 'Armazon', category: 'FRAME', price: 600 }
];

const cartItems = [
    { product: mockProducts[0], quantity: 1, customPrice: 500, eye: 'OD' }, // 1st crystal unit
    { product: mockProducts[0], quantity: 1, customPrice: 500, eye: 'OI' }, // 2nd crystal unit
    { product: mockProducts[1], quantity: 1, customPrice: 500 }, // Atelier frame
    { product: mockProducts[2], quantity: 1, customPrice: 600 }  // RayBan frame
];

console.log('Testing 2x1 Promotion calculation...');
const totals = calculateQuoteTotals(cartItems, 0, 0, mockProducts);

console.log('Raw Subtotal:', 500 + 500 + 500 + 600, '=', 2100);
console.log('Calculated Subtotal:', totals.subtotal);
console.log('Promo Discount:', totals.promoFrameDiscount);

const expectedDiscount = 500; // Atelier frame is free because it's the 2nd one (sorted by price: 600, 500)
if (totals.promoFrameDiscount === expectedDiscount) {
    console.log('✅ TEST PASSED: Promo discount correctly applied to Atelier frame.');
} else {
    console.log('❌ TEST FAILED: Expected', expectedDiscount, 'but got', totals.promoFrameDiscount);
}

const cartItems2 = [
    { product: mockProducts[0], quantity: 2, customPrice: 500 },
    { product: mockProducts[2], quantity: 2, customPrice: 600 } // Two expensive frames
];
const totals2 = calculateQuoteTotals(cartItems2, 0, 0, mockProducts);
// With two 600 frames, the second 600 frame should be discounted up to the average Atelier price (500)
console.log('\nTesting with non-Atelier frames...');
console.log('Promo Discount:', totals2.promoFrameDiscount, '(Expected ~500)');
if (totals2.promoFrameDiscount === 500) {
    console.log('✅ TEST PASSED: Discount capped at Atelier avg price.');
} else {
    console.log('❌ TEST FAILED: Got', totals2.promoFrameDiscount);
}
