import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/products/ocr-update
 * Receives a lab price list image (base64), uses Gemini Vision to extract product/price data,
 * then matches against existing products in the DB filtered by laboratory.
 * 
 * Body: { imageBase64, laboratory, calibrado, iva }
 * Returns: { extracted: [...], matches: [...] }
 */
export async function POST(request: Request) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede actualizar precios' }, { status: 403 });
        }

        const body = await request.json();
        const { imageBase64, laboratory, calibrado = 40000, iva = 21 } = body;

        if (!imageBase64) {
            return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 });
        }
        if (!laboratory) {
            return NextResponse.json({ error: 'Se requiere el nombre del laboratorio' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API Key de Gemini no configurada. Agregar GOOGLE_GENAI_API_KEY en .env' }, { status: 500 });
        }

        // 1. Use Gemini Vision to extract price data from image
        const model = new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash',
            maxOutputTokens: 4096,
            temperature: 0,
            apiKey,
        });

        const systemPrompt = `Eres un experto en óptica que extrae datos de listas de precios de laboratorios de lentes oftálmicos.
Analiza la imagen y extrae TODOS los productos con sus precios.

Para cada producto encontrado, devuelve:
- "linea": la línea/diseño del lente (ej: "Varilux XR Design", "Varilux Comfort", "Crizal Prevencia", etc.)
- "material": el material del lente (ej: "ORMA", "AIRWEAR 1.59", "STYLIS 1.67", etc.)  
- "tratamiento": el tratamiento o capa aplicada (ej: "Crizal Prevencia", "Crizal Sapphire", "Transitions", "Xperio", etc.)
- "color": si aplica color especial (ej: "Gen S", "Xperio", blank si no aplica)
- "precio": el precio numérico SIN formato, solo el número. Quita puntos de miles y símbolos $. Ejemplo: si dice "$ 515.260" devuelve 515260

REGLAS IMPORTANTES:
- Cada fila de la tabla es un producto independiente
- El precio siempre es la última columna numérica de cada fila
- Si hay varias columnas de precio (diferentes tratamientos), crea una entrada por cada combinación material+tratamiento
- Los precios con punto son separadores de miles (ej: 515.260 = 515260)
- No inventes datos que no estén en la imagen
- Incluye ABSOLUTAMENTE TODOS los productos visibles

Devuelve SOLO un JSON válido con esta estructura:
{
  "productos": [
    { "linea": "...", "material": "...", "tratamiento": "...", "color": "", "precio": 515260 },
    ...
  ]
}`;

        // Clean the base64 data - remove data URI prefix if present
        let cleanBase64 = imageBase64;
        let mimeType = 'image/png';
        if (imageBase64.startsWith('data:')) {
            const [header, data] = imageBase64.split(',');
            cleanBase64 = data;
            const mimeMatch = header.match(/data:([^;]+)/);
            if (mimeMatch) mimeType = mimeMatch[1];
        }

        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage({
                content: [
                    { type: 'text', text: 'Extrae todos los productos y precios de esta lista de precios de laboratorio óptico.' },
                    {
                        type: 'image_url',
                        image_url: `data:${mimeType};base64,${cleanBase64}`
                    }
                ]
            })
        ]);

        // 2. Parse AI response
        let extracted: { linea: string; material: string; tratamiento: string; color: string; precio: number }[] = [];
        try {
            const text = response.content.toString();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                extracted = parsed.productos || [];
            }
        } catch (e) {
            console.error('[OCR-Update] Failed to parse AI response:', e, response.content);
            return NextResponse.json({ error: 'Error al interpretar la imagen. Intente con una captura más clara.' }, { status: 422 });
        }

        if (extracted.length === 0) {
            return NextResponse.json({ error: 'No se encontraron productos en la imagen' }, { status: 422 });
        }

        // 3. Calculate costs: (precio + calibrado) * (1 + iva/100)
        const ivaMultiplier = 1 + (iva / 100);
        const processedItems = extracted.map(item => {
            const costoFinal = Math.round((item.precio + calibrado) * ivaMultiplier);
            return {
                ...item,
                precioLista: item.precio,
                calibrado,
                iva,
                costoFinal,
            };
        });

        // 4. Fetch existing products for this laboratory
        const existingProducts = await prisma.product.findMany({
            where: {
                laboratory: {
                    equals: laboratory.toUpperCase(),
                    mode: 'insensitive',
                },
                category: 'Cristal',
            },
            select: {
                id: true,
                name: true,
                brand: true,
                type: true,
                lensIndex: true,
                cost: true,
                price: true,
                laboratory: true,
            }
        });

        // 5. Try to match extracted items with existing products
        const matches = processedItems.map(item => {
            // Build search terms from the extracted item
            const searchTerms = [
                item.linea?.toLowerCase() || '',
                item.material?.toLowerCase() || '',
                item.tratamiento?.toLowerCase() || '',
                item.color?.toLowerCase() || '',
            ].filter(Boolean);

            // Try to find a matching product
            let bestMatch: typeof existingProducts[0] | null = null;
            let bestScore = 0;

            for (const product of existingProducts) {
                let score = 0;
                const productName = (product.name || '').toLowerCase();
                const productBrand = (product.brand || '').toLowerCase();
                const productType = (product.type || '').toLowerCase();
                const productIndex = (product.lensIndex || '').toLowerCase();
                const fullText = `${productBrand} ${productName} ${productType} ${productIndex}`;

                // Check each search term
                for (const term of searchTerms) {
                    if (term && fullText.includes(term)) {
                        score += 2;
                    }
                    // Partial matching — check individual words
                    const words = term.split(/\s+/);
                    for (const word of words) {
                        if (word.length > 2 && fullText.includes(word)) {
                            score += 1;
                        }
                    }
                }

                // Bonus for material/index matching
                const materialIndex = item.material?.match(/\d+\.\d+/)?.[0] || '';
                if (materialIndex && productIndex.includes(materialIndex)) {
                    score += 3;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = product;
                }
            }

            return {
                extracted: item,
                match: bestScore >= 3 ? bestMatch : null,
                score: bestScore,
                costoAnterior: bestMatch && bestScore >= 3 ? bestMatch.cost : null,
                precioAnterior: bestMatch && bestScore >= 3 ? bestMatch.price : null,
            };
        });

        return NextResponse.json({
            extracted: processedItems,
            matches,
            laboratory,
            totalExtracted: processedItems.length,
            totalMatched: matches.filter(m => m.match).length,
        });

    } catch (error: any) {
        console.error('[OCR-Update] Error:', error);
        return NextResponse.json({
            error: 'Error al procesar la imagen',
            details: error.message
        }, { status: 500 });
    }
}
