import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';

const BLOCKED_EXTENSIONS = ['exe', 'sh', 'bat', 'cmd', 'ps1', 'php', 'pl', 'py', 'js', 'html', 'htm'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RETRIES = 3;

// Check if an error is transient and worth retrying
function isTransientError(error: any): boolean {
    const msg = error?.message || error?.toString() || '';
    return (
        msg.includes('Premature close') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('socket hang up') ||
        msg.includes('network') ||
        msg.includes('fetch failed') ||
        msg.includes('Invalid response body')
    );
}

async function uploadWithRetry(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await uploadFile(buffer, filename, contentType);
        } catch (error: any) {
            lastError = error;
            if (attempt < MAX_RETRIES && isTransientError(error)) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
                console.warn(`[Upload] Attempt ${attempt}/${MAX_RETRIES} failed (transient). Retrying in ${delay}ms...`, error.message);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

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

        // Use unified storage service with retry for transient errors
        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `${timestamp}_${safeName}`;
        
        const urlOrKey = await uploadWithRetry(buffer, filename, file.type || 'application/octet-stream');

        // We return the result of uploadFile. 
        // If it's local, it will be "local://filename"
        // If it's cloud, it will be "filename" (the key)
        return NextResponse.json({ url: urlOrKey });
    } catch (error: any) {
        console.error('Error uploading file:', error);
        // Provide a user-friendly message for OAuth/network errors
        const msg = error?.message || '';
        if (msg.includes('Premature close') || msg.includes('Invalid response body') || msg.includes('oauth2')) {
            return NextResponse.json({ 
                error: 'Error de conexión con Google Cloud al subir la imagen. Por favor, intentá de nuevo.' 
            }, { status: 502 });
        }
        return NextResponse.json({ error: error.message || 'Error uploading' }, { status: 500 });
    }
}
