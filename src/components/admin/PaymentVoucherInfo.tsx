'use client';

import { CreditCard, Link2 } from 'lucide-react';
import { describeCardVoucher, isCardMethod, type VoucherNumbers } from '@/lib/payment-card';
import { stripTxTags } from '@/lib/receipt-references';

export interface PaymentVoucherData extends VoucherNumbers {
    method: string;
    cardMode?: string | null;
    notes?: string | null;
}

/**
 * Cómo se cobró un pago con tarjeta y con qué números. En administración cada
 * cobro de Pay Way (3 y 6, Ish y Yani), Naranja o Go Cuotas tiene que decir si
 * fue presencial o por link de pago: el comprobante, los números y la
 * conciliación contra la liquidación son distintos en cada caso.
 *
 * Los pagos cargados antes de que existiera el selector no tienen el dato y se
 * muestran como "sin especificar" — no se adivina.
 */
export default function PaymentVoucherInfo({ payment, className = '' }: { payment: PaymentVoucherData; className?: string }) {
    const referencia = stripTxTags(payment.notes);
    const voucher = describeCardVoucher(payment);

    if (!isCardMethod(payment.method)) {
        if (!referencia) return null;
        return (
            <span className={`text-[9px] font-bold text-stone-500 truncate ${className}`} title={referencia}>
                Ref: {referencia}
            </span>
        );
    }

    const esPresencial = payment.cardMode === 'PRESENCIAL';
    const esLink = payment.cardMode === 'LINK';

    return (
        <span className={`flex flex-col items-start gap-0.5 ${className}`}>
            <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                    esPresencial
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                        : esLink
                            ? 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400'
                            : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500'
                }`}
            >
                {esLink ? <Link2 size={9} /> : <CreditCard size={9} />}
                {esPresencial ? 'Presencial' : esLink ? 'Link de pago' : 'Modo sin especificar'}
            </span>
            {voucher && (
                <span className="text-[9px] font-bold text-stone-500 truncate" title={voucher}>
                    {voucher}
                </span>
            )}
            {referencia && (
                <span className="text-[9px] font-bold text-stone-500 truncate" title={referencia}>
                    Ref: {referencia}
                </span>
            )}
        </span>
    );
}
