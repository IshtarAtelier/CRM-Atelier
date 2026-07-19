import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { getActor } from '@/lib/actor';

// Cota superior de cordura: ningún movimiento manual legítimo de una óptica
// supera esto. Frena typos (agregar ceros de más) y payloads maliciosos que
// corromperían el saldo global y dispararían los emails de alerta.
const MAX_AMOUNT = 100_000_000;      // $100 millones
const MAX_REASON = 500;
const VALID_CATEGORIES = ['GASTO_GENERAL', 'PAGO_LABORATORIO', 'APORTE_EFECTIVO', 'OTRO'];

export async function POST(request: Request) {
    try {
        const actor = getActor(request);
        if (!actor.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Los movimientos manuales mueven el saldo teórico de la caja: solo la
        // encargada de caja o ADMIN. Un vendedor no puede registrar egresos/ingresos
        // (si no, podría enmascarar un faltante con un OUT ficticio).
        const canManage = await CashService.canManageCash(actor);
        if (!canManage) {
            return NextResponse.json({ error: 'Solo la encargada de caja o un admin pueden registrar movimientos de caja.' }, { status: 403 });
        }

        const { type, amount, reason, receiptUrl, category, laboratory } = await request.json();

        if (!type || amount == null || !reason) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (type, amount, reason)' }, { status: 400 });
        }

        const parsedAmount = parseFloat(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json({ error: 'El monto debe ser un número mayor a cero' }, { status: 400 });
        }
        if (parsedAmount > MAX_AMOUNT) {
            return NextResponse.json({ error: `El monto supera el máximo permitido ($${MAX_AMOUNT.toLocaleString('es-AR')}). Revisá que no hayas puesto ceros de más.` }, { status: 400 });
        }

        const validTypes = ['IN', 'OUT'];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: `Tipo de movimiento inválido. Valores permitidos: ${validTypes.join(', ')}` }, { status: 400 });
        }

        const cleanReason = String(reason).trim().slice(0, MAX_REASON);
        if (!cleanReason) {
            return NextResponse.json({ error: 'El motivo no puede estar vacío.' }, { status: 400 });
        }

        const cleanCategory = VALID_CATEGORIES.includes(category) ? category : 'OTRO';

        const movement = await CashService.registerMovement({
            type,
            amount: parsedAmount,
            reason: cleanReason,
            userId: actor.id,
            receiptUrl,
            category: cleanCategory,
            laboratory: cleanCategory === 'PAGO_LABORATORIO' && laboratory ? String(laboratory).slice(0, 120) : undefined,
        });

        return NextResponse.json(movement);
    } catch (error: any) {
        console.error('Error registrando movimiento de caja:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
