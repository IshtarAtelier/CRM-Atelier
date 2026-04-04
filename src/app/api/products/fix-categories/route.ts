import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Mapeo de tipos legacy → nuevos valores
const TYPE_MAP: Record<string, string> = {
    'MONOFOCAL': 'Cristal Monofocal',
    'MULTIFOCAL': 'Cristal Multifocal',
    'BIFOCAL': 'Cristal Bifocal',
    'OCUPACIONAL': 'Cristal Ocupacional',
    'SOLAR': 'Cristal Solar',
};

export async function POST() {
    try {
        const log: string[] = [];

        // 1. Corregir category = 'LENS' → 'Cristal'
        const lensCount = await prisma.product.updateMany({
            where: { category: 'LENS' },
            data: { category: 'Cristal' }
        });
        log.push(`Categoría LENS → Cristal: ${lensCount.count} productos`);

        // 2. Corregir types legacy
        for (const [oldType, newType] of Object.entries(TYPE_MAP)) {
            const updated = await prisma.product.updateMany({
                where: { type: oldType },
                data: { type: newType }
            });
            if (updated.count > 0) {
                log.push(`Tipo ${oldType} → ${newType}: ${updated.count} productos`);
            }
        }

        // 3. Asegurar unitType PAR para cristales
        const fixUnit = await prisma.product.updateMany({
            where: {
                category: 'Cristal',
                NOT: { unitType: 'PAR' }
            },
            data: { unitType: 'PAR' }
        });
        if (fixUnit.count > 0) {
            log.push(`UnitType → PAR: ${fixUnit.count} cristales`);
        }

        return NextResponse.json({ success: true, log });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
