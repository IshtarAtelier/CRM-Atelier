import { NextResponse } from 'next/server';
import { BillingService } from '@/services/billing.service';

/**
 * GET /api/billing/config — Estado de la configuración de ARCA
 */
export async function GET() {
    try {
        const status = await BillingService.checkConnection();

        // Obtener puntos de venta si está conectado
        let salesPoints: any[] = [];
        if (status.connected) {
            try {
                salesPoints = await BillingService.getSalesPoints();
            } catch {
                // No critical — puede fallar si no tiene permisos
            }
        }

        // Obtener último comprobante
        let lastVoucher = null;
        if (status.connected) {
            try {
                lastVoucher = await BillingService.getLastVoucherNumber();
            } catch {
                // No critical
            }
        }

        return NextResponse.json({
            ...status,
            salesPoints,
            lastVoucher,
            puntoDeVenta: process.env.AFIP_PUNTO_VENTA || '1',
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Error verificando configuración' },
            { status: 500 }
        );
    }
}
