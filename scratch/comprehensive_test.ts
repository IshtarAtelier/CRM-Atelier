import { isMultifocal2x1, isAtelierFrame, isFrame } from '../src/lib/promo-utils';

console.log('--- COMPREHENSIVE PROMO LOGIC TEST ---');

const testCases = [
    // 1. Keyword variations
    { p: { name: 'Multifocal 2x1' }, expected: true, label: 'Standard 2x1' },
    { p: { name: 'Progresivo 2 por 1' }, expected: true, label: '2 por 1' },
    { p: { name: 'Multifocal dos por uno' }, expected: true, label: 'dos por uno' },
    { p: { name: 'MULTIFOCAL 2X1' }, expected: true, label: 'Uppercase' },
    { p: { name: 'Múltifocál 2x1' }, expected: true, label: 'Accents (Normalized)' },
    
    // 2. Explicit flag
    { p: { name: 'Crystal', is2x1: true }, expected: true, label: 'Explicit is2x1 flag' },
    
    // 3. Negatives
    { p: { name: 'Monofocal 2x1' }, expected: false, label: '2x1 but NOT multifocal' },
    { p: { name: 'Multifocal' }, expected: false, label: 'Multifocal but NOT 2x1' },
    
    // 4. Frames
    { p: { brand: 'Atelier', type: 'Armazón' }, expectedFrame: true, expectedAtelier: true, label: 'Atelier Frame' },
    { p: { brand: 'ATELIER', type: 'Marco' }, expectedFrame: true, expectedAtelier: true, label: 'ATELIER Marco' },
    { p: { category: 'atelier de receta' }, expectedFrame: true, expectedAtelier: true, label: 'Atelier category' },
    { p: { brand: 'Ray-Ban', type: 'Armazon' }, expectedFrame: true, expectedAtelier: false, label: 'Ray-Ban Frame' },
];

let failed = 0;
testCases.forEach(({ p, expected, expectedFrame, expectedAtelier, label }) => {
    const got2x1 = isMultifocal2x1(p);
    const gotFrame = isFrame(p);
    const gotAtelier = isAtelierFrame(p);
    
    let pass = (expected === undefined || got2x1 === expected);
    if (expectedFrame !== undefined && gotFrame !== expectedFrame) pass = false;
    if (expectedAtelier !== undefined && gotAtelier !== expectedAtelier) pass = false;

    if (pass) {
        console.log(`✅ [PASS] ${label}`);
    } else {
        console.log(`❌ [FAIL] ${label}`);
        console.log(`   Input:`, p);
        console.log(`   Got: 2x1=${got2x1}, Frame=${gotFrame}, Atelier=${gotAtelier}`);
        failed++;
    }
});

console.log(`\nResults: ${testCases.length - failed}/${testCases.length} passed.`);
if (failed > 0) process.exit(1);
