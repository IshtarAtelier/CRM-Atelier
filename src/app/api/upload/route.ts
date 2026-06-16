import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';

const BLOCKED_EXTENSIONS = ['exe', 'sh', 'bat', 'cmd', 'ps1', 'php', 'pl', 'py', 'js', 'html', 'htm'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 10MB' }, { status: 400 });
        }

        // Validate file extension (Blacklist approach for maximum stability)
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            return NextResponse.json({
                error: `Tipo de archivo no seguro. No se permiten archivos ejecutables o scripts.`
            }, { status: 400 });
        }

        // Use unified storage service
        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `${timestamp}_${safeName}`;
        
        const urlOrKey = await uploadFile(buffer, filename, file.type || 'application/octet-stream');

        // We return the result of uploadFile. 
        // If it's local, it will be "local://filename"
        // If it's cloud, it will be "filename" (the key)
        return NextResponse.json({ url: urlOrKey });
    } catch (error: any) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ error: error.message || 'Error uploading' }, { status: 500 });
    }
}
