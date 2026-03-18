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
        headers: ['Marca', 'Modelo', 'Tipo', 'Precio', 'Costo', 'Stock'],
        examples: [
            'Ray-Ban,RB5154 Clubmaster,Armazón de Receta,125000,62000,2',
            'Oakley,OX8046 Airdrop,Armazón de Receta,98000,48000,1',
            'Guess,GU2700,Armazón de Receta,45000,22000,3',
            'Tommy Hilfiger,TH1760,Armazón de Receta,78000,38000,1',
        ],
    },
    sol: {
        filename: 'plantilla_lentes_sol_atelier.csv',
        headers: ['Marca', 'Modelo', 'Precio', 'Costo', 'Stock'],
        examples: [
            'Ray-Ban,RB3025 Aviator,185000,92000,2',
            'Oakley,Holbrook OO9102,145000,71000,1',
            'Carrera,1056/S,98000,48000,3',
        ],
    },
    accesorios: {
        filename: 'plantilla_accesorios_atelier.csv',
        headers: ['Nombre', 'Marca', 'Precio', 'Costo', 'Stock'],
        examples: [
            'Líquido Limpiador 120ml,Zeiss,5500,2800,10',
            'Estuche Rígido Premium,Atelier,8000,3500,15',
            'Paño Microfibra,Atelier,2000,800,25',
        ],
    },
};

// GET /api/products/import?type=cristales|armazones|sol|accesorios — Download CSV template
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

// Map user-friendly tipo text → (category, type) for the Product model
function resolveCategory(tipoText: string): { category: string; type: string } {
    const t = (tipoText || '').toLowerCase().trim();

    // Cristales subtypes
    if (t.includes('monofocal')) return { category: 'Cristal', type: 'Cristal Monofocal' };
    if (t.includes('multifocal') || t.includes('progresivo')) return { category: 'Cristal', type: 'Cristal Multifocal' };
    if (t.includes('bifocal')) return { category: 'Cristal', type: 'Cristal Bifocal' };
    if (t.includes('ocupacional')) return { category: 'Cristal', type: 'Cristal Ocupacional' };
    if (t.includes('coquil')) return { category: 'Cristal', type: 'Cristal Coquil' };

    // Non-crystal categories
    if (t.includes('sol') || t.includes('sun')) return { category: 'Lentes de Sol', type: 'Lentes de Sol' };
    if (t.includes('contacto') || t.includes('contact')) return { category: 'Lentes de Contacto', type: 'Lentes de Contacto' };
    if (t.includes('especial')) return { category: 'Lentes Especiales', type: 'Lentes Especiales' };
    if (t.includes('accesorio') || t.includes('accessory')) return { category: 'Lentes Especiales', type: 'Lentes Especiales' };
    if (t.includes('armazon') || t.includes('armazón') || t.includes('receta') || t.includes('frame')) return { category: 'Armazón de Receta', type: 'Armazón de Receta' };

    // Default: treat as crystal if nothing matched but has crystal-like context
    return { category: 'Cristal', type: tipoText || 'Cristal' };
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
        const headerRow = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

        // Detection logic:
        // - Has "indice" → cristales template
        // - Has "modelo" + "tipo" but no "indice" → armazones template (with Tipo column)
        // - Has "modelo" but no "tipo" and no "indice" → sol template
        // - Has "nombre" but no "modelo" → accesorios template
        const hasIndice = headerRow.includes('indice');
        const hasModelo = headerRow.includes('modelo');
        const hasTipo = headerRow.includes('tipo');
        const hasNombre = headerRow.includes('nombre');
        const isCristalTemplate = hasIndice;
        const isArmazonTemplate = hasModelo && hasTipo && !hasIndice;
        const isSolTemplate = hasModelo && !hasTipo && !hasIndice;
        const isAccesorioTemplate = hasNombre && !hasModelo && !hasIndice;

        const dataRows = lines.slice(1);
        const errors: string[] = [];
        const validItems: any[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const cols = parseCSVLine(row);

            if (isCristalTemplate) {
                // ─── CRISTALES logic ───
                // Headers: Marca, Nombre, Tipo, Indice, Precio, Costo, Stock, Unidad, Laboratorio, Esf_Min, Esf_Max, Cil_Min, Cil_Max, Adic_Min, Adic_Max
                if (cols.length < 5) {
                    errors.push(`Fila ${i + 2}: faltan columnas (mínimo: Marca, Nombre, Tipo, Índice, Precio)`);
                    continue;
                }

                const [brand, name, type, lensIndex, priceStr, costStr, stockStr, unitType, laboratory, sphMinStr, sphMaxStr, cylMinStr, cylMaxStr, addMinStr, addMaxStr] = cols;

                if (!brand && !name) {
                    errors.push(`Fila ${i + 2}: se necesita al menos Marca o Nombre`);
                    continue;
                }

                const resolved = forceCategory
                    ? { category: forceCategory, type: type || forceCategory }
                    : resolveCategory(type || 'Cristal');

                validItems.push({
                    brand: brand || null,
                    name: name || null,
                    model: name || null,
                    type: resolved.type,
                    category: resolved.category,
                    lensIndex: lensIndex || null,
                    price: parseArgentineNumber(priceStr),
                    cost: parseArgentineNumber(costStr),
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
            } else if (isArmazonTemplate) {
                // ─── ARMAZONES logic (with Tipo column) ───
                // Headers: Marca, Modelo, Tipo, Precio, Costo, Stock
                if (cols.length < 4) {
                    errors.push(`Fila ${i + 2}: faltan columnas (mínimo: Marca, Modelo, Tipo, Precio)`);
                    continue;
                }

                const [brand, model, tipo, priceStr, costStr, stockStr] = cols;

                if (!brand && !model) {
                    errors.push(`Fila ${i + 2}: se necesita al menos Marca o Modelo`);
                    continue;
                }

                const resolved = forceCategory
                    ? { category: forceCategory, type: tipo || forceCategory }
                    : resolveCategory(tipo || 'Armazón de Receta');

                validItems.push({
                    brand: brand || null,
                    name: model || null,
                    model: model || null,
                    type: resolved.type,
                    category: resolved.category,
                    lensIndex: null,
                    price: parseArgentineNumber(priceStr),
                    cost: parseArgentineNumber(costStr),
                    stock: parseInt(stockStr) || 0,
                    unitType: 'UNIDAD',
                    laboratory: null,
                });
            } else if (isSolTemplate) {
                // ─── LENTES DE SOL logic ───
                // Headers: Marca, Modelo, Precio, Costo, Stock
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
                    type: forceCategory || 'Lentes de Sol',
                    category: forceCategory || 'Lentes de Sol',
                    lensIndex: null,
                    price: parseArgentineNumber(priceStr),
                    cost: parseArgentineNumber(costStr),
                    stock: parseInt(stockStr) || 0,
                    unitType: 'UNIDAD',
                    laboratory: null,
                });
            } else if (isAccesorioTemplate) {
                // ─── ACCESORIOS logic ───
                // Headers: Nombre, Marca, Precio, Costo, Stock
                if (cols.length < 3) {
                    errors.push(`Fila ${i + 2}: faltan columnas (mínimo: Nombre, Marca, Precio)`);
                    continue;
                }

                const [name, brand, priceStr, costStr, stockStr] = cols;

                if (!name && !brand) {
                    errors.push(`Fila ${i + 2}: se necesita al menos Nombre o Marca`);
                    continue;
                }

                validItems.push({
                    brand: brand || null,
                    name: name || null,
                    model: null,
                    type: forceCategory || 'Lentes Especiales',
                    category: forceCategory || 'Lentes Especiales',
                    lensIndex: null,
                    price: parseArgentineNumber(priceStr),
                    cost: parseArgentineNumber(costStr),
                    stock: parseInt(stockStr) || 0,
                    unitType: 'UNIDAD',
                    laboratory: null,
                });
            } else {
                // ─── FALLBACK: legacy armazones format (Marca, Modelo, Precio, Costo, Stock) ───
                if (cols.length < 3) {
                    errors.push(`Fila ${i + 2}: faltan columnas`);
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
                    type: forceCategory || 'Armazón de Receta',
                    category: forceCategory || 'Armazón de Receta',
                    lensIndex: null,
                    price: parseArgentineNumber(priceStr),
                    cost: parseArgentineNumber(costStr),
                    stock: parseInt(stockStr) || 0,
                    unitType: 'UNIDAD',
                    laboratory: null,
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

        const templateLabel = isCristalTemplate ? 'cristales'
            : isArmazonTemplate ? 'armazones'
            : isSolTemplate ? 'lentes de sol'
            : isAccesorioTemplate ? 'accesorios'
            : 'productos';
        return NextResponse.json({
            success: true,
            imported: importedCount,
            errors: errors.length > 0 ? errors : undefined,
            message: `Se importaron ${importedCount} de ${dataRows.length} ${templateLabel}${errors.length > 0 ? `. ${errors.length} errores.` : '.'}`,
        });
    } catch (error: any) {
        console.error('Error importing products:', error);
        return NextResponse.json({ error: error.message || 'Error al importar' }, { status: 500 });
    }
}

// Parse Argentine-format numbers: "$567.732,00" → 567732
// Handles: $, dots as thousands separator, comma as decimal separator
function parseArgentineNumber(s: string): number {
    if (!s) return 0;
    const cleaned = s
        .replace(/\$/g, '')   // Remove $ sign
        .replace(/\s/g, '')   // Remove spaces
        .replace(/\./g, '')   // Remove dots (thousands separator)
        .replace(',', '.')    // Convert comma decimal to dot
        .trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
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
