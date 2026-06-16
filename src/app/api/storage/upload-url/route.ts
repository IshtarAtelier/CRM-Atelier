import { NextResponse } from 'next/server';
import { getUploadSignedUrl } from '@/lib/storage';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { filename, contentType, productId } = body;

        if (!filename || !contentType || !productId) {
            return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
        }

        // Sanitize productId to prevent path traversal
        const safeProductId = productId.replace(/[^a-zA-Z0-9_-]/g, '');

        // Generate a clean key
        const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `products/${safeProductId}/raw_${Date.now()}_${safeName}`;

        const { uploadUrl, key: finalKey } = await getUploadSignedUrl(key, contentType);

        return NextResponse.json({ uploadUrl, key: finalKey });
    } catch (error: any) {
        console.error('Error in upload-url:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
