import Parser from 'rss-parser';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';
import { sanitizeBlogHtml } from '@/lib/sanitize-blog';

const parser = new Parser();

export async function generateWeeklyBlogPost(adminPhone: string) {
  try {
    // 1. Fetch Optical News from RSS (Ej: Vision Monday o Invision Mag)
    const feed = await parser.parseURL('https://www.invisionmag.com/feed/');
    
    // Tomamos la noticia más reciente que no hayamos procesado
    // (Simplificado: tomamos el primer item)
    const latestNews = feed.items[0];

    if (!latestNews || !latestNews.content) {
      throw new Error("No se encontró contenido en el RSS");
    }

    console.log('[Blog Agent] Noticia encontrada:', latestNews.title);

    // 2. Usar Gemini para redactar el artículo al estilo Atelier
    const model = new ChatVertexAI({
        model: "gemini-2.5-flash",
        location: "global",
        maxOutputTokens: 8192,
        temperature: 0.7,
    });

    const systemPrompt = `Actúa como un copywriter experto en óptica premium y consultor de optimización de motores de Inteligencia Artificial (GEO/AIO) para 'Atelier Óptica', una óptica boutique exclusiva en Córdoba, Argentina.
Tu tarea es escribir un artículo de blog en español de Argentina (usando 'vos', 'tenés', etc.) basado en una noticia.
Debe ser elegante, sumamente profesional, de tono editorial independiente pero con enfoque médico-comercial de alta autoridad.

DIRECTIVAS DE REDACCIÓN Y SEÑALES 2025/2026:
1. **E-E-A-T Explícito (Experiencia y Autoridad):**
   Al final del artículo (dentro del campo "content" en formato HTML), debes incluir un bloque estilizado de autoría (SIN atribuir revisión médica a ninguna persona):
   - Un div con borde y fondo suave (ej. \`<div class="eeat-author border-t border-black/10 mt-8 pt-4 text-xs text-[#555] italic">...</div>\`).
   - Autoría genérica del equipo: "Redactado por el equipo de Atelier Óptica, tu óptica boutique en el Cerro de las Rosas, Córdoba."
   - PROHIBIDO inventar: NO incluyas matrículas profesionales (M.P.), fechas de "revisión médica", ni nombres de profesionales específicos, ni atribuyas la revisión a nadie.
   - Descargo de responsabilidad médica profesional (Medical Disclaimer): "Este contenido es únicamente educativo e informativo y no sustituye la consulta o diagnóstico con un profesional médico oftalmólogo."

2. **Estructura GEO (SearchGPT y Perplexity):**
   - Redactá con afirmaciones claras y útiles, pero NO inventes ni cites estudios, estadísticas ni fuentes (nada de "según la OMS/AAO/estudios demuestran") salvo que la noticia de origen las aporte textualmente. Ante la duda, escribí sin cifras.
   - Al final de la nota (justo antes del bloque E-E-A-T), agrega una sección de Preguntas Frecuentes (FAQ) con etiquetas <h3> y respuestas muy breves y directas (de 1 o 2 oraciones máximo) que los motores de búsqueda por IA puedan extraer fácilmente como snippets.

3. **Sugerencias de Contenido Multimedia:**
   - Integra en el contenido HTML alguna sugerencia visual (como una tabla comparativa en HTML, o un bloque con texto indicando '[Infografía sugerida: Comparación visual de...]') para enriquecer la lectura.

4. **Señales de Local SEO:**
   - Incorpora orgánicamente palabras clave locales referidas a Córdoba Capital, Cerro de las Rosas y la calle José Luis de Tejeda 4380, reforzando la cercanía y el asesoramiento personalizado en el local de Atelier.

El formato de salida DEBE ser estrictamente un objeto JSON plano, sin backticks ni etiquetas markdown, con la siguiente estructura:
{
  "title": "Título llamativo y optimizado para SEO",
  "excerpt": "Un resumen de 2 líneas para la portada del blog",
  "metaTitle": "Título SEO (máx 60 caracteres)",
  "metaDescription": "Descripción SEO (máx 160 caracteres)",
  "category": "Categoría (ej: Salud Visual, Tecnología, Tendencias)",
  "content": "El contenido completo del artículo en formato HTML. Usa <p className='lead'> para el primer párrafo, y etiquetas <h2>, <h3>, <p>, <ul>. Incluye aquí la sección de FAQ, las sugerencias multimedia, las citas GEO y el bloque E-E-A-T al final."
}`;

    const humanPrompt = `Título Original: ${latestNews.title}\nContenido Original: ${latestNews.contentSnippet || latestNews.content.slice(0, 500)}...`;

    const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(humanPrompt)
    ]);

    const text = response.content.toString();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini no devolvió un JSON válido");

    const articleData = JSON.parse(jsonMatch[0]);

    // 3. Generar un slug único
    const baseSlug = articleData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    // Asignamos una imagen por defecto elegante de las que ya existen en el blog
    const randomImages = [
      '/images/blog/blog1_marcos.png',
      '/images/blog/blog2_homeoffice.png',
      '/images/blog/blog3_eligiendo.png',
      '/images/blog/blog4_leyendo.png',
      '/images/blog/blog5_cordoba.png',
      '/images/blog/blog6_consulta.png'
    ];
    const assignedImage = randomImages[Math.floor(Math.random() * randomImages.length)];

    // 4. Guardar en Base de Datos como DRAFT
    const newPost = await prisma.blogPost.create({
      data: {
        slug,
        title: articleData.title,
        excerpt: articleData.excerpt,
        metaTitle: articleData.metaTitle,
        metaDescription: articleData.metaDescription,
        content: sanitizeBlogHtml(articleData.content),
        category: articleData.category,
        imageUrl: assignedImage,
        status: "DRAFT",
      }
    });

    console.log('[Blog Agent] Artículo guardado en BD como Borrador:', newPost.slug);

    // 5. Enviar mensaje de WhatsApp al Admin
    const waMessage = `🤖 *Asistente Atelier (Blog IA)*\n\nHe redactado un nuevo artículo para el blog basado en noticias internacionales.\n\n*Título:* ${newPost.title}\n*Categoría:* ${newPost.category}\n\nEl artículo se ha guardado como *Borrador* en el sistema. Puedes revisarlo en el panel de administración para publicarlo.`;

    if (adminPhone) {
      await fetchWa('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: adminPhone,
          message: waMessage
        }),
      });
      console.log('[Blog Agent] Notificación de WhatsApp enviada al admin');
    }

    return newPost;

  } catch (error: any) {
    console.error('[Blog Agent] Error:', error);
    const { handleAIError } = await import('@/lib/ai-error-handler');
    try {
        await handleAIError(error, 'Agente Redactor de Blog (Google Vertex AI)');
    } catch (handledError) {
        // Ignorar el error lanzado por handleAIError, ya lo relanza
    }
    throw error;
  }
}
