import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, listFiles, deleteFile, getSignedUrl } from '@/lib/storage';

const BLOCKED_EXTENSIONS = ['exe', 'sh', 'bat', 'cmd', 'ps1', 'php', 'pl', 'py', 'js', 'html', 'htm'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// List all agent photos
export async function GET() {
    try {
        const files = await listFiles('agent_');
        
        // Resolve URLs for all files
        const filesWithUrls = await Promise.all(files.map(async (file) => {
            // Get public viewing URL: it uses /api/storage/view?key=...
            const cleanKey = file.key.replace('local://', '');
            const publicUrl = `/api/storage/view?key=${encodeURIComponent(cleanKey)}`;
            
            return {
                key: file.key,
                cleanKey,
                url: publicUrl,
                size: file.size,
                lastModified: file.lastModified
            };
        }));
        
        // Sort by last modified descending
        filesWithUrls.sort((a, b) => {
            const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return dateB - dateA;
        });

        return NextResponse.json({ success: true, files: filesWithUrls });
    } catch (error: any) {
        console.error('Error listing agent media:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error listing media' }, { status: 500 });
    }
}

// Upload a new agent photo
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ success: false, error: 'El archivo excede el tamaño máximo de 10MB' }, { status: 400 });
        }

        // Validate file extension
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            return NextResponse.json({
                success: false,
                error: 'Tipo de archivo no seguro. No se permiten archivos ejecutables o scripts.'
            }, { status: 400 });
        }

        // Verify it is an image
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({
                success: false,
                error: 'Solo se permite subir imágenes.'
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = file.name.startsWith('agent_') ? file.name : `agent_${timestamp}_${safeName}`;
        
        const urlOrKey = await uploadFile(buffer, filename, file.type || 'image/jpeg');
        const cleanKey = urlOrKey.replace('local://', '');
        const publicUrl = `/api/storage/view?key=${encodeURIComponent(cleanKey)}`;

        return NextResponse.json({
            success: true,
            file: {
                key: urlOrKey,
                cleanKey,
                url: publicUrl,
                name: file.name
            }
        });
    } catch (error: any) {
        console.error('Error uploading agent media:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error uploading media' }, { status: 500 });
    }
}

// Delete an agent photo
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) {
            return NextResponse.json({ success: false, error: 'Missing key' }, { status: 400 });
        }

        // Security check
        const cleanKey = key.replace('local://', '');
        if (cleanKey.includes('..') || cleanKey.includes('\\') || !cleanKey.startsWith('agent_')) {
            return NextResponse.json({ success: false, error: 'Forbidden: Invalid key' }, { status: 403 });
        }

        await deleteFile(key);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting agent media:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error deleting media' }, { status: 500 });
    }
}
