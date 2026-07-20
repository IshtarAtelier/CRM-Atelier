import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers, cookies } from 'next/headers';
import { defaultWebSettings } from '@/lib/web-settings';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { decrypt } from '@/lib/auth';

// Claves que pueden servirse SIN autenticación: la config pública de la web
// (defaults conocidos) y todo lo prefijado `web_`. El resto (COMISION, objetivos,
// MANUFACTURING_TIMES, etc.) es interno y solo para sesión no-OPTICA.
const isPublicSettingKey = (k: string) =>
    k.startsWith('web_') || Object.prototype.hasOwnProperty.call(defaultWebSettings, k);

// GET /api/settings es público en el middleware, así que la identidad se resuelve
// acá leyendo la cookie de sesión directamente.
async function isInternalUser(): Promise<boolean> {
    try {
        const token = (await cookies()).get('session')?.value;
        if (!token) return false;
        const payload = await decrypt(token);
        return !!payload && payload.role !== 'OPTICA';
    } catch {
        return false;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        const internal = await isInternalUser();

        if (key) {
            // Una clave interna solo se entrega a un usuario interno autenticado.
            if (!isPublicSettingKey(key) && !internal) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
            }
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
            // Sin sesión interna, solo se exponen las claves públicas.
            if (!internal && !isPublicSettingKey(curr.key)) return acc;
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
        console.error('[settings GET] error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
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
        console.error('[settings POST] error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
