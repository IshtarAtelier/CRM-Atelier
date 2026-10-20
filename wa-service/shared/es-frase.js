/**
 * ¿El texto es una frase (saludo, consulta, razón social) y no un nombre de persona?
 * Puro: sin base ni red. Vive acá para que los checks del CI lo usen sin
 * cargar tools.js (que abre Prisma al importarse).
 */
function isPhrase(str) {
    if (!str) return false;
    const lower = str.toLowerCase().trim();
    
    // 1. Palabras clave de saludos, preguntas, o términos comerciales
    const conversationalKeywords = [
        'hola', 'buen', 'buenos', 'buenas', 'dias', 'días', 'tardes', 'noches',
        'como', 'cómo', 'va', 'estas', 'estás', 'info', 'informacion', 'información',
        'consulta', 'consultas', 'presupuesto', 'presupuestos', 'receta', 'recetas',
        'turno', 'turnos', 'precio', 'precios', 'cuanto', 'cuánto', 'sale', 'cuesta',
        'quiero', 'necesito', 'busco', 'comprar', 'vender', 'local', 'optica', 'óptica',
        'atelier', 'gracias', 'chau', 'saludos', 'contacto', 'mensaje', 'mensajes',
        'venta', 'ventas', 'insumo', 'insumos', 'repuesto', 'repuestos', 'servicio', 
        'servicios', 'distribuidora', 'comercial', 'oficina', 'administracion', 
        'administración', 'soporte', 'taller', 'fabrica', 'fábrica', 'tienda', 
        'negocio', 'empresa', 'asesor', 'asesora', 'atencion', 'atención', 'cliente', 
        'clientes'
    ];
    
    // 2. Conectores, verbos, pronombres o artículos típicos de oraciones
    const sentenceIndicators = [
        'en', 'y', 'con', 'para', 'por', 'que', 'qué', 'un', 'una', 'uno', 'unas', 'unos',
        'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'este', 'esta', 'esto',
        'aqui', 'aquí', 'alli', 'allí', 'aca', 'acá', 'ya', 'es', 'son', 'ser', 'estar',
        'tiene', 'tienen', 'hay', 'me', 'te', 'se', 'nos', 'les'
    ];
    
    const words = lower.split(/\s+/);
    
    for (const word of words) {
        const cleanWord = word.replace(/[^a-z0-9áéíóúñü]/g, '');
        if (conversationalKeywords.includes(cleanWord) || sentenceIndicators.includes(cleanWord)) {
            return true;
        }
    }
    
    // 3. Si tiene 5 o más palabras, muy probablemente sea una frase o razón social larga
    if (words.length >= 5) {
        return true;
    }
    
    return false;
}

module.exports = { isPhrase };
