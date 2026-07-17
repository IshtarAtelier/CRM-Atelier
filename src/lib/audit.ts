import { prisma } from '@/lib/db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'LOGIN' | 'OTHER';
export type AuditEntityType =
    | 'ORDER' | 'CONTACT' | 'PAYMENT' | 'USER' | 'PRODUCT'
    | 'TASK' | 'PRESCRIPTION' | 'INVOICE' | 'EXPENSE' | 'DOCTOR_PAYMENT'
    | 'COUPON' | 'SETTING' | 'VENDOR_CASH'
    | 'CASH_HANDOVER' | 'CASH_COUNT' | 'OTHER';

export async function logAudit(params: {
  userId?: string | null;
  userName?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        userName: params.userName || 'Sistema',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details || null,
      },
    });
  } catch (error) {
    console.error('Error al guardar audit log:', error);
    // No lanzamos el error para no romper el flujo principal si falla el log
  }
}
