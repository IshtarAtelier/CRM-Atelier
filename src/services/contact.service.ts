import { prisma } from '@/lib/db';
import { CashService } from './cash.service';
import { ISH_POSNET_THRESHOLD, ISH_POSNET_METHODS } from '@/lib/constants';
import { ReceiptAgentService } from './receipt-agent.service';
import { PricingService } from './PricingService';
import { GoogleContactsService } from './google-contacts.service';
import { sendEmail } from '@/lib/email';
import { fetchWa } from '@/lib/wa-config';


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
    metaLid?: string | null;
    forceCreate?: boolean;
    createdBy?: string;
}

export const ContactService = {
    async getAll(status?: string | null, search?: string | null, favoritesOnly?: boolean, interest?: string | null, location?: string | null) {
        try {
            console.log('[ContactService] Fetching contacts:', { status, search, favoritesOnly, interest, location });
            const where: any = {};
            if (status && status !== 'ALL') {
                if (status === 'CLIENT') {
                    // VENTAS tab: show contacts that have at least one SALE order
                    where.orders = {
                        some: { orderType: 'SALE', isDeleted: false }
                    };
                } else if (status === 'CONFIRMED') {
                    // CONFIRMED tab: show contacts with status CONFIRMED but NO sales
                    // OR contacts that have a QUOTE explicitly marked as CONFIRMED (re-purchasing clients)
                    where.OR = [
                        {
                            status: 'CONFIRMED',
                            orders: { none: { orderType: 'SALE', isDeleted: false } }
                        },
                        {
                            orders: {
                                some: { orderType: 'QUOTE', status: 'CONFIRMED', isDeleted: false }
                            }
                        }
                    ];
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
            if (location && location !== 'ALL') {
                if (location === 'LOCAL') {
                    where.interactions = {
                        some: { type: 'STORE_VISIT' }
                    };
                } else if (location === 'ONLINE') {
                    where.interactions = {
                        none: { type: 'STORE_VISIT' }
                    };
                }
            }
            if (search) {
                const searchDigits = search.replace(/\D/g, '');
                if (searchDigits.length >= 4) {
                    const searchStr = searchDigits.length > 8 ? searchDigits.slice(-8) : searchDigits;
                    const rawSearch: any[] = await prisma.$queryRawUnsafe(`
                        SELECT id 
                        FROM "Client" 
                        WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%${searchStr}%'
                    `);
                    const phoneMatchIds = rawSearch.map(d => d.id);
                    where.OR = [
                        { name: { contains: search, mode: 'insensitive' } },
                        { id: { in: phoneMatchIds } },
                        { interest: { contains: search, mode: 'insensitive' } },
                        { insurance: { contains: search, mode: 'insensitive' } },
                        // Fallback por si lo guardaron exactamente con espacios y símbolos que no matchean la regex por algún caso raro
                        { phone: { contains: search, mode: 'insensitive' } }
                    ];
                } else {
                    where.OR = [
                        { name: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } },
                        { interest: { contains: search, mode: 'insensitive' } },
                        { insurance: { contains: search, mode: 'insensitive' } }
                    ];
                }
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
                        select: { total: true, orderType: true, paid: true, labStatus: true }
                    },
                    interactions: {
                        where: { type: 'STORE_VISIT' },
                        select: { id: true },
                        take: 1
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 500
            });

            // Unificar formato para UI
            return clients.map((item: any) => {
                const saleOrders = (item.orders || []).filter((o: any) => o.orderType === 'SALE');
                const avgTicket = saleOrders.length > 0
                    ? saleOrders.reduce((sum: number, o: any) => sum + o.total, 0) / saleOrders.length
                    : 0;
                
                const { orders, interactions, ...rest } = item;
                const hasPaidNotSent = (item.orders || []).some((o: any) => o.paid > 0 && (!o.labStatus || o.labStatus === 'NONE'));
                
                return { 
                    ...rest, 
                    status: item.status === 'NEW' ? 'CONTACT' : item.status,
                    avgTicket: Math.round(avgTicket), 
                    hasSales: saleOrders.length > 0,
                    hasActiveConfirmedQuote: (item.orders || []).some((o: any) => o.orderType === 'QUOTE' && o.status === 'CONFIRMED'),
                    hasVisitedStore: (interactions || []).length > 0,
                    hasPaidNotSent
                };
            }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (error: any) {
            console.error('[ContactService.getAll] Critical Error:', error);
            throw error; // Let the API route handle it
        }
    },

    async create(data: ContactCreateData) {
        const normalizedName = data.name.trim().toLowerCase();
        
        let normalizedIncomingPhone = "";
        if (data.phone) {
            const hasLetters = /[a-zA-Z]/.test(data.phone);
            const hasAt = data.phone.includes('@');
            normalizedIncomingPhone = data.phone.replace(/\D/g, '');
            
            if (hasLetters || hasAt || normalizedIncomingPhone.length < 8) {
                throw new Error(JSON.stringify({ isBlocked: true, message: `Bloqueo de seguridad: El dato ingresado ("${data.phone}") no es un celular válido. Única y exclusivamente se permiten números de celular reales para crear una ficha.` }));
            }
        } else {
            throw new Error(JSON.stringify({ isBlocked: true, message: `Bloqueo de seguridad: Es obligatorio ingresar un número de celular para crear la ficha.` }));
        }

        // 1. Exact Name, Email, or DNI match
        const orConditionsClient: any[] = [
            { name: { equals: data.name.trim(), mode: 'insensitive' } }
        ];

        if (data.email?.trim()) {
            orConditionsClient.push({ email: data.email.trim() });
        }
        if (data.dni?.trim()) {
            orConditionsClient.push({ dni: data.dni.trim() });
        }

        const potentialDuplicatesClient = await prisma.client.findMany({
            where: { OR: orConditionsClient },
            include: {
                orders: {
                    where: { orderType: 'SALE', isDeleted: false },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                }
            }
        });

        if (!data.forceCreate && potentialDuplicatesClient.length > 0) {
           const exactNameMatch = potentialDuplicatesClient.find(p => p.name.trim().toLowerCase() === normalizedName);
           if (exactNameMatch) {
               const lastOrder = exactNameMatch.orders[0];
               const lastDate = lastOrder ? ` (Última compra: ${new Date(lastOrder.createdAt).toLocaleDateString('es-AR')})` : "";
               const phoneInfo = exactNameMatch.phone ? ` - Tel: ${exactNameMatch.phone}` : "";
               throw new Error(JSON.stringify({ isDuplicate: true, existingClient: { id: exactNameMatch.id, name: exactNameMatch.name, phone: exactNameMatch.phone, type: 'CLIENT' }, message: `Posible ficha duplicada: Ya existe un cliente con el nombre exacto "${exactNameMatch.name}"${phoneInfo}${lastDate}.` }));
           }
           if (data.email) {
               const emailMatch = potentialDuplicatesClient.find(p => p.email?.toLowerCase() === data.email?.trim().toLowerCase());
               if (emailMatch) throw new Error(JSON.stringify({ isDuplicate: true, existingClient: { id: emailMatch.id, name: emailMatch.name, phone: emailMatch.phone, type: 'CLIENT' }, message: `Posible ficha duplicada: El Email ${data.email} ya está registrado a nombre de ${emailMatch.name}.` }));
           }
           if (data.dni) {
               const dniMatch = potentialDuplicatesClient.find(p => p.dni === data.dni?.trim());
               if (dniMatch) throw new Error(JSON.stringify({ isDuplicate: true, existingClient: { id: dniMatch.id, name: dniMatch.name, phone: dniMatch.phone, type: 'CLIENT' }, message: `Posible ficha duplicada: El DNI ${data.dni} ya está registrado a nombre de ${dniMatch.name}.` }));
           }
        }

        // 2. Intelligent Phone Match
        if (!data.forceCreate && normalizedIncomingPhone.length >= 8) {
            // Buscamos coincidencia usando los ultimos 8 digitos del telefono ingresado
            // (8 dígitos es suficiente para evitar colisiones con el 15 y códigos de área, y reduce falsos positivos)
            const searchPhoneStr = normalizedIncomingPhone.slice(-8);

            const rawDuplicates: any[] = await prisma.$queryRawUnsafe(`
                SELECT id 
                FROM "Client" 
                WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%${searchPhoneStr}%'
            `);
            const duplicateIds = rawDuplicates.map(d => d.id);

            let phoneDuplicatesClient: any[] = [];
            if (duplicateIds.length > 0) {
                phoneDuplicatesClient = await prisma.client.findMany({
                    where: { id: { in: duplicateIds } },
                    include: {
                        orders: {
                            where: { orderType: 'SALE', isDeleted: false },
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            select: { createdAt: true }
                        }
                    }
                });
            }

            // Validar que efectivamente coinciden los telefonos para evitar falsos positivos
            const realPhoneMatchClient = phoneDuplicatesClient.find(p => {
                const dbPhoneNorm = (p.phone || "").replace(/\D/g, '');
                return dbPhoneNorm.endsWith(searchPhoneStr) || normalizedIncomingPhone.endsWith(dbPhoneNorm.slice(-8));
            });

            if (realPhoneMatchClient) {
                const lastOrder = realPhoneMatchClient.orders[0];
                const lastDate = lastOrder ? ` (Última compra: ${new Date(lastOrder.createdAt).toLocaleDateString('es-AR')})` : "";
                throw new Error(JSON.stringify({ isDuplicate: true, existingClient: { id: realPhoneMatchClient.id, name: realPhoneMatchClient.name, phone: realPhoneMatchClient.phone, type: 'CLIENT' }, message: `Posible ficha duplicada: Ya existe el cliente "${realPhoneMatchClient.name}" registrado con el teléfono ${realPhoneMatchClient.phone}${lastDate}.` }));
            }
        }

        // Hardening: Strictly pick only necessary fields to avoid Prisma validation errors
        // with relations or unexpected properties
        const createData: any = {
            name: data.name,
            email: data.email?.trim() === "" ? null : data.email,
            phone: normalizedIncomingPhone, // Se guarda normalizado (solo números)
            dni: data.dni,
            status: data.status || 'CONTACT',
            contactSource: data.contactSource || 'Otros',
            interest: data.interest || 'Otros',
            expectedValue: Number(data.expectedValue) || 0,
            priority: Number(data.priority) || 0,
            address: data.address,
            insurance: data.insurance,
            doctor: data.doctor,
            metaLid: data.metaLid,
            createdBy: (data as any).createdBy || 'Sistema'
        };

        const createdClient = await prisma.client.create({
            data: createData
        });

        // Link any unlinked chats matching the new client's phone number
        if (normalizedIncomingPhone && normalizedIncomingPhone.length >= 8) {
            const suffix = normalizedIncomingPhone.slice(-8);
            try {
                const matchingChats = await prisma.whatsAppChat.findMany({
                    where: {
                        clientId: null,
                        OR: [
                            { realPhone: { contains: suffix } },
                            { waId: { contains: suffix } }
                        ]
                    }
                });

                for (const chat of matchingChats) {
                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { clientId: createdClient.id }
                    });
                    console.log(`[Contact Create Sync] Linked unlinked chat ${chat.waId} to new client ${createdClient.id}`);
                }
            } catch (syncErr) {
                console.error('[Contact Create Sync] Error auto-linking chats:', syncErr);
            }
        }

        return createdClient;
    },

    async update(id: string, data: Partial<ContactCreateData>) {
        // Validation: Block doctor changes if client has orders sent to the factory
        if (data.doctor !== undefined) {
            const existingClient = await prisma.client.findUnique({
                where: { id },
                select: { doctor: true }
            });
            
            if (existingClient && (existingClient.doctor || '') !== (data.doctor || '')) {
                const activeFactoryOrders = await prisma.order.findMany({
                    where: {
                        clientId: id,
                        isDeleted: false,
                        labStatus: { in: ['SENT', 'IN_PROGRESS', 'READY', 'DELIVERED'] }
                    },
                    select: { id: true }
                });
                
                if (activeFactoryOrders.length > 0) {
                    throw new Error('No se puede cambiar el médico de un cliente con pedidos ya enviados a fábrica.');
                }
            }
        }

        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email?.trim() === "" ? null : data.email;
        if (data.phone !== undefined) updateData.phone = data.phone?.replace(/\D/g, '') || null;
        if (data.dni !== undefined) updateData.dni = data.dni;
        if (data.status !== undefined) {
            updateData.status = data.status;
            if (data.status === 'CLIENT') {
                updateData.isFavorite = false;
            }
        }
        if (data.contactSource !== undefined) updateData.contactSource = data.contactSource;
        if (data.interest !== undefined) updateData.interest = data.interest;
        if (data.expectedValue !== undefined) updateData.expectedValue = Number(data.expectedValue) || 0;
        if (data.priority !== undefined) updateData.priority = Number(data.priority) || 0;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.insurance !== undefined) updateData.insurance = data.insurance;
        if (data.doctor !== undefined) updateData.doctor = data.doctor;
        if (data.metaLid !== undefined) updateData.metaLid = data.metaLid;

        let oldClient = null;
        if (data.phone !== undefined) {
            try {
                oldClient = await prisma.client.findUnique({
                    where: { id },
                    select: { phone: true }
                });
            } catch (err) {
                console.error('[Contact Update Sync] Error fetching old client:', err);
            }
        }

        const updatedClient = await prisma.client.update({
            where: { id },
            data: updateData
        });

        // Sync WhatsApp chats if phone changed
        if (oldClient && oldClient.phone !== updatedClient.phone) {
            try {
                const newPhoneNorm = updatedClient.phone ? updatedClient.phone.replace(/\D/g, '') : '';
                
                // 1. Unlink chats that no longer match the client's new phone
                const clientChats = await prisma.whatsAppChat.findMany({
                    where: { clientId: id }
                });

                for (const chat of clientChats) {
                    const chatPhone = (chat.realPhone || chat.waId || '').replace(/\D/g, '');
                    const matchesNew = newPhoneNorm && chatPhone.endsWith(newPhoneNorm.slice(-8));
                    if (!matchesNew) {
                        await prisma.whatsAppChat.update({
                            where: { id: chat.id },
                            data: { clientId: null }
                        });
                        console.log(`[Phone Update Sync] Unlinked chat ${chat.waId} from client ${id} because phone changed`);
                    }
                }

                // 2. Link chats that match the new phone and are currently unlinked
                if (newPhoneNorm && newPhoneNorm.length >= 8) {
                    const suffix = newPhoneNorm.slice(-8);
                    const matchingChats = await prisma.whatsAppChat.findMany({
                        where: {
                            clientId: null,
                            OR: [
                                { realPhone: { contains: suffix } },
                                { waId: { contains: suffix } }
                            ]
                        }
                    });

                    for (const chat of matchingChats) {
                        await prisma.whatsAppChat.update({
                            where: { id: chat.id },
                            data: { clientId: id }
                        });
                        console.log(`[Phone Update Sync] Linked unlinked chat ${chat.waId} to client ${id}`);
                    }
                }
            } catch (syncErr) {
                console.error('[Contact Update Sync] Error syncing chats:', syncErr);
            }
        }

        return updatedClient;
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

        // REGLA: Para cerrar venta (CONFIRMED → CLIENT), validar requisitos.
        // Si no cumple, permitimos cerrar pero disparamos una alerta/notificación en el sistema.
        if (client.status === 'CONFIRMED' && status === 'CLIENT') {
            const validation = await this.canCloseSale(id);
            if (!validation.canClose) {
                const warningMsg = `⚠️ Venta de ${client.name} cerrada con datos faltantes: ${validation.reason}`;
                
                // Encontrar la orden actual (SALE) para vincularla a la alerta
                const lastOrder = client.orders[0];
                
                await prisma.notification.create({
                    data: {
                        type: 'RECEIPT_ERROR',
                        message: warningMsg,
                        orderId: lastOrder?.id || null,
                        requestedBy: 'SISTEMA (Cierre Incompleto)',
                        status: 'PENDING'
                    }
                }).catch(err => console.error('[Notification Close Sale Error]', err));

                // Enviar correo de alerta al admin
                import('@/lib/email').then(({ sendEmail }) => {
                    sendEmail({
                        to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                        subject: '⚠️ Alerta de Cierre: Venta con Datos Faltantes',
                        text: warningMsg
                    });
                }).catch(console.error);
            }
        }

        return await prisma.client.update({
            where: { id },
            data: { 
                status,
                ...(status === 'CLIENT' ? { isFavorite: false } : {})
            }
        }).then(async (updated) => {
            // Si se convierte en CLIENT (venta), completar automáticamente todas las tareas pendientes
            if (status === 'CLIENT') {
                await prisma.clientTask.updateMany({
                    where: { clientId: id, status: 'PENDING', type: 'TASK' },
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
                    return !(cat === 'Cristal' || (type || '').includes('Cristal'));
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

    async delete(id: string) {
        return await prisma.$transaction(async (tx) => {
            return await tx.client.delete({
                where: { id }
            });
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
                        smartLabSector: true,
                        smartLabProgress: true,
                        smartLabLastSync: true,
                        smartLabEntryDate: true,
                        smartLabDays: true,
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
            where: { clientId, type: 'TASK' },
            orderBy: { createdAt: 'desc' }
        });
    },

    async addTask(clientId: string, description: string, dueDate?: string) {
        return await prisma.clientTask.create({
            data: {
                clientId,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'PENDING',
                type: 'TASK'
            }
        });
    },

    async addReviewRequest(clientId: string, description: string) {
        return await prisma.clientTask.create({
            data: {
                clientId,
                description,
                status: 'PENDING',
                type: 'REVIEW_REQUEST'
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
                select: { 
                    id: true, 
                    clientId: true, 
                    paid: true, 
                    total: true, 
                    subtotalWithMarkup: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            phone: true
                        }
                    }
                }
            });
            if (!order) throw new Error('Orden no encontrada');

            if (order.client?.status === 'CONTACT') {
                await tx.client.update({
                    where: { id: order.clientId },
                    data: { status: 'CONFIRMED' }
                });
                
                await tx.interaction.create({
                    data: {
                        clientId: order.clientId,
                        type: 'SISTEMA',
                        content: `El estado del cliente cambió automáticamente a CONFIRMADOS al registrar un pago.`
                    }
                });
            }

            const newPaid = (order.paid || 0) + amount;
            // Permitir un margen del 100% para cubrir recargos por financiación en cuotas (Argentina)
            const currentTotal = order.total || 0;
            const maxAllowed = Math.max(currentTotal, order.subtotalWithMarkup || 0);
            if (newPaid > maxAllowed * 2.0) {
                throw new Error(`El pago excede con creces el total máximo de la orden ($${maxAllowed}). Revisá el monto ingresado.`);
            }

            const isCash = method === 'EFECTIVO' || method === 'CASH';

            // 1. Check for Duplicate notes/reference (manual entry / non-cash)
            if (notes && notes.trim() && !isCash) {
                const cleanedNotes = notes.trim();
                const duplicatePayment = await tx.payment.findFirst({
                    where: {
                        notes: { equals: cleanedNotes }
                    },
                    include: {
                        order: { select: { client: { select: { name: true } } } }
                    }
                });

                if (duplicatePayment) {
                    const clientName = (await tx.client.findUnique({ where: { id: order.clientId }, select: { name: true } }))?.name || 'Cliente';
                    const dupClientName = duplicatePayment.order?.client?.name || 'Otro Cliente';
                    const warningMsg = `⚠️ DUPLICADO DETECTADO: Pago de $${amount.toLocaleString('es-AR')} para ${clientName} con la misma referencia "${cleanedNotes}" que ya fue usada en la orden #${duplicatePayment.orderId.slice(-4).toUpperCase()} (${dupClientName}).`;
                    
                    await tx.notification.create({
                        data: {
                            type: 'RECEIPT_ERROR',
                            message: warningMsg,
                            orderId: orderId,
                            requestedBy: 'SISTEMA (Duplicado Manual)',
                            status: 'PENDING'
                        }
                    });

                    import('@/lib/email').then(({ sendEmail }) => {
                        sendEmail({
                            to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                            subject: '⚠️ Alerta de Referencia Duplicada',
                            text: warningMsg
                        });
                    }).catch(console.error);
                }
            }

            // 2. Check for Duplicate receipt image file/URL (duplicate receipt uploaded)
            if (receiptUrl) {
                const duplicateReceipt = await tx.payment.findFirst({
                    where: {
                        receiptUrl: { equals: receiptUrl }
                    },
                    include: {
                        order: { select: { client: { select: { name: true } } } }
                    }
                });

                if (duplicateReceipt) {
                    const clientName = (await tx.client.findUnique({ where: { id: order.clientId }, select: { name: true } }))?.name || 'Cliente';
                    const dupClientName = duplicateReceipt.order?.client?.name || 'Otro Cliente';
                    const warningMsg = `🚨 COMPROBANTE REPETIDO: Se subió el mismo archivo de comprobante para la orden #${orderId.slice(-4).toUpperCase()} (${clientName}) que ya se usó anteriormente en la orden #${duplicateReceipt.orderId.slice(-4).toUpperCase()} (${dupClientName}).`;
                    
                    await tx.notification.create({
                        data: {
                            type: 'RECEIPT_ERROR',
                            message: warningMsg,
                            orderId: orderId,
                            requestedBy: 'SISTEMA (Archivo Duplicado)',
                            status: 'PENDING'
                        }
                    });

                    import('@/lib/email').then(({ sendEmail }) => {
                        sendEmail({
                            to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                            subject: '🚨 Alerta: Comprobante ya utilizado',
                            text: warningMsg
                        });
                    }).catch(console.error);
                }
            }

            // 3. Check for Duplicate amount and method for the SAME CLIENT
            // Excepción: Si el vendedor escribe "DIVIDIDO" o "COMPARTIDO" en la nota, se permite (pago dividido en varios pedidos).
            const isSplitPayment = notes && (notes.toUpperCase().includes('DIVIDIDO') || notes.toUpperCase().includes('COMPARTIDO'));
            
            let duplicateAmountMethod = null;
            if (!isSplitPayment) {
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                duplicateAmountMethod = await tx.payment.findFirst({
                    where: {
                        amount: amount,
                        method: method,
                        order: {
                            clientId: order.clientId
                        },
                        date: {
                            gte: thirtyDaysAgo
                        }
                    },
                    include: {
                        order: true
                    }
                });
            }

            if (duplicateAmountMethod) {
                const clientName = (await tx.client.findUnique({ where: { id: order.clientId }, select: { name: true } }))?.name || 'Cliente';
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                const clientLink = `${appUrl}/admin/contactos?id=${order.clientId}`;
                
                const msg = `🚨 ALERTA IMPORTANTE: Ya ingresaste un pago idéntico de $${amount.toLocaleString('es-AR')} (${method}) para el cliente ${clientName} recientemente (Orden #${duplicateAmountMethod.orderId.slice(-4).toUpperCase()}).\n\nPor seguridad, el sistema bloqueó este ingreso para evitar pagos duplicados. Si el cliente realmente hizo DOS pagos exactos, por favor contactá al Administrador.`;
                
                import('@/lib/email').then(({ sendEmail }) => {
                    sendEmail({
                        to: 'pisano.ishtar@gmail.com',
                        subject: '🚨 Vendedor bloqueado por Posible Pago Duplicado',
                        text: `El vendedor intentó cargar un pago duplicado.\n\n${msg}\n\nFicha del cliente: ${clientLink}`
                    });
                }).catch(console.error);

                throw new Error(msg);
            }

            const payment = await tx.payment.create({
                data: { orderId, amount, method, notes, receiptUrl }
            });

            const orderUpdateData: any = { paid: { increment: amount } };
            
            // Regla automática: Si el cliente paga en cuotas y excede el total original (efectivo),
            // actualizamos el total de la venta para que la contabilidad y el dashboard reflejen el recargo.
            if (newPaid > currentTotal) {
                orderUpdateData.total = newPaid;
                orderUpdateData.subtotalWithMarkup = newPaid;
            }

            await tx.order.update({
                where: { id: orderId },
                data: orderUpdateData
            });



            // Registrar en la ficha del cliente
            await tx.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'SISTEMA',
                    content: `Se registró un pago por $${amount.toLocaleString('es-AR')} (${method}).${notes ? ` Ref: ${notes}` : ''}`
                }
            });

            // AUTOMATED BILLING REQUEST ONLY for Pay Way
            const isEligibleForAutoBilling = method.toUpperCase().includes('PAY_WAY');
            
            if (isEligibleForAutoBilling) {
                // DUPLICATE PROTECTION: Check if this exact payment already has a request
                const amountStr = `$${amount.toLocaleString('es-AR')}`;
                const existingRequest = await tx.notification.findFirst({
                    where: {
                        type: 'INVOICE_REQUEST',
                        orderId: orderId,
                        message: { contains: amountStr },
                        status: 'PENDING'
                    }
                });

                // Also check if order already has a completed invoice for this amount
                const existingInvoice = await tx.invoice.findFirst({
                    where: { orderId: orderId, status: 'COMPLETED' }
                });

                if (!existingRequest && !existingInvoice) {
                    const isIsh = method.toUpperCase().endsWith('_ISH');
                    const isYani = method.toUpperCase().endsWith('_YANI');
                    const accountLabel = isIsh ? '[ISH]' : isYani ? '[YANI]' : '';

                    const clientName = (await tx.client.findUnique({ where: { id: order.clientId }, select: { name: true } }))?.name || 'Cliente';
                    const msg = `${accountLabel} Facturar pago de ${amountStr} (${method}) - Venta #${orderId.slice(-4).toUpperCase()} (${clientName})`;
                    await tx.notification.create({
                        data: {
                            type: 'INVOICE_REQUEST',
                            message: msg,
                            orderId: orderId,
                            requestedBy: 'SISTEMA (Auto)',
                            status: 'PENDING'
                        }
                    });
                    
                    // Notificar al administrador por email (fire-and-forget para no bloquear tx)
                    const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
                    const toEmail = !adminEmail || adminEmail.toLowerCase() === 'pisano.ishtar@gmail.com'
                        ? 'pisano.ishtar@gmail.com'
                        : `pisano.ishtar@gmail.com, ${adminEmail}`;

                    sendEmail({
                        to: toEmail,
                        subject: '🧾 Solicitud de Factura (Automática)',
                        text: `El sistema ha generado una nueva solicitud de factura:\n\n${msg}`
                    }).catch(console.error);
                }
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

            const priorPaid = order.paid || 0;
            const finalTotal = newPaid > currentTotal ? newPaid : currentTotal;
            const isSena = priorPaid === 0;

            const updatedOrder = await tx.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    clientId: true,
                    total: true,
                    paid: true,
                    subtotalWithMarkup: true,
                    discountCash: true,
                    discountTransfer: true,
                    payments: {
                        select: {
                            amount: true,
                            method: true
                        }
                    }
                }
            });

            if (!updatedOrder) throw new Error('Error al recargar orden para cálculos');
            const financials = PricingService.calculateOrderFinancials(updatedOrder);

            return { 
                ...payment, 
                thresholdReached,
                clientName: order.client?.name || 'Cliente Desconocido',
                clientPhone: order.client?.phone,
                clientId: order.clientId,
                isSena,
                totalOperacion: finalTotal,
                hasBalance: financials.hasBalance,
                remainingCash: financials.remainingCash,
                remainingTransfer: financials.remainingTransfer,
                remainingCard: financials.remainingCard,
                discountCash: financials.discountCash,
                discountTransfer: financials.discountTransfer
            };
        }).then(result => {
            // Si es efectivo, verificar alerta de saldo fuera de la transacción
            if (method === 'EFECTIVO' || method === 'CASH') {
                CashService.checkBalanceAndAlert().catch(err => console.error('Error in cash alert:', err));
                
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                    const clientLink = `${appUrl}/admin/contactos?id=${result.clientId}`;
                    sendEmail({
                        to: 'pisano.ishtar@gmail.com',
                        subject: `💵 Ingreso de Efectivo: $${amount.toLocaleString('es-AR')}`,
                        text: `Se ha registrado un nuevo pago en EFECTIVO en el sistema.\n\n👤 Cliente: ${result.clientName}\n💰 Monto: $${amount.toLocaleString('es-AR')}\n\nFicha del cliente: ${clientLink}`
                    });
                } catch (e) {
                    console.error('Error sending cash email alert:', e);
                }
            }
            // FIRE BACKGROUND AI VERIFICATION IF RECEIPT EXISTS
            if (receiptUrl) {
                ReceiptAgentService.analyzeReceipt(
                    result.id,
                    orderId,
                    receiptUrl,
                    amount,
                    method
                ).catch(err => console.error('[ReceiptAgent Background Error]', err));
            }

            // Enviar notificación de WhatsApp de forma asíncrona
            (async () => {
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                    const clientLink = `${appUrl}/admin/contactos?id=${result.clientId}`;
                    
                    const tipoPago = result.isSena ? 'SEÑA' : 'SALDO';
                    
                    let remainingText = '';
                    if (result.hasBalance) {
                        remainingText = `⚠️ *Saldos Restantes por Forma de Pago:*\n`;
                        remainingText += `💵 *Efectivo (${result.discountCash}% desc):* $${result.remainingCash.toLocaleString('es-AR')}\n`;
                        remainingText += `📲 *Transferencia (${result.discountTransfer}% desc):* $${result.remainingTransfer.toLocaleString('es-AR')}\n`;
                        remainingText += `💳 *Tarjeta/Lista:* $${result.remainingCard.toLocaleString('es-AR')} (o 3 cuotas de $${Math.round(result.remainingCard / 3).toLocaleString('es-AR')})`;
                    } else {
                        remainingText = `✅ *Pedido totalmente abonado*`;
                    }

                    let msgText = `💵 *Nuevo Pago Registrado (${tipoPago})*\n\n`;
                    msgText += `👤 *Cliente:* ${result.clientName}\n`;
                    msgText += `💰 *Monto de este Pago:* $${amount.toLocaleString('es-AR')}\n`;
                    msgText += `💳 *Método:* ${method}\n`;
                    msgText += `📈 *Total de la Operación:* $${result.totalOperacion.toLocaleString('es-AR')}\n`;
                    if (notes && notes.trim()) {
                        msgText += `📝 *Referencia/Notas:* ${notes.trim()}\n`;
                    }
                    msgText += `\n${remainingText}\n\n`;
                    msgText += `🔗 *Ficha del cliente:* ${clientLink}`;

                    const resAdmin = await fetchWa('/api/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: '5493541215971@c.us',
                            message: msgText,
                            senderName: 'Sistema Atelier'
                        }),
                    });

                    if (!resAdmin.ok) {
                        const errText = await resAdmin.text();
                        console.error('[Payment Notification] Failed to send WhatsApp to Admin:', errText);
                    } else {
                        console.log('[Payment Notification] WhatsApp sent successfully to Admin');
                    }

                    // Enviar comprobante automático al cliente para cualquier método de pago
                    if (result.clientPhone) {
                        let phoneTo = result.clientPhone.replace(/\D/g, '');
                        if (!phoneTo.startsWith('549') && phoneTo.startsWith('54')) phoneTo = phoneTo.replace(/^54/, '549');
                        if (!phoneTo.startsWith('549')) phoneTo = `549${phoneTo}`;
                        if (!phoneTo.endsWith('@c.us')) phoneTo = `${phoneTo}@c.us`;

                        const today = new Date().toLocaleDateString('es-AR');
                        let methodLabel = method;
                        if (method === 'EFECTIVO' || method === 'CASH') methodLabel = 'en efectivo';
                        else if (method.includes('TRANSFERENCIA')) methodLabel = 'mediante transferencia bancaria';
                        else if (method.includes('NARANJA_Z') || method === 'PLAN_Z') methodLabel = 'mediante Tarjeta Naranja (Plan Z)';
                        else if (method.includes('PAY_WAY_3') || method === 'CREDIT_3') methodLabel = 'mediante Tarjeta de Crédito (3 Cuotas)';
                        else if (method.includes('PAY_WAY_6') || method === 'CREDIT_6') methodLabel = 'mediante Tarjeta de Crédito (6 Cuotas)';
                        else if (method.includes('PAY_WAY')) methodLabel = 'mediante Tarjeta de Crédito';
                        else if (method.includes('GO_CUOTAS')) methodLabel = 'mediante Go Cuotas';
                        else methodLabel = `mediante ${method.replace(/_/g, ' ')}`;
                        
                        const clientMsgText = `Hola *${result.clientName}*, desde Atelier te informamos que hemos recibido tu pago ${methodLabel} por *$${amount.toLocaleString('es-AR')}* con fecha *${today}*. ¡Muchas gracias!`;

                        // Generar PDF del recibo
                        let pdfMedia: any = null;
                        try {
                            const { generateReceiptPDF } = await import('@/lib/receipt-pdf-generator');
                            
                            const fullOrder = await prisma.order.findUnique({
                                where: { id: orderId },
                                include: { client: true }
                            });
                            
                            if (fullOrder && fullOrder.client) {
                                const pdfResult = await generateReceiptPDF(result, fullOrder, fullOrder.client);
                                pdfMedia = {
                                    base64: pdfResult.base64,
                                    mimetype: 'application/pdf',
                                    filename: pdfResult.filename
                                };
                                console.log('[Payment Notification] Receipt PDF generated successfully.');
                            }
                        } catch (pdfErr) {
                            console.error('[Payment Notification] Failed to generate Receipt PDF:', pdfErr);
                        }

                        // Enviar al cliente
                        const resClient = await fetchWa('/api/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chatId: phoneTo,
                                message: clientMsgText,
                                senderName: 'Sistema Atelier',
                                media: pdfMedia
                            }),
                        });

                        if (!resClient.ok) {
                            console.error('[Payment Notification] Failed to send WhatsApp to Client:', await resClient.text());
                        }

                        // Enviar copia a Ishtar
                        await fetchWa('/api/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chatId: '5493541215971@c.us',
                                message: `🤖 *[Copia enviada al cliente]*\n\n${clientMsgText}`,
                                senderName: 'Sistema Atelier',
                                media: pdfMedia
                            }),
                        });
                    }

                } catch (err: any) {
                    console.error('[Payment Notification] Error sending WhatsApp:', err.message);
                }
            })();

            return result;
        });
    },

    async deletePayment(paymentId: string) {
        return await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { id: paymentId }
            });

            if (!payment) throw new Error('Pago no encontrado');

            // Recalcular lo pagado con SUM atómico (evita paid negativo)
            const totalPaidAgg = await tx.payment.aggregate({
                _sum: { amount: true },
                where: { orderId: payment.orderId, id: { not: paymentId } }
            });
            await tx.order.update({
                where: { id: payment.orderId },
                data: {
                    paid: Math.max(0, totalPaidAgg._sum.amount || 0)
                }
            });

            // Encontrar y eliminar la notificación de INVOICE_REQUEST asociada a este pago si existe (para des-duplicar facturación si se equivocaron de medio)
            const amountStr = `$${payment.amount.toLocaleString('es-AR')}`;
            await tx.notification.deleteMany({
                where: {
                    type: 'INVOICE_REQUEST',
                    orderId: payment.orderId,
                    message: { contains: amountStr },
                    status: 'PENDING'
                }
            });

            // Eliminar el registro de pago
            return await tx.payment.delete({
                where: { id: paymentId }
            });
        });
    },

    /**
     * Edita un pago existente de forma quirúrgica.
     * Nunca elimina/recrea — actualiza in-place y recalcula dependencias.
     * 
     * Zonas impactadas:
     * 1. Payment record (campos directos)
     * 2. Order.paid (recalculado con SUM atómico)
     * 3. INVOICE_REQUEST notifications (si el método cambia)
     * 4. Invoice warnings (si ya existe factura emitida con cuenta distinta)
     * 5. Client Timeline (registro de auditoría)
     * 
     * Zonas NO impactadas:
     * - CashService: se auto-recalcula con aggregate en vivo (no almacena estado)
     * - Reports: leen payments en vivo
     * - PricingService.calculateOrderFinancials: lee payments en vivo
     * - Facturas ya emitidas: NUNCA se tocan
     */
    async updatePayment(paymentId: string, updates: {
        method?: string;
        amount?: number;
        notes?: string | null;
        receiptUrl?: string | null;
    }) {
        const isAutoBillingMethod = (m: string) => m.toUpperCase().includes('PAY_WAY');

        return await prisma.$transaction(async (tx) => {
            // 1. Obtener estado previo completo
            const oldPayment = await tx.payment.findUnique({
                where: { id: paymentId },
                include: {
                    order: {
                        select: {
                            id: true,
                            clientId: true,
                            total: true,
                            subtotalWithMarkup: true,
                            invoices: {
                                where: { status: 'COMPLETED' },
                                select: { id: true, billingAccount: true }
                            }
                        }
                    }
                }
            });

            if (!oldPayment) throw new Error('Pago no encontrado');
            if (!oldPayment.order) throw new Error('Orden asociada no encontrada');

            const orderId = oldPayment.orderId;
            const clientId = oldPayment.order.clientId;

            // 2. Construir diff para auditoría
            const changes: string[] = [];
            const updateData: any = {};

            if (updates.method !== undefined && updates.method !== oldPayment.method) {
                changes.push(`Método: ${oldPayment.method} → ${updates.method}`);
                updateData.method = updates.method;
            }

            if (updates.amount !== undefined && updates.amount !== oldPayment.amount) {
                changes.push(`Monto: $${oldPayment.amount.toLocaleString('es-AR')} → $${updates.amount.toLocaleString('es-AR')}`);
                updateData.amount = updates.amount;

                // Validar que el nuevo monto no exceda con creces el total
                const maxAllowed = Math.max(oldPayment.order.total || 0, oldPayment.order.subtotalWithMarkup || 0);
                // Recalcular paid sin este pago + nuevo monto
                const otherPaymentsAgg = await tx.payment.aggregate({
                    _sum: { amount: true },
                    where: { orderId, id: { not: paymentId } }
                });
                const otherPaid = otherPaymentsAgg._sum.amount || 0;
                const newTotalPaid = otherPaid + updates.amount;
                if (newTotalPaid > maxAllowed * 2.0) {
                    throw new Error(`El monto editado excede con creces el total máximo de la orden ($${maxAllowed.toLocaleString('es-AR')}). Revisá el monto ingresado.`);
                }
            }

            if (updates.notes !== undefined && updates.notes !== oldPayment.notes) {
                changes.push(`Referencia actualizada`);
                updateData.notes = updates.notes;
            }

            if (updates.receiptUrl !== undefined && updates.receiptUrl !== oldPayment.receiptUrl) {
                changes.push(`Comprobante reemplazado`);
                updateData.receiptUrl = updates.receiptUrl;
            }

            // Si no hay cambios reales, retornar el pago sin tocar nada
            if (changes.length === 0) return oldPayment;

            const method = updates.method || oldPayment.method;
            const isCash = method === 'EFECTIVO' || method === 'CASH';

            // 1. Check for Duplicate notes/reference (on edit)
            if (updates.notes !== undefined && updates.notes !== oldPayment.notes && updates.notes !== null && !isCash) {
                const cleanedNotes = updates.notes.trim();
                if (cleanedNotes) {
                    const duplicatePayment = await tx.payment.findFirst({
                        where: {
                            notes: { equals: cleanedNotes },
                            id: { not: paymentId }
                        },
                        include: {
                            order: { select: { client: { select: { name: true } } } }
                        }
                    });

                    if (duplicatePayment) {
                        const clientName = (await tx.client.findUnique({ where: { id: oldPayment.order.clientId }, select: { name: true } }))?.name || 'Cliente';
                        const dupClientName = duplicatePayment.order?.client?.name || 'Otro Cliente';
                        const warningMsg = `⚠️ DUPLICADO DETECTADO AL EDITAR: El pago editado ID ${paymentId} para ${clientName} tiene la misma referencia "${cleanedNotes}" que ya fue usada en la orden #${duplicatePayment.orderId.slice(-4).toUpperCase()} (${dupClientName}).`;
                        
                        await tx.notification.create({
                            data: {
                                type: 'RECEIPT_ERROR',
                                message: warningMsg,
                                orderId: orderId,
                                requestedBy: 'SISTEMA (Edición Duplicada)',
                                status: 'PENDING'
                            }
                        });

                        import('@/lib/email').then(({ sendEmail }) => {
                            sendEmail({
                                to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                                subject: '⚠️ Alerta de Referencia Duplicada (Edición)',
                                text: warningMsg
                            });
                        }).catch(console.error);
                    }
                }
            }

            // 2. Check for Duplicate receipt image file/URL (on edit)
            if (updates.receiptUrl !== undefined && updates.receiptUrl !== oldPayment.receiptUrl && updates.receiptUrl !== null) {
                const duplicateReceipt = await tx.payment.findFirst({
                    where: {
                        receiptUrl: { equals: updates.receiptUrl },
                        id: { not: paymentId }
                    },
                    include: {
                        order: { select: { client: { select: { name: true } } } }
                    }
                });

                if (duplicateReceipt) {
                    const clientName = (await tx.client.findUnique({ where: { id: oldPayment.order.clientId }, select: { name: true } }))?.name || 'Cliente';
                    const dupClientName = duplicateReceipt.order?.client?.name || 'Otro Cliente';
                    const warningMsg = `🚨 COMPROBANTE REPETIDO AL EDITAR: Se subió el mismo archivo de comprobante para la orden #${orderId.slice(-4).toUpperCase()} (${clientName}) que ya se usó anteriormente en la orden #${duplicateReceipt.orderId.slice(-4).toUpperCase()} (${dupClientName}).`;
                    
                    await tx.notification.create({
                        data: {
                            type: 'RECEIPT_ERROR',
                            message: warningMsg,
                            orderId: orderId,
                            requestedBy: 'SISTEMA (Edición de Archivo Duplicado)',
                            status: 'PENDING'
                        }
                    });

                    import('@/lib/email').then(({ sendEmail }) => {
                        sendEmail({
                            to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                            subject: '🚨 Alerta: Comprobante ya utilizado (Edición)',
                            text: warningMsg
                        });
                    }).catch(console.error);
                }
            }

            // 3b. Check for Duplicate amount and method for the SAME CLIENT (on edit)
            // Excepción: Si la nota incluye "DIVIDIDO" o "COMPARTIDO", no bloquea.
            const newNotes = updates.notes !== undefined ? updates.notes : oldPayment.notes;
            const isSplitEdit = newNotes && (newNotes.toUpperCase().includes('DIVIDIDO') || newNotes.toUpperCase().includes('COMPARTIDO'));

            if (!isSplitEdit && (updates.amount !== undefined || updates.method !== undefined)) {
                const checkAmount = updates.amount !== undefined ? updates.amount : oldPayment.amount;
                const checkMethod = updates.method !== undefined ? updates.method : oldPayment.method;
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                
                const duplicateAmountMethod = await tx.payment.findFirst({
                    where: {
                        amount: checkAmount,
                        method: checkMethod,
                        order: {
                            clientId: clientId
                        },
                        date: {
                            gte: thirtyDaysAgo
                        },
                        id: { not: paymentId }
                    },
                    include: {
                        order: true
                    }
                });

                if (duplicateAmountMethod) {
                    const clientName = (await tx.client.findUnique({ where: { id: clientId }, select: { name: true } }))?.name || 'Cliente';
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                    const clientLink = `${appUrl}/admin/contactos?id=${clientId}`;

                    const msg = `🚨 ALERTA IMPORTANTE AL EDITAR: El pago que estás editando ($${checkAmount.toLocaleString('es-AR')} - ${checkMethod}) coincide EXACTAMENTE con otro pago ya registrado recientemente en la orden #${duplicateAmountMethod.orderId.slice(-4).toUpperCase()}.\n\nPor seguridad, el sistema bloqueó la edición para evitar pagos duplicados. Si el cliente realmente hizo DOS pagos exactos, por favor contactá al Administrador.`;
                    
                    import('@/lib/email').then(({ sendEmail }) => {
                        sendEmail({
                            to: 'pisano.ishtar@gmail.com',
                            subject: '🚨 Vendedor bloqueado por Posible Pago Duplicado (Edición)',
                            text: `El vendedor intentó editar un pago que resultó en un duplicado.\n\n${msg}\n\nFicha del cliente: ${clientLink}`
                        });
                    }).catch(console.error);

                    throw new Error(msg);
                }
            }

            // 3. Actualizar el Payment in-place
            const updatedPayment = await tx.payment.update({
                where: { id: paymentId },
                data: updateData
            });

            // 4. Recalcular Order.paid con SUM atómico (nunca increment/decrement para evitar drift)
            if (updateData.amount !== undefined) {
                const totalPaidAgg = await tx.payment.aggregate({
                    _sum: { amount: true },
                    where: { orderId }
                });
                
                const recalculatedPaid = totalPaidAgg._sum.amount || 0;
                const orderUpdateData: any = { paid: recalculatedPaid };
                const currentTotal = oldPayment.order.total || 0;
                
                // Regla automática: Si el pago total editado supera el total original de la venta, actualizamos el total.
                if (recalculatedPaid > currentTotal) {
                    orderUpdateData.total = recalculatedPaid;
                    orderUpdateData.subtotalWithMarkup = recalculatedPaid;
                }

                await tx.order.update({
                    where: { id: orderId },
                    data: orderUpdateData
                });
            }

            // 5. Gestionar INVOICE_REQUEST si el método cambió
            if (updateData.method !== undefined) {
                const oldIsAutoBilling = isAutoBillingMethod(oldPayment.method);
                const newIsAutoBilling = isAutoBillingMethod(updateData.method);
                const amount = updateData.amount ?? oldPayment.amount;
                const amountStr = `$${amount.toLocaleString('es-AR')}`;

                // Si el viejo método requería factura → eliminar su INVOICE_REQUEST pendiente
                if (oldIsAutoBilling) {
                    const oldAmountStr = `$${oldPayment.amount.toLocaleString('es-AR')}`;
                    await tx.notification.deleteMany({
                        where: {
                            type: 'INVOICE_REQUEST',
                            orderId,
                            message: { contains: oldAmountStr },
                            status: 'PENDING'
                        }
                    });
                }

                // Si el nuevo método requiere factura → crear nueva INVOICE_REQUEST
                if (newIsAutoBilling) {
                    const isIsh = updateData.method.toUpperCase().endsWith('_ISH');
                    const isYani = updateData.method.toUpperCase().endsWith('_YANI');
                    const accountLabel = isIsh ? '[ISH]' : isYani ? '[YANI]' : '';

                    const clientName = (await tx.client.findUnique({ where: { id: clientId }, select: { name: true } }))?.name || 'Cliente';

                    // Verificar que no exista ya una request idéntica
                    const existingRequest = await tx.notification.findFirst({
                        where: {
                            type: 'INVOICE_REQUEST',
                            orderId,
                            message: { contains: amountStr },
                            status: 'PENDING'
                        }
                    });

                    // Verificar que no haya factura ya emitida para esta orden
                    const existingInvoice = await tx.invoice.findFirst({
                        where: { orderId, status: 'COMPLETED' }
                    });

                    if (!existingRequest && !existingInvoice) {
                        const msg = `${accountLabel} Facturar pago editado de ${amountStr} (${updateData.method}) - Venta #${orderId.slice(-4).toUpperCase()} (${clientName})`;
                        await tx.notification.create({
                            data: {
                                type: 'INVOICE_REQUEST',
                                message: msg,
                                orderId,
                                requestedBy: 'SISTEMA (Edición)',
                                status: 'PENDING'
                            }
                        });

                        const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
                        const toEmail = !adminEmail || adminEmail.toLowerCase() === 'pisano.ishtar@gmail.com'
                            ? 'pisano.ishtar@gmail.com'
                            : `pisano.ishtar@gmail.com, ${adminEmail}`;

                        sendEmail({
                            to: toEmail,
                            subject: '🧾 Solicitud de Factura (Edición de Pago)',
                            text: `El sistema ha generado una nueva solicitud de factura por modificación de pago:\n\n${msg}`
                        }).catch(console.error);
                    }
                }

                // 6. Warning si hay factura emitida y la cuenta cambió
                const existingInvoices = oldPayment.order.invoices || [];
                if (existingInvoices.length > 0) {
                    const oldIsIsh = oldPayment.method.toUpperCase().endsWith('_ISH');
                    const oldIsYani = oldPayment.method.toUpperCase().endsWith('_YANI');
                    const newIsIsh = updateData.method.toUpperCase().endsWith('_ISH');
                    const newIsYani = updateData.method.toUpperCase().endsWith('_YANI');
                    const oldAccount = oldIsIsh ? 'ISH' : oldIsYani ? 'YANI' : null;
                    const newAccount = newIsIsh ? 'ISH' : newIsYani ? 'YANI' : null;

                    if (oldAccount && newAccount && oldAccount !== newAccount) {
                        await tx.notification.create({
                            data: {
                                type: 'RECEIPT_ERROR',
                                message: `⚠️ ATENCIÓN: Se editó un pago de la orden #${orderId.slice(-4).toUpperCase()} cambiando de ${oldAccount} a ${newAccount}, pero YA EXISTE una factura emitida. Revisar manualmente.`,
                                orderId,
                                requestedBy: 'SISTEMA (Auditoría)',
                                status: 'PENDING'
                            }
                        });
                    }
                }
            }

            // 7. Registrar en la línea de tiempo del cliente
            await tx.interaction.create({
                data: {
                    clientId,
                    type: 'SISTEMA',
                    content: `✏️ Pago editado por Administrador: ${changes.join(' | ')}`
                }
            });

            return updatedPayment;
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
        if (!client.name || !client.phone) return { canClose: false, reason: 'Faltan datos básicos del cliente (Nombre o Teléfono)' };
        if (!client.contactSource) return { canClose: false, reason: 'Falta especificar el Canal de Contacto del cliente' };
        if (!client.interest) return { canClose: false, reason: 'Falta especificar el Interés del cliente' };

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
            item.eye && (item.product?.type === 'Cristal' || item.product?.category === 'Cristal')
        );

        // FIX: Require prescription to be strictly linked to the order if it includes crystals
        if (crystalItems.length > 0) {
            if (!lastOrder.prescriptionId) {
                return { canClose: false, reason: 'Falta vincular la receta al pedido (el pedido incluye cristales)' };
            }
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
            where: { status: 'PENDING', type: 'TASK' },
            include: { client: true },
            orderBy: { dueDate: 'asc' }
        });
    },

    async getAllPendingReviewRequests() {
        return await prisma.clientTask.findMany({
            where: { status: 'PENDING', type: 'REVIEW_REQUEST' },
            include: { client: true },
            orderBy: { createdAt: 'desc' }
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
            let totalRemainingCash = 0;
            let totalRemainingTransfer = 0;
            let totalRemainingCard = 0;
            let totalSales = 0;
            let totalPaid = 0;
            let lastOrderDate = new Date(0);
            let isMultifocal = false;

            client.orders.forEach(order => {
                // Sumamos los totales solo de las VENTAS
                if (order.orderType === 'SALE') {
                    const financials = PricingService.calculateOrderFinancials(order);
                    totalRemainingCash += financials.remainingCash;
                    totalRemainingTransfer += financials.remainingTransfer;
                    totalRemainingCard += financials.remainingCard;
                    
                    totalSales += financials.listPrice;
                    totalPaid += financials.paidReal;

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
            });

            const balance = totalRemainingCard;

            return {
                id: client.id, 
                clientId: client.id,
                client: { name: client.name },
                total: totalSales,
                paid: totalPaid,
                balance,
                remainingCash: totalRemainingCash,
                remainingTransfer: totalRemainingTransfer,
                remainingCard: totalRemainingCard,
                isMultifocal,
                createdAt: lastOrderDate.getTime() > 0 ? lastOrderDate : new Date()
            };
        })
        .filter(c => c.balance > 1000)
        .sort((a, b) => b.balance - a.balance);
    },

    async mergeClients(targetId: string, sourceId: string) {
        if (targetId === sourceId) throw new Error("No puedes fusionar un cliente consigo mismo");

        const targetClient = await prisma.client.findUnique({ where: { id: targetId } });
        const sourceClient = await prisma.client.findUnique({ where: { id: sourceId } });

        if (!targetClient || !sourceClient) {
            throw new Error("Uno o ambos clientes no existen.");
        }

        console.log(`[Merge] Fusionando cliente ${sourceId} (${sourceClient.name}) hacia ${targetId} (${targetClient.name})`);

        return await prisma.$transaction(async (tx) => {
            // 1. Transferir Interacciones
            await tx.interaction.updateMany({
                where: { clientId: sourceId },
                data: { clientId: targetId }
            });

            // 2. Transferir Tareas
            await tx.clientTask.updateMany({
                where: { clientId: sourceId },
                data: { clientId: targetId }
            });

            // 3. Transferir Órdenes
            await tx.order.updateMany({
                where: { clientId: sourceId },
                data: { clientId: targetId }
            });

            // 4. Transferir Recetas
            await tx.prescription.updateMany({
                where: { clientId: sourceId },
                data: { clientId: targetId }
            });

            // 5. Transferir WhatsApp Chats
            await tx.whatsAppChat.updateMany({
                where: { clientId: sourceId },
                data: { clientId: targetId }
            });

            // 6. Transferir Etiquetas (Tags)
            const sourceWithTags = await tx.client.findUnique({
                where: { id: sourceId },
                include: { tags: true }
            });
            if (sourceWithTags && sourceWithTags.tags.length > 0) {
                await tx.client.update({
                    where: { id: targetId },
                    data: {
                        tags: {
                            connect: sourceWithTags.tags.map((t: any) => ({ id: t.id }))
                        }
                    }
                });
            }

            // 7. Liberar campos únicos (email, dni) del cliente origen para evitar conflictos
            await tx.client.update({
                where: { id: sourceId },
                data: { email: null, dni: null }
            });

            // 8. Consolidar datos de contacto si el Target no los tiene
            const updateData: any = {};
            if (!targetClient.email && sourceClient.email) updateData.email = sourceClient.email;
            if (!targetClient.phone && sourceClient.phone) updateData.phone = sourceClient.phone;
            if (!targetClient.dni && sourceClient.dni) updateData.dni = sourceClient.dni;
            if (!targetClient.address && sourceClient.address) updateData.address = sourceClient.address;
            if (!targetClient.insurance && sourceClient.insurance) updateData.insurance = sourceClient.insurance;
            if (!targetClient.doctor && sourceClient.doctor) updateData.doctor = sourceClient.doctor;

            if (Object.keys(updateData).length > 0) {
                await tx.client.update({
                    where: { id: targetId },
                    data: updateData
                });
            }

            // 9. Dejar una nota en el historial del Target sobre la fusión
            await tx.interaction.create({
                data: {
                    clientId: targetId,
                    type: "NOTE",
                    content: `[SISTEMA] Ficha fusionada automáticamente con el duplicado ID: ${sourceId} (${sourceClient.name}).`
                }
            });

            // 10. Eliminar el cliente origen (Source)
            await tx.client.delete({
                where: { id: sourceId }
            });

            return { success: true, message: `Clientes fusionados con éxito.` };
        });
    }
};
