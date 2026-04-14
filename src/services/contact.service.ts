import { prisma } from '@/lib/db';
import { CashService } from './cash.service';
import { ISH_POSNET_THRESHOLD, ISH_POSNET_METHODS } from '@/lib/constants';

export interface ContactCreateData {
    name: string;
    email?: string | null;
    phone?: string | null;
    dni?: string | null;
    interest?: string | null;
    expectedValue?: number;
    priority?: number;
    contactSource?: string | null;
    status?: string;
    address?: string | null;
    insurance?: string | null;
    doctor?: string | null;
}

export const ContactService = {
    async getAll(status?: string | null, search?: string | null, favoritesOnly?: boolean, interest?: string | null) {
        const where: any = {};
        if (status && status !== 'ALL') {
            if (status === 'CLIENT') {
                // VENTAS tab: show contacts that have at least one SALE order
                where.orders = {
                    some: { orderType: 'SALE', isDeleted: false }
                };
            } else {
                where.status = status;
            }
        }
        if (favoritesOnly) {
            where.isFavorite = true;
        }
        if (interest && interest !== 'ALL') {
            where.interest = interest;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { interest: { contains: search, mode: 'insensitive' } },
                { insurance: { contains: search, mode: 'insensitive' } }
            ];
        }

        const clients = await prisma.client.findMany({
            where,
            include: {
                tags: true,
                prescriptions: {
                    select: { date: true },
                    orderBy: { date: 'desc' },
                    take: 1,
                },
                orders: {
                    where: { isDeleted: false },
                    select: { total: true, orderType: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Calcular avgTicket por contacto (solo SALE orders)
        return clients.map((client: any) => {
            const saleOrders = (client.orders || []).filter((o: any) => o.orderType === 'SALE');
            const avgTicket = saleOrders.length > 0
                ? saleOrders.reduce((sum: number, o: any) => sum + o.total, 0) / saleOrders.length
                : 0;
            const { orders, ...rest } = client;
            return { ...rest, avgTicket: Math.round(avgTicket) };
        });
    },

    async create(data: ContactCreateData) {
        // Hardening: Strictly pick only necessary fields to avoid Prisma validation errors
        // with relations or unexpected properties
        const createData: any = {
            name: data.name,
            email: data.email?.trim() === "" ? null : data.email,
            phone: data.phone,
            dni: data.dni,
            status: data.status || 'CONTACT',
            contactSource: data.contactSource,
            interest: data.interest,
            expectedValue: Number(data.expectedValue) || 0,
            priority: Number(data.priority) || 0,
            address: data.address,
            insurance: data.insurance,
            doctor: data.doctor
        };


        return await prisma.client.create({
            data: createData
        });
    },

    async update(id: string, data: Partial<ContactCreateData>) {
        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email?.trim() === "" ? null : data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.dni !== undefined) updateData.dni = data.dni;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.contactSource !== undefined) updateData.contactSource = data.contactSource;
        if (data.interest !== undefined) updateData.interest = data.interest;
        if (data.expectedValue !== undefined) updateData.expectedValue = Number(data.expectedValue) || 0;
        if (data.priority !== undefined) updateData.priority = Number(data.priority) || 0;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.insurance !== undefined) updateData.insurance = data.insurance;
        if (data.doctor !== undefined) updateData.doctor = data.doctor;


        return await prisma.client.update({
            where: { id },
            data: updateData
        });
    },

    async updateStatus(id: string, status: string, userRole: string = 'STAFF') {
        const client = await prisma.client.findUnique({
            where: { id },
            include: { 
                orders: { 
                    select: { id: true, paid: true, total: true, orderType: true },
                    orderBy: { createdAt: 'desc' }, 
                    take: 1 
                } 
            }
        });

        if (!client) throw new Error('Cliente no encontrado');

        // REGLA: De CONFIRMED a CONTACT solo si no hay pagos (o es ADMIN)
        if (client.status === 'CONFIRMED' && status === 'CONTACT') {
            const lastOrder = client.orders[0];
            if (lastOrder && lastOrder.paid > 0 && userRole !== 'ADMIN') {
                throw new Error('No se puede revertir a Contacto si ya existen pagos registrados (Solo Admin)');
            }
        }

        // REGLA: No se puede saltar de CONTACT a CLIENT directamente
        if (client.status === 'CONTACT' && status === 'CLIENT') {
            throw new Error('Un contacto debe pasar por CONFIRMADO antes de cerrar la venta');
        }

        // REGLA: No se puede revertir de CLIENT a CONFIRMED (solo a CONTACT si es admin)
        if (client.status === 'CLIENT' && status === 'CONFIRMED') {
            throw new Error('No se puede revertir un cliente ya cerrado a Confirmado');
        }

        // REGLA: Para cerrar venta (CONFIRMED → CLIENT), validar requisitos
        if (client.status === 'CONFIRMED' && status === 'CLIENT') {
            const validation = await this.canCloseSale(id);
            if (!validation.canClose) {
                throw new Error(validation.reason || 'No se cumplen los requisitos para cerrar la venta');
            }
        }

        return await prisma.client.update({
            where: { id },
            data: { status }
        }).then(async (updated) => {
            // Si se convierte en CLIENT (venta), completar automáticamente todas las tareas pendientes
            if (status === 'CLIENT') {
                await prisma.clientTask.updateMany({
                    where: { clientId: id, status: 'PENDING' },
                    data: { status: 'COMPLETED' }
                });
            }
            return updated;
        });
    },

    async deleteOrder(orderId: string, reason: string) {
        return await prisma.$transaction(async (tx) => {
            // FIX: Restore stock for SALE orders before soft-deleting
            const order = await tx.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    orderType: true,
                    items: {
                        select: {
                            productId: true,
                            quantity: true,
                            product: { select: { category: true, type: true } }
                        }
                    }
                },
            });

            if (order?.orderType === 'SALE') {
                const stockItems = (order.items || []).filter((item: any) => {
                    const cat = item.product?.category;
                    const type = item.product?.type;
                    return !(cat === 'LENS' || (type || '').includes('Cristal'));
                });
                for (const item of stockItems) {
                    if (!item.productId) continue;
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
            }

            // Eliminar los pagos asociados para que no se dupliquen al volver a cargarlos en otro lado
            await tx.payment.deleteMany({
                where: { orderId }
            });

            // Marcar como eliminado lógica y resetear lo pagado
            return await tx.order.update({
                where: { id: orderId },
                data: {
                    isDeleted: true,
                    deletedReason: reason,
                    paid: 0
                }
            });
        });
    },

    async updatePriority(id: string, priority: number) {
        return await prisma.client.update({
            where: { id },
            data: { priority }
        });
    },

    async toggleFavorite(id: string) {
        const client = await prisma.client.findUnique({
            where: { id },
            select: { isFavorite: true }
        });
        if (!client) throw new Error('Cliente no encontrado');

        return await prisma.client.update({
            where: { id },
            data: { isFavorite: !client.isFavorite }
        });
    },

    async addInteraction(clientId: string, type: string, content: string) {
        return await prisma.interaction.create({
            data: {
                clientId,
                type,
                content
            }
        });
    },

    async getById(id: string) {
        return await prisma.client.findUnique({
            where: { id },
            include: {
                tags: true,
                tasks: true,
                interactions: {
                    orderBy: { createdAt: 'desc' }
                },
                prescriptions: {
                    orderBy: { date: 'desc' }
                },
                orders: {
                    select: {
                        id: true,
                        total: true,
                        paid: true,
                        status: true,
                        orderType: true,
                        createdAt: true,
                        labStatus: true,
                        items: { include: { product: true } },
                        payments: true,
                        prescription: true,
                        frameSource: true,
                        userFrameBrand: true,
                        userFrameModel: true,
                        userFrameNotes: true,
                        labColor: true,
                        labTreatment: true,
                        labDiameter: true,
                        labPdOd: true,
                        labPdOi: true,
                        labPrismOD: true,
                        labPrismOI: true,
                        labBaseCurve: true,
                        labFrameType: true,
                        labBevelPosition: true,
                        smartLabScreenshot: true,
                        labOrderNumber: true,
                        labNotes: true,
                        discount: true,
                        markup: true,
                        discountCash: true,
                        discountTransfer: true,
                        discountCard: true,
                        subtotalWithMarkup: true
                    },
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
    },

    async getTasks(clientId: string) {
        return await prisma.clientTask.findMany({
            where: { clientId },
            orderBy: { createdAt: 'desc' }
        });
    },

    async addTask(clientId: string, description: string, dueDate?: string) {
        return await prisma.clientTask.create({
            data: {
                clientId,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'PENDING'
            }
        });
    },

    async updateTaskStatus(taskId: string, status: string) {
        // Obtener la tarea para saber qué se está finalizando
        const task = await prisma.clientTask.findUnique({
            where: { id: taskId }
        });

        if (!task) throw new Error('Tarea no encontrada');

        const updatedTask = await prisma.clientTask.update({
            where: { id: taskId },
            data: { status }
        });

        // Si se marca como completada, registrar en el historial
        if (status === 'COMPLETED') {
            await prisma.interaction.create({
                data: {
                    clientId: task.clientId,
                    type: 'TASK_COMPLETED',
                    content: `✅ Tarea finalizada: ${task.description}`
                }
            });
        }

        return updatedTask;
    },

    async deleteTask(taskId: string) {
        return await prisma.clientTask.delete({
            where: { id: taskId }
        });
    },

    async getPrescriptions(clientId: string) {
        return await prisma.prescription.findMany({
            where: { clientId },
            orderBy: { date: 'desc' }
        });
    },

    _transposePrescription(data: any) {
        const safeNullableFloat = (v: any): number | null => {
            if (v === null || v === undefined || v === '') return null;
            const n = parseFloat(v);
            return isNaN(n) ? null : n;
        };
        const safeNullableInt = (v: any): number | null => {
            if (v === null || v === undefined || v === '') return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };

        let sphereOD = safeNullableFloat(data.sphereOD);
        let cylinderOD = safeNullableFloat(data.cylinderOD);
        let axisOD = safeNullableInt(data.axisOD);
        let sphereOI = safeNullableFloat(data.sphereOI);
        let cylinderOI = safeNullableFloat(data.cylinderOI);
        let axisOI = safeNullableInt(data.axisOI);

        // Lógica de Transposición Automática (OD)
        if (cylinderOD !== null && cylinderOD > 0) {
            sphereOD = (sphereOD || 0) + cylinderOD;
            cylinderOD = -cylinderOD;
            if (axisOD !== null) {
                axisOD = axisOD > 90 ? axisOD - 90 : axisOD + 90;
                if (axisOD === 0) axisOD = 180;
                if (axisOD > 180) axisOD -= 180;
            }
        }

        // Lógica de Transposición Automática (OI)
        if (cylinderOI !== null && cylinderOI > 0) {
            sphereOI = (sphereOI || 0) + cylinderOI;
            cylinderOI = -cylinderOI;
            if (axisOI !== null) {
                axisOI = axisOI > 90 ? axisOI - 90 : axisOI + 90;
                if (axisOI === 0) axisOI = 180;
                if (axisOI > 180) axisOI -= 180;
            }
        }

        return {
            ...data,
            sphereOD,
            cylinderOD,
            axisOD,
            sphereOI,
            cylinderOI,
            axisOI,
            addition: safeNullableFloat(data.addition),
            additionOD: safeNullableFloat(data.additionOD),
            additionOI: safeNullableFloat(data.additionOI),
            pd: safeNullableFloat(data.pd),
            distanceOD: safeNullableFloat(data.distanceOD),
            distanceOI: safeNullableFloat(data.distanceOI),
            heightOD: safeNullableFloat(data.heightOD),
            heightOI: safeNullableFloat(data.heightOI)
        };
    },

    async addPrescription(clientId: string, data: any) {
        const transposed = this._transposePrescription(data);
        const isNear = data.prescriptionType === 'NEAR';

        // DEDUPLICATION GATE: Check if an identical prescription already exists for this client
        const existing = await prisma.prescription.findFirst({
            where: {
                clientId,
                sphereOD: transposed.sphereOD,
                cylinderOD: transposed.cylinderOD,
                axisOD: transposed.axisOD,
                sphereOI: transposed.sphereOI,
                cylinderOI: transposed.cylinderOI,
                axisOI: transposed.axisOI,
                addition: transposed.addition,
                additionOD: transposed.additionOD,
                additionOI: transposed.additionOI,
                pd: transposed.pd,
                distanceOD: transposed.distanceOD,
                distanceOI: transposed.distanceOI,
                heightOD: transposed.heightOD,
                heightOI: transposed.heightOI,
                imageUrl: transposed.imageUrl || null,
                prescriptionType: data.prescriptionType || 'ADDITION',
            }
        });

        if (existing) {
            console.log(`[PrescriptionManager] DUPLICATE DETECTED. Reusing prescription: ${existing.id}`);
            return existing;
        }

        return await prisma.prescription.create({
            data: {
                clientId,
                sphereOD: transposed.sphereOD,
                cylinderOD: transposed.cylinderOD,
                axisOD: transposed.axisOD,
                sphereOI: transposed.sphereOI,
                cylinderOI: transposed.cylinderOI,
                axisOI: transposed.axisOI,
                addition: transposed.addition,
                additionOD: transposed.additionOD,
                additionOI: transposed.additionOI,
                pd: transposed.pd,
                distanceOD: transposed.distanceOD,
                distanceOI: transposed.distanceOI,
                heightOD: transposed.heightOD,
                heightOI: transposed.heightOI,
                imageUrl: transposed.imageUrl || null,
                notes: transposed.notes || null,
                prescriptionType: data.prescriptionType || 'ADDITION',
                nearSphereOD: isNear ? (parseFloat(data.nearSphereOD) || 0) : null,
                nearSphereOI: isNear ? (parseFloat(data.nearSphereOI) || 0) : null,
                nearCylinderOD: isNear ? (parseFloat(data.nearCylinderOD) || 0) : null,
                nearAxisOD: isNear ? (parseInt(data.nearAxisOD) || 0) : null,
                nearCylinderOI: isNear ? (parseFloat(data.nearCylinderOI) || 0) : null,
                nearAxisOI: isNear ? (parseInt(data.nearAxisOI) || 0) : null
            }
        });
    },

    async updatePrescription(presId: string, data: any) {
        const transposed = this._transposePrescription(data);
        const isNear = data.prescriptionType === 'NEAR';
        return await prisma.prescription.update({
            where: { id: presId },
            data: {
                sphereOD: transposed.sphereOD,
                cylinderOD: transposed.cylinderOD,
                axisOD: transposed.axisOD,
                sphereOI: transposed.sphereOI,
                cylinderOI: transposed.cylinderOI,
                axisOI: transposed.axisOI,
                addition: transposed.addition,
                additionOD: transposed.additionOD,
                additionOI: transposed.additionOI,
                pd: transposed.pd,
                distanceOD: transposed.distanceOD,
                distanceOI: transposed.distanceOI,
                heightOD: transposed.heightOD,
                heightOI: transposed.heightOI,
                imageUrl: transposed.imageUrl,
                notes: transposed.notes,
                prescriptionType: data.prescriptionType || 'ADDITION',
                nearSphereOD: isNear ? (parseFloat(data.nearSphereOD) || 0) : null,
                nearSphereOI: isNear ? (parseFloat(data.nearSphereOI) || 0) : null,
                nearCylinderOD: isNear ? (parseFloat(data.nearCylinderOD) || 0) : null,
                nearAxisOD: isNear ? (parseInt(data.nearAxisOD) || 0) : null,
                nearCylinderOI: isNear ? (parseFloat(data.nearCylinderOI) || 0) : null,
                nearAxisOI: isNear ? (parseInt(data.nearAxisOI) || 0) : null
            }
        });
    },

    async deletePrescription(presId: string) {
        return await prisma.prescription.delete({
            where: { id: presId }
        });
    },

    async addPayment(orderId: string, amount: number, method: string, notes?: string, receiptUrl?: string) {
        return await prisma.$transaction(async (tx) => {
            // Verificar que la orden existe y calcular si no se excede el total
            const order = await tx.order.findUnique({ 
                where: { id: orderId },
                select: { id: true, clientId: true, paid: true, total: true, subtotalWithMarkup: true }
            });
            if (!order) throw new Error('Orden no encontrada');

            const newPaid = (order.paid || 0) + amount;
            // Permitir un margen del 100% para cubrir recargos por financiación en cuotas (Argentina)
            const maxAllowed = Math.max(order.total || 0, order.subtotalWithMarkup || 0);
            if (newPaid > maxAllowed * 2.0) {
                throw new Error(`El pago excede con creces el total máximo de la orden ($${maxAllowed}). Revisá el monto ingresado.`);
            }

            const payment = await tx.payment.create({
                data: { orderId, amount, method, notes, receiptUrl }
            });

            await tx.order.update({
                where: { id: orderId },
                data: { paid: { increment: amount } }
            });

            // Si es efectivo, verificar alerta de saldo
            if (method === 'EFECTIVO' || method === 'CASH') {
                // No esperamos a que termine para no bloquear la transacción, aunque es asíncrono afuera
                CashService.checkBalanceAndAlert().catch(err => console.error('Error in cash alert:', err));
            }

            // Registrar en la ficha del cliente
            await tx.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'SISTEMA',
                    content: `Se registró un pago por $${amount.toLocaleString('es-AR')} (${method}).${notes ? ` Ref: ${notes}` : ''}`
                }
            });

            // AUTOMATED BILLING REQUEST for Card Platforms
            const cardMethods = ['PAY_WAY', 'NARANJA', 'GO_CUOTAS'];
            const isCardPlatform = cardMethods.some(m => method.toUpperCase().includes(m));
            
            if (isCardPlatform) {
                const isIsh = method.toUpperCase().endsWith('_ISH');
                const isYani = method.toUpperCase().endsWith('_YANI');
                const accountLabel = isIsh ? '[ISH]' : isYani ? '[YANI]' : '';

                const clientName = (await tx.client.findUnique({ where: { id: order.clientId }, select: { name: true } }))?.name || 'Cliente';
                await tx.notification.create({
                    data: {
                        type: 'INVOICE_REQUEST',
                        message: `${accountLabel} Facturar pago de $${amount.toLocaleString('es-AR')} (${method}) - Venta #${orderId.slice(-4).toUpperCase()} (${clientName})`,
                        orderId: orderId,
                        requestedBy: 'SISTEMA (Auto)',
                        status: 'PENDING'
                    }
                });
            }

            // ISH POSNET THRESHOLD MONITORING
            let thresholdReached = false;
            if (ISH_POSNET_METHODS.includes(method)) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                
                const ishPayments = await tx.payment.findMany({
                    where: {
                        method: { in: ISH_POSNET_METHODS },
                        date: { gte: startOfMonth }
                    },
                    select: { amount: true }
                });

                const totalIsh = ishPayments.reduce((acc, p) => acc + p.amount, 0);

                if (totalIsh >= ISH_POSNET_THRESHOLD) {
                    // Check if notification already exists for this month
                    const existingNote = await tx.notification.findFirst({
                        where: {
                            type: 'ISH_THRESHOLD_REACHED',
                            createdAt: { gte: startOfMonth }
                        }
                    });

                    if (!existingNote) {
                        await tx.notification.create({
                            data: {
                                type: 'ISH_THRESHOLD_REACHED',
                                message: `ya completaste el objetivo en POSNET ISH AHORA PASA A posnet yani`,
                                requestedBy: 'SISTEMA (Auto)',
                                status: 'PENDING'
                            }
                        });
                        thresholdReached = true;
                    }
                }
            }

            return { ...payment, thresholdReached };
        });
    },

    async deletePayment(paymentId: string) {
        return await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { id: paymentId }
            });

            if (!payment) throw new Error('Pago no encontrado');

            // Decrementar lo pagado en la orden
            await tx.order.update({
                where: { id: payment.orderId },
                data: {
                    paid: { decrement: payment.amount }
                }
            });

            // Eliminar el registro de pago
            return await tx.payment.delete({
                where: { id: paymentId }
            });
        });
    },

    async canCloseSale(clientId: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: {
                prescriptions: true,
                orders: {
                    where: { orderType: 'SALE', isDeleted: false },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        total: true,
                        paid: true,
                        prescriptionId: true,
                        frameSource: true,
                        userFrameBrand: true,
                        userFrameModel: true,
                        items: {
                            select: {
                                eye: true,
                                sphereVal: true,
                                additionVal: true,
                                product: { select: { type: true, category: true, brand: true, name: true, model: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!client) return { canClose: false, reason: 'Cliente no encontrado' };

        // 1. Datos completos
        if (!client.name || !client.phone) return { canClose: false, reason: 'Faltan datos básicos del cliente' };

        // 2. Receta — solo exigir si el pedido incluye cristales
        // (se valida más abajo si hay cristales, no para ventas de armazones/accesorios)

        // 3. Pedido existente
        const lastOrder = client.orders[0];
        if (!lastOrder) return { canClose: false, reason: 'No hay pedidos registrados' };

        // 4. Pago >= 40%
        const minRequired = lastOrder.total * 0.4;
        if (lastOrder.paid < minRequired) {
            return {
                canClose: false,
                reason: `El pago ($${lastOrder.paid.toLocaleString()}) es inferior al 40% ($${minRequired.toLocaleString()})`,
                isLabWarning: true
            };
        }

        // 5. Graduación completa en cristales
        const crystalItems = (lastOrder.items || []).filter((item: any) =>
            item.eye && (item.product?.type === 'Cristal' || item.product?.category === 'LENS')
        );

        // FIX: Only require prescription if the order includes crystals
        if (crystalItems.length > 0 && client.prescriptions.length === 0) {
            return { canClose: false, reason: 'Falta cargar la receta (el pedido incluye cristales)' };
        }
        for (const item of crystalItems) {
            if (item.sphereVal == null) {
                return { canClose: false, reason: `Falta la graduación (Esfera) del cristal ${item.eye} — ${item.product?.brand || ''} ${item.product?.name || ''}` };
            }
            // Multifocal: must have addition
            const pName = `${item.product?.brand || ''} ${item.product?.name || ''} ${item.product?.model || ''}`.toLowerCase();
            const isMulti = pName.includes('multifocal') || pName.includes('progresivo');
            if (isMulti && item.additionVal == null) {
                return { canClose: false, reason: `Falta la Adición (ADD) del cristal multifocal ${item.eye}` };
            }
        }

        return { canClose: true };
    },

    async getAllPendingTasks() {
        return await prisma.clientTask.findMany({
            where: { status: 'PENDING' },
            include: { client: true },
            orderBy: { dueDate: 'asc' }
        });
    },

    async getOrdersWithBalance() {
        // Obtenemos clientes que tienen al menos una venta (SALE) no eliminada
        const clients = await prisma.client.findMany({
            where: {
                orders: {
                    some: {
                        orderType: 'SALE',
                        isDeleted: false
                    }
                }
            },
            include: {
                orders: {
                    where: { isDeleted: false },
                    include: { 
                        payments: true,
                        items: { include: { product: true } }
                    }
                }
            }
        });

        // Calculamos el saldo global por cliente
        return clients.map(client => {
            let totalSales = 0;
            let totalPaid = 0;
            let lastOrderDate = new Date(0);
            let isMultifocal = false;

            client.orders.forEach(order => {
                // Sumamos los totales solo de las VENTAS
                if (order.orderType === 'SALE') {
                    totalSales += Number(order.total);
                    const orderDate = new Date(order.createdAt);
                    if (orderDate > lastOrderDate) {
                        lastOrderDate = orderDate;
                    }

                    // Detección de Multifocal
                    const hasMultifocal = order.items.some(item => {
                        const type = item.product?.type?.toUpperCase() || '';
                        const name = (item.product?.name || '').toUpperCase();
                        const model = (item.product?.model || '').toUpperCase();
                        return type === 'MULTIFOCAL' || 
                               name.includes('MULTIFOCAL') || 
                               name.includes('PROGRESIVO') || 
                               model.includes('MULTIFOCAL');
                    });
                    if (hasMultifocal) isMultifocal = true;
                }
                
                // Sumamos TODOS los pagos (vengan de presupuestos o ventas)
                order.payments.forEach(p => {
                    totalPaid += Number(p.amount);
                });
            });

            const balance = totalSales - totalPaid;

            return {
                id: client.id, 
                clientId: client.id,
                client: { name: client.name },
                total: totalSales,
                paid: totalPaid,
                balance,
                isMultifocal,
                createdAt: lastOrderDate.getTime() > 0 ? lastOrderDate : new Date()
            };
        })
        .filter(c => c.balance > 1000)
        .sort((a, b) => b.balance - a.balance);
    }
};
