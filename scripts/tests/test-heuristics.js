function normalizeContactSource(source) {
    if (!source || source.trim() === "") return null;
    const clean = source.trim();
    const lower = clean.toLowerCase();
    if (lower.includes('google') || lower === 'gads') {
        return 'Google Ads';
    } else if (
        lower.includes('meta') || 
        lower.includes('instagram') || 
        lower.includes('facebook') || 
        lower === 'face' || 
        lower === 'fb' || 
        lower === 'ig'
    ) {
        return 'Meta';
    } else if (lower.includes('ya es cliente') || lower === 'cliente' || lower === 'antiguo') {
        return 'Ya es Cliente';
    }
    return clean;
}

function detectSourceFromMessage(content) {
    if (!content) return null;
    
    // Meta templates with brackets, e.g. [metaSofi], [Metaplaca]
    if (/\[meta[a-zA-Z0-9_-]+\]/i.test(content)) {
        return 'Meta';
    }
    
    // Google templates: "Los vi en Google,", "Hola! Vi su anuncio en Google..."
    if (/vi su anuncio en google|los vi en google/i.test(content)) {
        return 'Google Ads';
    }

    const text = content.toLowerCase();
    if (text.includes('google') || text.includes('busqueda') || text.includes('búsqueda')) {
        return 'Google Ads';
    }
    if (
        text.includes('instagram') ||
        text.includes('facebook') ||
        text.includes('meta') ||
        text.includes('vi su publicacion') ||
        text.includes('vi tu publicacion') ||
        text.includes('vi su publicación') ||
        text.includes('vi tu publicación') ||
        text.includes('vi el anuncio') ||
        text.includes('vi un anuncio') ||
        text.includes('los vi en instagram') ||
        text.includes('los vi en facebook')
    ) {
        return 'Meta';
    }
    return null;
}

const testCases = [
    // Meta templates
    { input: "¡Hola! Quiero más información sobre la promo. [Metaplaca]", expected: "Meta" },
    { input: "¡Hola! Estoy interes@ en lentes multifocales [metaSofi]", expected: "Meta" },
    { input: "hola, vi un anuncio en Instagram y me interesó [metaAgostina]", expected: "Meta" },
    
    // Google Ads templates
    { input: "Los vi en Google,", expected: "Google Ads" },
    { input: "Hola! Vi su anuncio en Google y quiero recibir más información.", expected: "Google Ads" },
    { input: "los vi en google y me gusto el local", expected: "Google Ads" },

    // Loose keywords
    { input: "buscando en Google Maps los encontre", expected: "Google Ads" },
    { input: "Hola vi su publicacion en facebook", expected: "Meta" },
    { input: "Me lo paso una amiga", expected: null } // No direct match, falls to null or referred in main tools
];

console.log('--- Corriendo Tests de Heurísticas de Origen ---');
let passed = 0;

testCases.forEach((tc, idx) => {
    const result = detectSourceFromMessage(tc.input);
    const success = result === tc.expected;
    if (success) {
        passed++;
        console.log(`✅ Test ${idx + 1} PASÓ: "${tc.input}" -> "${result}"`);
    } else {
        console.error(`❌ Test ${idx + 1} FALLÓ: "${tc.input}"`);
        console.error(`   Esperado: "${tc.expected}", Obtenido: "${result}"`);
    }
});

console.log(`\nResultado: ${passed}/${testCases.length} tests pasaron.`);
if (passed === testCases.length) {
    console.log('🎉 ¡Todas las heurísticas funcionan a la perfección!');
    process.exit(0);
} else {
    console.error('⚠️ Algunas pruebas fallaron.');
    process.exit(1);
}
