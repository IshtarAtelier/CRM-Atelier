import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers, cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { defaultWebSettings } from '@/lib/web-settings';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        // Esta ruta es GET público (la tienda lee el cartel, la dirección y las
        // promos sin sesión). Sin este filtro devolvía la tabla SystemSetting
        // ENTERA a cualquiera en internet: `bot_prompt` (el prompt comercial
        // completo), `bot_daily_context`, `social_publicaciones` y el estado
        // interno de las sincronizaciones. Solo las claves `web_` son públicas.
        //
        // La sesión se lee ACÁ, no de `x-user-id`: el middleware marca esta ruta
        // como GET público y por eso nunca inyecta esos headers, ni siquiera con
        // una sesión válida. Confiar en el header dejaba al panel de admin sin
        // las claves que no son `web_`.
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('session')?.value;
        const payload = sessionToken ? await decrypt(sessionToken) : null;
        // Las cuentas OPTICA (mayoristas externos) son público a estos efectos.
        const esPublico = !payload || payload.role === 'OPTICA';
        const esClaveWeb = (k: string) => k.startsWith('web_');

        if (key) {
            if (esPublico && !esClaveWeb(key)) {
                return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
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

        const settings = esPublico
            ? await prisma.systemSetting.findMany({ where: { key: { startsWith: 'web_' } } })
            : await prisma.systemSetting.findMany();
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
