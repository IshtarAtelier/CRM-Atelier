import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow more time for AI generation

const topics = [
    "Beneficios de los cristales multifocales Varilux",
    "Cómo cuidar tus lentes para que no se rayen",
    "Diferencias entre miopía, astigmatismo e hipermetropía",
    "La importancia del filtro de luz azul (Blue UV) en el trabajo",
    "Tendencias en armazones para este año",
    "Por qué elegir cristales Crizal antireflejo",
    "Señales de que necesitas cambiar tus anteojos",
    "Lentes de contacto: mitos y verdades",
    "Anteojos de sol: cómo elegir el mejor filtro UV",
    "Presbicia: qué es y cómo solucionarla",
    "Cristales fotocromáticos Transitions: ventajas en el día a día",
    "Cómo leer tu receta oftalmológica fácilmente",
    "Salud visual infantil: cuándo llevar a los niños al oculista",
    "Materiales de armazones: acetato vs metal vs TR90",
    "Peligros de comprar anteojos pregraduados en la farmacia"
];

// Fallback high quality Unsplash images for optics
const fallbackImages = [
    "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1510255959955-467000bf754a?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1473496169904-6a58cb3ab8c3?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1512402128796-03c09930f730?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509695507497-903c140c43b0?q=80&w=1600&auto=format&fit=crop"
];

const BlogSchema = z.object({
    title: z.string().describe("Título atractivo y SEO friendly del artículo"),
    slug: z.string().describe("Slug para la URL, en minúsculas y separado por guiones. Ej: beneficios-cristales-varilux"),
    excerpt: z.string().describe("Un extracto breve (max 200 caracteres) que invite a leer"),
    metaTitle: z.string().describe("Meta título para Google (max 60 caracteres)"),
    metaDescription: z.string().describe("Meta descripción para Google (max 150 caracteres)"),
    content: z.string().describe("Contenido HTML completo del post. Usa <h2>, <h3>, <p>, <ul>, <li> y <strong>. Tono cálido, argentino boutique. Al final recomienda visitar Atelier Óptica en Cerro de las Rosas."),
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
        }

        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const apiKey = process.env.GOOGLE_GENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Falta API key de Google' }, { status: 500 });
        }

        // 1. Pick a random topic that hasn't been written about recently (or just random for simplicity)
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        const randomImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];

        // 2. Call Gemini
        const llm = new ChatGoogleGenerativeAI({
            apiKey: apiKey,
            model: "gemini-2.5-flash",
            temperature: 0.7,
        });

        const structuredLlm = llm.withStructuredOutput(BlogSchema);

        const prompt = `
Eres un óptico experto y redactor de blogs para "Atelier Óptica", una óptica boutique premium ubicada en el Cerro de las Rosas, Córdoba, Argentina.
Tu tarea es escribir un artículo de blog sobre: "${randomTopic}".

Reglas estrictas:
1. Escribe en español argentino (usando "vos", "tenés", etc.), pero manteniendo un tono súper premium, cálido y profesional.
2. El contenido debe ser HTML limpio (solo etiquetas interiores como <h2>, <h3>, <p>, <ul>, <li>, <strong>). No incluyas <html> ni <body> ni <h1> (el h1 se pone solo).
3. Escribe al menos 5 párrafos bien desarrollados, aportando valor real y consejos prácticos.
4. Utiliza subtítulos (<h2> y <h3>) para organizar la información.
5. Al final del artículo, incluye siempre un "Llamado a la acción" sutil invitando al lector a visitar el local en José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba, o a consultar por WhatsApp para un asesoramiento personalizado.
6. El "slug" debe estar en minúsculas, sin acentos y con guiones.
`;

        console.log(`[AutoBlog] Generando post sobre: ${randomTopic}...`);
        
        const response = await structuredLlm.invoke(prompt);

        console.log(`[AutoBlog] Post generado exitosamente. Título: ${response.title}`);

        // 3. Save to database
        // Handle slug collisions by adding timestamp if needed
        const existingPost = await prisma.blogPost.findUnique({
            where: { slug: response.slug }
        });
        
        let finalSlug = response.slug;
        if (existingPost) {
            finalSlug = `${response.slug}-${Date.now().toString().slice(-4)}`;
        }

        const post = await prisma.blogPost.create({
            data: {
                title: response.title,
                slug: finalSlug,
                excerpt: response.excerpt,
                metaTitle: response.metaTitle,
                metaDescription: response.metaDescription,
                content: response.content,
                category: "Blog",
                imageUrl: randomImage,
                status: "PUBLISHED" // Se publica directamente
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Artículo generado y publicado automáticamente',
            post: {
                id: post.id,
                title: post.title,
                slug: post.slug
            }
        });

    } catch (error: any) {
        console.error('[AutoBlog] Error:', error);
        return NextResponse.json({ error: error.message || 'Error del servidor en cron handler' }, { status: 500 });
    }
}
