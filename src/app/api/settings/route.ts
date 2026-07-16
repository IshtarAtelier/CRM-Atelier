import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { defaultWebSettings } from '@/lib/web-settings';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (key) {
            const setting = await prisma.systemSetting.findUnique({ where: { key } });
            if (!setting) {
                const defaultValue = defaultWebSettings[key as keyof typeof defaultWebSettings];
                return NextResponse.json({ value: defaultValue !== undefined ? defaultValue : null });
            }
            try {
                return NextResponse.json({ value: JSON.parse(setting.value) });
            } catch {
                return NextResponse.json({ value: setting.value });
            }
        }

        const settings = await prisma.systemSetting.findMany();
        const formatted = settings.reduce((acc, curr) => {
            try {
                acc[curr.key] = JSON.parse(curr.value);
            } catch {
                acc[curr.key] = curr.value;
            }
            return acc;
        }, {} as Record<string, any>);

        const responseData = {
            ...defaultWebSettings,
            ...formatted
        };

        return NextResponse.json(responseData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        // Leer el valor previo antes del upsert para dejar before/after en la auditoría
        const previo = await prisma.systemSetting.findUnique({ where: { key } });
        let valorPrevio: any = null;
        if (previo) {
            try {
                valorPrevio = JSON.parse(previo.value);
            } catch {
                valorPrevio = previo.value;
            }
        }

        const setting = await prisma.systemSetting.upsert({
            where: { key },
            update: { value: JSON.stringify(value) },
            create: { key, value: JSON.stringify(value) }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'SETTING',
            entityId: key,
            details: {
                descripcion: `Configuración "${key}" ${previo ? 'actualizada' : 'creada'}`,
                key,
                before: valorPrevio,
                after: value,
            },
        });

        return NextResponse.json({ success: true, setting: { key: setting.key, value: JSON.parse(setting.value) } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
