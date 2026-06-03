import { NextResponse } from 'next/server';
import { generateSocialContent, generateSocialImage } from '@/services/social-content.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { platform, format, sourceType, sourceId, topic, action, imageStyle, goal } = body;

        // Image generation for existing content
        if (action === 'generate-image' && body.contentId) {
            const result = await generateSocialImage(body.contentId);
            return NextResponse.json({ success: true, ...result });
        }

        // Validate required fields
        if (!platform || !format || !sourceType) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: platform, format, sourceType' },
                { status: 400 }
            );
        }

        const validPlatforms = ['INSTAGRAM', 'FACEBOOK', 'WHATSAPP'];
        const validFormats = ['POST', 'STORY', 'REEL', 'CAROUSEL'];
        const validSources = ['PRODUCT', 'BLOG', 'PROMO', 'FREE'];

        if (!validPlatforms.includes(platform)) {
            return NextResponse.json({ error: `Plataforma inválida. Usar: ${validPlatforms.join(', ')}` }, { status: 400 });
        }
        if (!validFormats.includes(format)) {
            return NextResponse.json({ error: `Formato inválido. Usar: ${validFormats.join(', ')}` }, { status: 400 });
        }
        if (!validSources.includes(sourceType)) {
            return NextResponse.json({ error: `Tipo de fuente inválido. Usar: ${validSources.join(', ')}` }, { status: 400 });
        }

        // Require sourceId for PRODUCT and BLOG
        if ((sourceType === 'PRODUCT' || sourceType === 'BLOG') && !sourceId) {
            return NextResponse.json({ error: 'sourceId es requerido para PRODUCT y BLOG' }, { status: 400 });
        }

        const result = await generateSocialContent({ platform, format, sourceType, sourceId, topic, imageStyle, goal });

        return NextResponse.json({ success: true, content: result });
    } catch (error: any) {
        console.error('[API Social Generate] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error al generar contenido' },
            { status: 500 }
        );
    }
}
