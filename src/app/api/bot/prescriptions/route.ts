import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, imageBase64, imageMimeType, ...prescriptionData } = body;

        if (!clientId) {
            return NextResponse.json({ error: 'clientId es requerido' }, { status: 400 });
        }

        let imageUrl = null;
        if (imageBase64) {
            try {
                // Generar nombre de archivo único
                const ext = imageMimeType ? imageMimeType.split('/')[1] : 'jpg';
                const filename = `prescriptions/bot-${clientId}-${Date.now()}.${ext}`;
                const buffer = Buffer.from(imageBase64, 'base64');
                
                // Usar lib/storage para guardar de forma segura (Nube o Local)
                imageUrl = await uploadFile(buffer, filename, imageMimeType || 'image/jpeg');
            } catch (err) {
                console.error('[Bot Bridge Prescriptions] Error uploading image:', err);
            }
        }

        if (imageUrl) {
            prescriptionData.imageUrl = imageUrl;
        }

        // Mapear el JSON en español del bot a los campos de Prisma
        const mappedData = {
            ...prescriptionData,
            sphereOD: prescriptionData.odEsf,
            cylinderOD: prescriptionData.odCil,
            axisOD: prescriptionData.odEje,
            sphereOI: prescriptionData.oiEsf,
            cylinderOI: prescriptionData.oiCil,
            axisOI: prescriptionData.oiEje,
            addition: prescriptionData.add,
            pd: prescriptionData.odDip || prescriptionData.oiDip, // o calcular si hay DIP
            prescriptionType: prescriptionData.tipoDeLente === 'Multifocal' ? 'ADDITION' : 'FAR',
        };

        // Llamar a la capa de servicios para que ejecute validaciones y anti-duplicados
        const prescription = await ContactService.addPrescription(clientId, mappedData);

        // Log interaction
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'NOTE',
                content: `🤖 Bot procesó y cargó una nueva receta vía OCR.`
            }
        });

        return NextResponse.json(prescription);
    } catch (error: any) {
        console.error('[Bot Bridge Prescriptions POST] Error:', error);
        return NextResponse.json({ error: 'Error al guardar receta' }, { status: 500 });
    }
}
