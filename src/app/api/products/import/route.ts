import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// ─── Templates ────────────────────────────────────────────────
const TEMPLATES: Record<string, { filename: string; headers: string[]; examples: string[] }> = {
    cristales: {
        filename: 'plantilla_cristales_atelier.csv',
        headers: ['Marca', 'Nombre', 'Tipo', 'Indice', 'Precio', 'Costo', 'Stock', 'Unidad', 'Laboratorio', 'Esf_Min', 'Esf_Max', 'Cil_Min', 'Cil_Max', 'Adic_Min', 'Adic_Max'],
        examples: [
            'Essilor,Varilux Comfort 3.0,Multifocal,1.50,85000,42000,0,PAR,OPTOVISION,-8,4,-4,0,0.75,3.50',
            'Shamir,Autograph Intelligence,Multifocal,1.67,120000,58000,0,PAR,GRUPO OPTICO,-10,6,-6,0,1,3',
            'Rodenstock,Mono Plus 2,Monofocal,1.56,35000,15000,0,PAR,OPTOVISION,-12,8,-6,0,,',
        ],
    },
    armazones: {
        filename: 'plantilla_armazones_atelier.csv',
        headers: ['Marca', 'Modelo', 'Precio', 'Costo', 'Stock'],
        examples: [
            'Ray-Ban,RB5154 Clubmaster,125000,62000,2',
            'Oakley,OX8046 Airdrop,98000,48000,1',
            'Guess,GU2700,45000,22000,3',
            'Tommy Hilfiger,TH1760,78000,38000,1',
        ],
    },
};

// GET /api/products/import?type=cristales|armazones — Download CSV template
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'cristales';
    const template = TEMPLATES[type] || TEMPLATES['cristales'];

    const BOM = '\uFEFF';
    const csv = BOM + template.headers.join(',') + '\n' + template.examples.join('\n') + '\n';

    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${template.filename}"`,
        },
    });
}

// POST /api/products/import — Bulk import from CSV (auto-detects category)
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const forceCategory = (formData.get('category') as string) || null;

        if (!file) {
            return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
        }

        const text = await file.text();
        const lines = text
            .replace(/^\uFEFF/, '')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);

        if (lines.length < 2) {
            return NextResponse.json({ error: 'El archivo debe tener al menos una fila de datos además del encabezado' }, { status: 400 });
        }

        // Detect template type from header row
        const headerRow = parseCSVLine(lines[0]).map(h => h.toLowerCase());
        const isFrameTemplate = headerRow.includes('modelo') && !headerRow.includes('indice');

        const dataRows = lines.slice(1);
        const errors: string[] = [];
        const validItems: any[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const cols = parseCSVLine(row);

            if (isFrameTemplate) {
                // ─── ARMAZONES logic ───
                if (cols.length < 3) {
                    errors.push(`Fila ${i + 2}: faltan columnas (mínimo: Marca, Modelo, Precio)`);
                    continue;
                }

                const [brand, model, priceStr, costStr, stockStr] = cols;

                if (!brand && !model) {
                    errors.push(`Fila ${i + 2}: se necesita al menos Marca o Modelo`);
                    continue;
                }

                validItems.push({
                    brand: brand || null,
                    name: model || null,
                    model: model || null,
                    type: null,
                    category: forceCategory || 'FRAME',
                    lensIndex: null,
                    price: parseFloat(priceStr) || 0,
                    cost: parseFloat(costStr) || 0,
                    stock: parseInt(stockStr) || 0,
                    unitType: 'UNIDAD',
                    laboratory: null,
                });
            } else {
                // ─── CRISTALES logic ───
                if (cols.length < 5) {
                    errors.push(`Fila ${i + 2}: faltan columnas (mínimo: Marca, Nombre, Tipo, Índice, Precio)`);
                    continue;
                }

                const [brand, name, type, lensIndex, priceStr, costStr, stockStr, unitType, laboratory, sphMinStr, sphMaxStr, cylMinStr, cylMaxStr, addMinStr, addMaxStr] = cols;

                if (!brand && !name) {
                    errors.push(`Fila ${i + 2}: se necesita al menos Marca o Nombre`);
                    continue;
                }

                const typeLower = (type || '').toLowerCase();
                let category = forceCategory || 'LENS';
                if (!forceCategory) {
                    if (typeLower.includes('sol') || typeLower.includes('sun')) category = 'SUNGLASS';
                    else if (typeLower.includes('armazon') || typeLower.includes('frame')) category = 'FRAME';
                    else if (typeLower.includes('accesorio') || typeLower.includes('accessory')) category = 'ACCESSORY';
                }

                validItems.push({
                    brand: brand || null,
                    name: name || null,
                    model: name || null,
                    type: type || null,
                    category,
                    lensIndex: lensIndex || null,
                    price: parseFloat(priceStr) || 0,
                    cost: parseFloat(costStr) || 0,
                    stock: parseInt(stockStr) || 0,
                    unitType: (unitType || 'PAR').toUpperCase(),
                    laboratory: laboratory || null,
                    sphereMin: sphMinStr ? parseFloat(sphMinStr) : null,
                    sphereMax: sphMaxStr ? parseFloat(sphMaxStr) : null,
                    cylinderMin: cylMinStr ? parseFloat(cylMinStr) : null,
                    cylinderMax: cylMaxStr ? parseFloat(cylMaxStr) : null,
                    additionMin: addMinStr ? parseFloat(addMinStr) : null,
                    additionMax: addMaxStr ? parseFloat(addMaxStr) : null,
                });
            }
        }

        // Batch create all valid items
        let importedCount = 0;
        if (validItems.length > 0) {
            try {
                const result = await prisma.product.createMany({ data: validItems });
                importedCount = result.count;
            } catch (err: any) {
                errors.push(`Error en carga masiva: ${err.message}`);
            }
        }

        const label = isFrameTemplate ? 'armazones' : 'cristales';
        return NextResponse.json({
            success: true,
            imported: importedCount,
            category: isFrameTemplate ? 'FRAME' : 'LENS',
            errors: errors.length > 0 ? errors : undefined,
            message: `Se importaron ${importedCount} de ${dataRows.length} ${label}${errors.length > 0 ? `. ${errors.length} errores.` : '.'}`,
        });
    } catch (error: any) {
        console.error('Error importing products:', error);
        return NextResponse.json({ error: error.message || 'Error al importar' }, { status: 500 });
    }
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
