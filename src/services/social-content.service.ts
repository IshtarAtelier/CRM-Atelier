import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { prisma } from '@/lib/db';
import { staticPosts } from '@/lib/static-blog-posts';

// ── Types ──────────────────────────────────
interface GenerateRequest {
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'WHATSAPP';
    format: 'POST' | 'STORY' | 'REEL' | 'CAROUSEL';
    sourceType: 'PRODUCT' | 'BLOG' | 'PROMO' | 'FREE';
    sourceId?: string;
    topic?: string;
    imageStyle?: 'PLACA' | 'PLACA_TEXTO' | 'UGC_AVATAR' | 'EDITORIAL';
    goal?: string;
}

interface GeneratedContent {
    copy: string;
    hashtags: string;
    cta: string;
    imagePrompt: string;
    publishTips: {
        bestTime: string;
        tone: string;
        format: string;
        tips: string[];
    };
}

// ── Brand Context ──────────────────────────
const BRAND_CONTEXT = `
MARCA: Atelier Óptica
UBICACIÓN: Cerro de las Rosas, Córdoba, Argentina
ESENCIA: Óptica boutique premium. Fusiona arte, diseño y precisión visual.
TONO: Elegante pero cálido. Profesional pero cercano. Usamos "vos/tenés" (español argentino).
ESTILO VISUAL: Editorial de moda, tonos nude/warm (#9e7f65, #c2a38a), fotografía cinematográfica, glassmorphism.
PRODUCTOS ESTRELLA: Multifocales Varilux, armazones de diseño, cristales Essilor, Ray-Ban Meta.
DIFERENCIAL: Atención personalizada uno a uno, garantía de adaptación en multifocales, tecnología de medición de alta precisión.
AUDIENCIA: Adultos 30-65 años, profesionales, interesados en salud visual premium.
WEB: www.atelieroptica.com.ar
INSTAGRAM: @atelier.optica

ENFOQUE PRINCIPAL: Aportar valor real al usuario. No sonar como un catálogo de ventas ni forzar promociones salvo que se pida explícitamente. Priorizar la educación sobre salud visual, tendencias de diseño, y el storytelling de la marca. 
NO USAR: Lenguaje genérico, humor forzado, emojis excesivos. Máximo 3-4 emojis por post. Tonos agresivos de venta ("¡Comprá ya!").
SÍ USAR: Lenguaje aspiracional, datos técnicos accesibles, storytelling visual, llamados a acción suaves y orgánicos.
`;

// ── Platform-specific guidelines ───────────
const PLATFORM_GUIDES: Record<string, string> = {
    INSTAGRAM: `
Para Instagram:
- Posts: 150-300 palabras. Primera línea enganche fuerte (hook).
- Reels: Caption corto y directo, 50-100 palabras max. CTA al final.
- Stories: Texto ultra breve (1-2 frases), diseñado para interacción (encuestas, preguntas).
- Carruseles: 5-7 slides. Cada slide = 1 idea. Primera slide = gancho. Última = CTA.
- Hashtags: 15-20 relevantes mezclando popularidad.
- Aspect ratio: Post 1:1 (1080x1080), Story/Reel 9:16 (1080x1920), Carrusel 1:1
`,
    FACEBOOK: `
Para Facebook:
- Posts más largos que Instagram, 200-400 palabras.
- Tono ligeramente más formal/informativo.
- Hashtags: solo 3-5, los más relevantes.
- Incluir link al sitio web cuando sea relevante.
- Aspect ratio: 1200x630 para posts con imagen.
`,
    WHATSAPP: `
Para WhatsApp Status/Difusión:
- Texto MUY breve (50-80 palabras max).
- Formato para Status: frase impactante + CTA.
- Usar negritas con *texto* para énfasis.
- Sin hashtags.
- Aspect ratio: 9:16 vertical.
`
};

// ── Format-specific guidelines ─────────────
const FORMAT_GUIDES: Record<string, string> = {
    POST: 'Publicación individual con imagen. Copy + hashtags + CTA.',
    STORY: 'Contenido efímero vertical (9:16). NO GENERAR CAPTION LARGO. Generar: 1) Texto corto sugerido para poner en la pantalla. 2) Sugerencia de Stickers (Ej: Encuesta, Caja de preguntas, Link). Separar ambas cosas en el campo "copy".',
    REEL: 'Video corto. Generar caption atractivo y guión de 30-60 segundos con indicaciones.',
    CAROUSEL: 'Carrusel educativo o de producto. Generar texto para cada slide (5-7 slides).'
};

// ── Source data fetchers ───────────────────
async function getSourceContext(sourceType: string, sourceId?: string, topic?: string): Promise<string> {
    if (sourceType === 'PRODUCT' && sourceId) {
        const product = await prisma.product.findUnique({
            where: { id: sourceId },
            select: { id: true, brand: true, model: true, category: true, price: true, type: true, lensIndex: true, botLabel: true, imagenesCatalogo: true, seoDescription: true }
        });
        if (!product) throw new Error('Producto no encontrado');
        return `PRODUCTO A PROMOCIONAR:
- Marca: ${product.brand || 'N/A'}
- Modelo: ${product.model || 'N/A'}
- Categoría: ${product.category}
- Tipo: ${product.type || 'N/A'}
- Precio: $${product.price?.toLocaleString() || 'Consultar'}
- Descripción: ${product.seoDescription || product.botLabel || 'Producto premium de óptica'}
- Tiene fotos: ${product.imagenesCatalogo?.length > 0 ? 'Sí' : 'No'}`;
    }

    if (sourceType === 'BLOG' && sourceId) {
        let post = await prisma.blogPost.findUnique({
            where: { id: sourceId },
            select: { title: true, excerpt: true, category: true, slug: true }
        });
        
        if (!post) {
            const staticPost = staticPosts.find(p => p.slug === sourceId);
            if (staticPost) {
                post = {
                    title: staticPost.title,
                    excerpt: staticPost.excerpt,
                    category: staticPost.category,
                    slug: staticPost.slug
                };
            }
        }

        if (!post) throw new Error('Artículo de blog no encontrado');
        return `ARTÍCULO DE BLOG A PROMOCIONAR:
- Título: ${post.title}
- Extracto: ${post.excerpt}
- Categoría: ${post.category}
- URL: www.atelieroptica.com.ar/blog/${post.slug}`;
    }

    if (sourceType === 'PROMO') {
        return `PROMOCIÓN A PUBLICAR:
- Tema: ${topic || 'Promoción general de la óptica'}
- Instrucciones: Crear contenido promocional con urgencia sutil (sin ser agresivo). Mantener el tono premium.`;
    }

    // FREE
    return `TEMA LIBRE:
- Tema: ${topic || 'Contenido general de salud visual y tendencias en anteojos'}
- Instrucciones: Crear contenido original, educativo o inspiracional.`;
}

// ── Main Generation Function ───────────────
// ── Image style prompts ────────────────────
const IMAGE_STYLE_GUIDES: Record<string, string> = {
    PLACA: `ESTILO DE IMAGEN: PLACA / GRÁFICA SOCIAL (ORIENTADO A ÓPTICA)
Generar una imagen tipo "placa" o fondo de diseño gráfico de alta gama para redes sociales.
- Debe incluir representaciones artísticas y minimalistas de óptica: siluetas doradas y delgadas de anteojos, destellos de luz pasando a través de cristales o lentes transparentes, o reflejos elegantes de vidrios sobre fondos nude/warm (#9e7f65, #c2a38a).
- Fondo elegante con gradientes cálidos (nude, beige, dorado suave) o texturas de mármol o lino.
- Espacio limpio y despejado para que podamos superponer texto posteriormente en el frontend (la imagen generada NO debe contener letras, palabras ni números).
- Estilo de alta costura, sofisticado y minimalista, inspirado en campañas de marcas de gafas de lujo.
- Aspect ratio: vertical 9:16 para stories/reels, cuadrado 1:1 para posts.`,
    PLACA_TEXTO: `ESTILO DE IMAGEN: PLACA PUBLICITARIA CON TEXTO (TIPOGRAFÍA IA)
Generar una gráfica publicitaria de alta gama que INCLUYA texto escrito de manera artística por la IA.
- La IA debe generar una frase corta promocional (ej: "SALE", "NUEVO", "ATELIER") en tipografía elegante, grande y central.
- Fondo sofisticado (nude/warm, texturas de mármol o lino) con elementos sutiles de óptica (siluetas de gafas, destellos).
- Diseño de campaña promocional, impactante y directo.
- Aspect ratio: vertical 9:16 para stories/reels, cuadrado 1:1 para posts.`,
    UGC_AVATAR: `ESTILO DE IMAGEN: UGC CON AVATAR IA (DEBE USAR ANTEOJOS/GAFAS)
Generar una foto realista de una persona (hombre o mujer de 30 a 55 años) que represente la estética de Atelier Óptica.
- CRÍTICO: La persona DEBE llevar puestos anteojos recetados o gafas de sol premium y de diseño muy marcado, que sean el centro de atención.
- Estilo natural tipo "contenido creado por usuario" (UGC): foto casual, selfie moderna o retrato espontáneo pero cuidado y elegante.
- Iluminación cálida, natural (golden hour) o en interiores con luz suave.
- La persona debe lucir profesional, con estilo y segura de sí misma.
- Fondo: un café de diseño, una oficina moderna y luminosa, la calle de una ciudad o el interior de una boutique de óptica premium.
- Los anteojos deben ser el elemento más nítido y enfocado de la imagen.
- Aspect ratio: vertical 9:16 para stories/reels, cuadrado 1:1 para posts.`,
    EDITORIAL: `ESTILO DE IMAGEN: EDITORIAL DE PRODUCTO (CRISTALES Y ARMAZONES)
Generar una fotografía publicitaria de producto (bodegón de moda) de alta gama.
- CRÍTICO: Debe mostrar anteojos premium, cristales oftálmicos con filtros antirreflejo de tonalidad azul/violeta/verde, o lentes de sol sobre una superficie elegante (mármol veteado, madera pulida, lino o piedras texturizadas).
- Iluminación de estudio cinematográfica, con sombras suaves pero definidas y destellos limpios a través de los cristales para denotar precisión y calidad óptica.
- Composición minimalista, aspiracional y artística (estilo Gentle Monster o campañas de revistas de moda).
- Paleta de colores: tonos nude, crema, negro mate, y detalles en dorado.
- Puede acompañarse de elementos de diseño sutiles: libros de arte, fragancias exclusivas, o flores secas minimalistas.
- Aspect ratio: vertical 9:16 para stories/reels, cuadrado 1:1 para posts.`
};

export async function generateSocialContent(request: GenerateRequest) {
    const { platform, format, sourceType, sourceId, topic, imageStyle = 'PLACA', goal = 'Aportar valor y educar' } = request;

    // 1. Get source context
    const sourceContext = await getSourceContext(sourceType, sourceId, topic);
    
    // 2. Get source name for display
    let sourceName = topic || 'Contenido libre';
    if (sourceType === 'PRODUCT' && sourceId) {
        const p = await prisma.product.findUnique({ where: { id: sourceId }, select: { brand: true, model: true } });
        sourceName = p ? `${p.brand} ${p.model}` : 'Producto';
    } else if (sourceType === 'BLOG' && sourceId) {
        let b = await prisma.blogPost.findUnique({ where: { id: sourceId }, select: { title: true } });
        if (!b) {
            const staticPost = staticPosts.find(p => p.slug === sourceId);
            if (staticPost) {
                b = { title: staticPost.title };
            }
        }
        sourceName = b?.title || 'Artículo';
    }

    // 3. Build prompts
    const systemPrompt = `Eres el Social Media Manager de Atelier Óptica. Generás contenido premium para redes sociales.

${BRAND_CONTEXT}

OBJETIVO DEL CONTENIDO: ${goal}
(Asegurate de que el tono y la estructura del texto apunten directamente a este objetivo).

${PLATFORM_GUIDES[platform] || ''}

FORMATO ACTUAL: ${format} — ${FORMAT_GUIDES[format] || ''}

${IMAGE_STYLE_GUIDES[imageStyle] || IMAGE_STYLE_GUIDES.PLACA}

REGLAS DE SALIDA OBLIGATORIAS:
- Devolvé ÚNICAMENTE un objeto JSON válido, sin backticks, sin markdown, sin explicaciones.
- Si el formato es STORY, NO redactes captions bajo ningún punto de vista. Solo redactá lo que iría escrito sobre la foto y opciones de interactividad.
- El JSON debe tener esta estructura exacta:
{
  "copy": "El texto principal del post/caption. Si es CAROUSEL, separá cada slide con ---SLIDE--- como delimitador. Si es STORY, ES OBLIGATORIO NO ESCRIBIR CAPTION LARGO. Devolver únicamente el formato: 'TEXTO EN PANTALLA: [tu texto]' y luego 'STICKERS: [tus sugerencias]'.",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 (todos juntos separados por espacio, dejar vacío si es STORY)",
  "cta": "Call to action final sugerido",
  "imagePrompt": "Prompt DETALLADO en inglés para generar la imagen con IA. DEBE representar de forma explícita el producto, artículo o tema óptico de esta publicación (por ejemplo: si es sobre Ray-Ban Meta, describir anteojos inteligentes de diseño clásico con cámaras discretas en el frente; si es sobre multifocales Varilux, mostrar a un adulto profesional leyendo o mirando a través de anteojos elegantes de forma nítida; si es sobre control de miopía infantil, un niño feliz con gafas de marco amigable; si es Crizal Sapphire, un primer plano del cristal de un anteojo con destellos antirreflejo azulados). Debe respetar el estilo indicado arriba (PLACA, UGC_AVATAR o EDITORIAL) y describir la iluminación, composición, colores, y la relación de aspecto en inglés.",
  "publishTips": {
    "bestTime": "Mejor horario para publicar (horario Argentina)",
    "tone": "Descripción del tono usado",
    "format": "Formato técnico (ej: 1080x1080 JPG)",
    "tips": ["Tip 1 de publicación", "Tip 2", "Tip 3"]
  }
}`;

    const humanPrompt = `Generá contenido para ${platform} en formato ${format}.

${sourceContext}

Recordá: JSON puro sin markdown. Lenguaje argentino (vos/tenés). Tono premium.`;

    // 4. Call Gemini
    const model = new ChatVertexAI({
        model: "gemini-2.5-flash",
        location: "global",
        maxOutputTokens: 4096,
        temperature: 0.8,
    });

    try {
        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(humanPrompt)
        ]);

        const text = response.content.toString();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Gemini no devolvió un JSON válido");

        const generated: GeneratedContent = JSON.parse(jsonMatch[0]);

        // 5. Save to database
        const saved = await prisma.socialContent.create({
            data: {
                platform,
                format,
                sourceType,
                sourceId: sourceId || null,
                sourceName,
                copy: generated.copy,
                hashtags: generated.hashtags || '',
                cta: generated.cta || '',
                imageUrl: null, // Se genera después si el usuario quiere
                imagePrompt: generated.imagePrompt || '',
                publishTips: JSON.stringify(generated.publishTips || {}),
                status: 'DRAFT'
            }
        });

        return {
            id: saved.id,
            ...generated,
            sourceName,
            platform,
            format,
            sourceType,
            createdAt: saved.createdAt
        };
    } catch (error: any) {
        const { handleAIError } = await import('@/lib/ai-error-handler');
        try {
            await handleAIError(error, 'Generador de Social Media (Copy)');
        } catch (handledError) {
            // Ignorar
        }
        throw error;
    }
}

// ── Image Generation (Gemini Imagen) ───────
export async function generateSocialImage(contentId: string) {
    const content = await prisma.socialContent.findUnique({ where: { id: contentId } });
    if (!content) throw new Error('Contenido no encontrado');
    if (!content.imagePrompt) throw new Error('No hay prompt de imagen');

    // Use Google GenAI for image generation
    const { GoogleGenAI } = await import('@google/genai');
    
    let ai;
    if (process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS) {
        const fs = await import('fs');
        const os = await import('os');
        const path = await import('path');
        const credsPath = path.join(os.tmpdir(), `vertex-creds-${Date.now()}.json`);
        
        try {
            // Parse and stringify to ensure it's valid JSON and handle any escaping issues from env vars
            const creds = JSON.parse(process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS);
            fs.writeFileSync(credsPath, JSON.stringify(creds));
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
            
            // Delete the API key temporarily to force Vertex AI usage
            const oldApiKey = process.env.GOOGLE_GENAI_API_KEY;
            delete process.env.GOOGLE_GENAI_API_KEY;
            
            ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GOOGLE_CLOUD_PROJECT || creds.project_id || '',
                location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
            });
            
            if (oldApiKey) process.env.GOOGLE_GENAI_API_KEY = oldApiKey;
        } catch (err) {
            console.error('Error setting up Vertex AI credentials:', err);
            ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
        }
    } else {
        ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
    }

    let response;
    try {
        response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: content.imagePrompt,
            config: {
                numberOfImages: 1,
            }
        });
    } catch (error: any) {
        const { handleAIError } = await import('@/lib/ai-error-handler');
        try {
            await handleAIError(error, 'Generación de Imagen IA (Social Media)');
        } catch (handledError) {
            // Ignorar
        }
        throw error;
    }

    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error('No se pudo generar la imagen');
    }

    const imageData = response.generatedImages[0].image;
    if (!imageData?.imageBytes) throw new Error('Imagen sin datos');

    // Save to storage
    const { uploadFile } = await import('@/lib/storage');
    const buffer = Buffer.from(imageData.imageBytes, 'base64');
    const key = `social/${contentId}-${Date.now()}.png`;
    await uploadFile(buffer, key, 'image/png');

    // Update record
    await prisma.socialContent.update({
        where: { id: contentId },
        data: { imageUrl: key }
    });

    return { imageUrl: key };
}
