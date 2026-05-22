import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';

export async function POST(req: Request) {
    try {
        const url = new URL(req.url);
        const key = url.searchParams.get('key');
        
        if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

        const arrayBuffer = await req.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // uploadFile will store it locally since Cloud is disabled
        await uploadFile(buffer, key, req.headers.get('content-type') || 'application/octet-stream');

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
