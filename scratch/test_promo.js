
const { isMultifocal2x1, calculatePromoFrameDiscount, isFrame, isAtelierFrame } = require('./src/lib/promo-utils');

const crystal2x1 = {
    name: 'Multifocal 2x1 Test',
    type: 'Multifocal',
    category: 'LENS',
    price: 1000
};

const frame1 = {
    name: 'Frame 1',
    brand: 'Some Brand',
    type: 'Armazón',
    category: 'FRAME',
    price: 500
};

const frame2Atelier = {
    name: 'Atelier Frame',
    brand: 'Atelier',
    type: 'Armazón',
    category: 'FRAME',
    price: 300
};

const items = [
    { product: crystal2x1, quantity: 1, customPrice: 1000 },
    { product: frame1, quantity: 1, customPrice: 500 },
    { product: frame2Atelier, quantity: 1, customPrice: 300 }
];

console.log('isMultifocal2x1:', isMultifocal2x1(crystal2x1));
console.log('isFrame frame1:', isFrame(frame1));
console.log('isFrame frame2:', isFrame(frame2Atelier));
console.log('isAtelierFrame frame2:', isAtelierFrame(frame2Atelier));

const discount = calculatePromoFrameDiscount(items, [frame2Atelier]);
console.log('Discount:', discount);
