import { PrismaClient } from '@prisma/client';
import { uploadFile, listFiles, deleteFile } from './storage';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

// Instancia global de prisma para evitar conexiones múltiples
const prisma = new PrismaClient();

export const BACKUP_PREFIX = 'db-backups/';

export class BackupService {
    /**
     * Exporta todas las tablas de la BD en formato JSON comprimido
     */
    static async createBackup(): Promise<Buffer> {
        console.log('🔄 Iniciando creación de backup...');
        
        // Ejecutamos todo en una transacción Serializable para garantizar consistencia
        const data = await prisma.$transaction(async (tx: any) => {
            return {
                timestamp: new Date().toISOString(),
                version: "1.0",
                data: {
                    User: await tx.user.findMany(),
                    Client: await tx.client.findMany(),
                    Tag: await tx.tag.findMany(),
                    Doctor: await tx.doctor.findMany(),
                    Interaction: await tx.interaction.findMany(),
                    ClientTask: await tx.clientTask.findMany(),
                    Prescription: await tx.prescription.findMany(),
                    Product: await tx.product.findMany(),
                    Order: await tx.order.findMany(),
                    OrderItem: await tx.orderItem.findMany(),
                    Payment: await tx.payment.findMany(),
                    Invoice: await tx.invoice.findMany(),
                    CashMovement: await tx.cashMovement.findMany(),
                    DoctorPayment: await tx.doctorPayment.findMany(),
                    Notification: await tx.notification.findMany(),
                    MonthlyTarget: await tx.monthlyTarget.findMany(),
                    FixedCost: await tx.fixedCost.findMany(),
                    WhatsAppChat: await tx.whatsAppChat.findMany(),
                    WhatsAppMessage: await tx.whatsAppMessage.findMany({
                        // Paginación si fuera necesario en el futuro, por ahora leemos todo
                    }),
                    // Notas: Las tablas junction de Prisma (_ClientToTag, _OrderToTag) no son 
                    // accesibles directamente por prismaClient. Las relaciones implícitas de Prisma 
                    // no se pueden dumpear directamente con findMany() de forma plana sin queries custom.
                    // Para un backup completo y consistente de relaciones N:M implícitas:
                    _ClientToTag: await tx.$queryRaw`SELECT * FROM "_ClientToTag"`,
                    _OrderToTag: await tx.$queryRaw`SELECT * FROM "_OrderToTag"`
                }
            };
        }, {
            isolationLevel: 'Serializable',
            timeout: 120000 // 2 minutos máximo para extraer todo
        });

        console.log('✅ Datos extraídos, comprimiendo...');
        const jsonString = JSON.stringify(data);
        const compressedBuffer = await gzipAsync(Buffer.from(jsonString, 'utf-8'));
        
        console.log(`✅ Backup comprimido. Tamaño: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        return compressedBuffer;
    }

    /**
     * Crea un backup y lo sube al storage (S3/R2 o Local)
     */
    static async executeFullBackup(): Promise<{ success: boolean, filename: string, sizeBytes: number, urlOrKey?: string }> {
        try {
            const buffer = await this.createBackup();
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
            const filename = `${BACKUP_PREFIX}backup_${timestamp}.json.gz`;
            
            console.log(`📤 Subiendo backup ${filename}...`);
            const urlOrKey = await uploadFile(buffer, filename, 'application/gzip');
            
            return {
                success: true,
                filename,
                sizeBytes: buffer.length,
                urlOrKey
            };
        } catch (error) {
            console.error('❌ Error ejecutando backup completo:', error);
            throw error;
        }
    }

    /**
     * Limpia los backups antiguos en el storage
     */
    static async cleanOldBackups(retentionDays: number = 30): Promise<number> {
        console.log(`🧹 Limpiando backups más antiguos de ${retentionDays} días...`);
        const files = await listFiles(BACKUP_PREFIX);
        
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));
        
        let deletedCount = 0;
        
        for (const file of files) {
            if (file.lastModified && file.lastModified < cutoffDate) {
                console.log(`🗑️ Borrando backup antiguo: ${file.key}`);
                await deleteFile(file.key);
                deletedCount++;
            }
        }
        
        return deletedCount;
    }

    /**
     * Obtiene el estado del almacenamiento de backups
     */
    static async getBackupStatus() {
        const files = await listFiles(BACKUP_PREFIX);
        // Ordenamos por fecha descendente
        files.sort((a, b) => {
            const dateA = a.lastModified ? a.lastModified.getTime() : 0;
            const dateB = b.lastModified ? b.lastModified.getTime() : 0;
            return dateB - dateA;
        });

        const isCloudEnabled = !!(process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_BUCKET_NAME);

        return {
            storageConfigured: isCloudEnabled,
            totalBackups: files.length,
            latestBackup: files.length > 0 ? files[0] : null,
            history: files.slice(0, 10), // Últimos 10
            cronEnabled: !!process.env.CRON_SECRET
        };
    }
}
