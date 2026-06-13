import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { defaultWebSettings } from '@/lib/web-settings';

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

        const setting = await prisma.systemSetting.upsert({
            where: { key },
            update: { value: JSON.stringify(value) },
            create: { key, value: JSON.stringify(value) }
        });

        return NextResponse.json({ success: true, setting: { key: setting.key, value: JSON.parse(setting.value) } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
