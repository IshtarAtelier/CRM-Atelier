import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { CashService } from '@/services/cash.service';

// PATCH /api/users/[id] — Update user (name, role, password)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const roleHeader = request.headers.get('x-user-role');
        const requesterId = request.headers.get('x-user-id');

        const { id } = await params;
        const body = await request.json();
        const { name, role, password, notificationEmail, cashManager } = body;

        const isAdmin = roleHeader === 'ADMIN';
        const isSelf = !!requesterId && requesterId === id;

        // ADMIN puede editar a cualquiera; cualquier usuario puede editar SOLO su propia cuenta
        if (!isAdmin && !isSelf) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const before = await prisma.user.findUnique({
            where: { id },
            select: { name: true, role: true }
        });

        const data: any = {};
        // Nombre y rol solo los puede tocar un ADMIN (evita que uno se auto-ascienda)
        if (isAdmin) {
            if (name) data.name = name;
            if (role) data.role = role;
            // Encargado de caja: habilita ver el saldo total de la caja en efectivo.
            // Solo ADMIN lo otorga (mismo criterio que el rol).
            if (cashManager !== undefined) {
                // Blindaje del libro de custodia: pasar a encargado (o dejar de serlo)
                // NO puede hacerse mientras la persona tenga efectivo sin conciliar,
                // porque cambia retroactivamente de qué lado del libro está esa plata
                // (queda huérfana o aparece un descuadre falso en el próximo arqueo).
                const [holdingInfo, pending] = await Promise.all([
                    CashService.getVendorsHolding(),
                    CashService.getVendorPendingCash(id),
                ]);
                const myHolding = holdingInfo.find(h => h.vendorId === id)?.holding || 0;
                const hasPending = !!pending.pendingHandover;
                const custodyDirect = pending.custodian ? pending.total : 0;
                const pendingCash = Math.round(myHolding) !== 0 || hasPending || Math.round(custodyDirect) !== 0;
                if (pendingCash) {
                    return NextResponse.json({
                        error: 'Antes de cambiar el rol de caja, esta persona tiene que rendir/conciliar el efectivo que tiene a su nombre (o cerrar un arqueo). Regularizá la caja y volvé a intentar.',
                    }, { status: 409 });
                }
                data.cashManager = !!cashManager;
            }
        }
        // Casilla de avisos: la puede cambiar el ADMIN o el propio usuario.
        // String vacío la borra (vuelve a usarse la casilla compartida del local).
        if (notificationEmail !== undefined) {
            const cleaned = String(notificationEmail || '').trim().toLowerCase();
            if (cleaned && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
                return NextResponse.json({ error: 'El email de avisos no es válido' }, { status: 400 });
            }
            data.notificationEmail = cleaned || null;
        }
        // La contraseña la puede cambiar el ADMIN o el propio usuario
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 });
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                cashManager: true,
                notificationEmail: true,
                createdAt: true,
            },
        });

        // Auditoría: quién editó a quién (rol y contraseña son los cambios más sensibles)
        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'USER',
            entityId: id,
            details: {
                targetUser: user.name,
                self: isSelf,
                ...(data.name && before?.name !== data.name ? { name: { from: before?.name, to: data.name } } : {}),
                ...(data.role && before?.role !== data.role ? { role: { from: before?.role, to: data.role } } : {}),
                ...(notificationEmail !== undefined ? { notificationEmail: data.notificationEmail || '(compartida)' } : {}),
                ...(data.cashManager !== undefined ? { cashManager: data.cashManager } : {}),
                ...(password ? { passwordChanged: true } : {})
            }
        });

        return NextResponse.json(user);
    } catch (error: any) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: error.message || 'Error updating user' }, { status: 500 });
    }
}

// DELETE /api/users/[id] — Delete user
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const roleHeader = request.headers.get('x-user-role');
        if (roleHeader !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        // Don't allow deleting the last admin
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        const userToDelete = await prisma.user.findUnique({ where: { id } });

        if (userToDelete?.role === 'ADMIN' && admins.length <= 1) {
            return NextResponse.json(
                { error: 'No se puede eliminar el último administrador' },
                { status: 400 }
            );
        }

        await prisma.user.delete({ where: { id } });

        // Auditoría con snapshot: el usuario desaparece pero queda quién era y quién lo borró
        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'USER',
            entityId: id,
            details: {
                name: userToDelete?.name,
                email: userToDelete?.email,
                role: userToDelete?.role
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: error.message || 'Error deleting user' }, { status: 500 });
    }
}
