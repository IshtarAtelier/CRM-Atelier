import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CrystalMapping } from '@/lib/config/crystal-mapping';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch all crystals
        const crystals = await prisma.product.findMany({
            where: { category: 'Cristal' }
        });

        // Fetch extra treatments
        const treatments = await prisma.product.findMany({
            where: { category: 'Tratamientos y Accesorios' }
        });

        if (!crystals || crystals.length === 0) {
            return NextResponse.json({ error: 'No se encontraron cristales' }, { status: 404 });
        }

        const findTintPrice = () => {
            const tintProduct = treatments.find(p => p.name?.toLowerCase().includes('teñido') || p.name?.toLowerCase().includes('tenido'));
            if (tintProduct && tintProduct.price) return tintProduct.price;
            return CrystalMapping.EXTRAS.TINT; // fallback to hardcoded if deleted
        };

        // Helper function to find minimum price matching config
        const findPrice = (config: any) => {
            let matches = crystals;

            // Filter by Type
            if (config.type) {
                matches = matches.filter(p => p.type === config.type);
            }

            // Exact Name Match
            if (config.exactMatchName) {
                const exactMatch = matches.find(p => p.name?.toLowerCase() === config.exactMatchName.toLowerCase());
                if (exactMatch && exactMatch.price) return exactMatch.price;
            }

            // Keyword Matches
            if (config.matchKeywords && config.matchKeywords.length > 0) {
                matches = matches.filter(p => 
                    config.matchKeywords.some((kw: string) => p.name?.toLowerCase().includes(kw))
                );
            } else if (config.matchKeywords && config.matchKeywords.length === 0 && config.type === "Cristal Monofocal") {
                // Estandar blanco: excluye tratamientos especiales si no hay keywords
                matches = matches.filter(p => 
                    !p.name?.toLowerCase().includes('blue') && 
                    !p.name?.toLowerCase().includes('foto') &&
                    !p.name?.toLowerCase().includes('transitions')
                );
            }

            if (matches.length === 0) return 0;
            return Math.min(...matches.map(p => p.price || 0));
        };

        // Construct dynamic pricing based on mapping and inventory
        const PRICING = {
            MONOFOCAL: {
                ORGANICO_BLANCO: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_BLANCO),
                ORGANICO_AR: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_AR),
                ORGANICO_BLUE: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_BLUE),
                POLI_BLUE: findPrice(CrystalMapping.MONOFOCAL.POLI_BLUE),
                ORGANICO_FOTOCROMATICO: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_FOTOCROMATICO),
                ORGANICO_BLANCO_TENIDO: findPrice(CrystalMapping.MONOFOCAL.ORGANICO_BLANCO_TENIDO),
            },
            BIFOCAL: {
                ORGANICO_BLANCO: findPrice(CrystalMapping.BIFOCAL.ORGANICO_BLANCO),
            },
            MULTIFOCAL: {
                SMART_FREE: findPrice(CrystalMapping.MULTIFOCAL.SMART_FREE),
                VARILUX: findPrice(CrystalMapping.MULTIFOCAL.VARILUX),
                FOTOCROMATICO: findPrice(CrystalMapping.MULTIFOCAL.FOTOCROMATICO),
            },
            EXTRAS: {
                TINT: findTintPrice()
            }
        };

        // Fallbacks for missing products in DB (prevent 0 prices on web)
        if (PRICING.MONOFOCAL.ORGANICO_BLANCO === 0) PRICING.MONOFOCAL.ORGANICO_BLANCO = 20000;
        if (PRICING.MONOFOCAL.ORGANICO_AR === 0) PRICING.MONOFOCAL.ORGANICO_AR = PRICING.MONOFOCAL.ORGANICO_BLANCO + 25000;
        if (PRICING.MONOFOCAL.ORGANICO_BLUE === 0) PRICING.MONOFOCAL.ORGANICO_BLUE = 68000;
        if (PRICING.MONOFOCAL.POLI_BLUE === 0) PRICING.MONOFOCAL.POLI_BLUE = 120000;
        if (PRICING.MONOFOCAL.ORGANICO_FOTOCROMATICO === 0) PRICING.MONOFOCAL.ORGANICO_FOTOCROMATICO = 105000;
        if (PRICING.MONOFOCAL.ORGANICO_BLANCO_TENIDO === 0) PRICING.MONOFOCAL.ORGANICO_BLANCO_TENIDO = 68000;
        
        if (PRICING.BIFOCAL.ORGANICO_BLANCO === 0) PRICING.BIFOCAL.ORGANICO_BLANCO = 45000;

        if (PRICING.MULTIFOCAL.SMART_FREE === 0) PRICING.MULTIFOCAL.SMART_FREE = 120000;
        if (PRICING.MULTIFOCAL.VARILUX === 0) PRICING.MULTIFOCAL.VARILUX = 350000;
        if (PRICING.MULTIFOCAL.FOTOCROMATICO === 0) PRICING.MULTIFOCAL.FOTOCROMATICO = PRICING.MULTIFOCAL.SMART_FREE + 50000;

        return NextResponse.json(PRICING);
    } catch (error) {
        console.error('Error fetching web pricing:', error);
        return NextResponse.json({ error: 'Error al obtener precios dinámicos' }, { status: 500 });
    }
}
