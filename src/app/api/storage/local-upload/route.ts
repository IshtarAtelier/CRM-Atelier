import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';
import { isPathTraversalKey } from '@/lib/utils/storage';

export async function POST(req: Request) {
    try {
        const url = new URL(req.url);
        const key = url.searchParams.get('key');
        
        if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

        // Traversal real por segmento (un ".." dentro del nombre es válido), más
        // el bloqueo de rutas absolutas y archivos ocultos.
        if (isPathTraversalKey(key) || key.startsWith('/') || key.startsWith('.')) {
            return NextResponse.json({ error: 'Invalid key: path traversal detected' }, { status: 400 });
        }

        const arrayBuffer = await req.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // uploadFile will store it locally since Cloud is disabled
        await uploadFile(buffer, key, req.headers.get('content-type') || 'application/octet-stream');

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
