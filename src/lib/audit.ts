import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAudit(params: {
  userId?: string | null;
  userName?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'ORDER' | 'CONTACT' | 'PAYMENT' | 'USER' | 'PRODUCT' | 'OTHER';
  entityId: string;
  details?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
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
