'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Download, Search, Package, Clock, CheckCircle2, Truck, Eye, Pencil, Save, X, AlertTriangle, FileText, Banknote, ArrowRightLeft, CreditCard, ChevronRight, ExternalLink, Loader2, ArrowRight, FlaskConical, Calendar, Factory } from 'lucide-react';
import { OrderDetailPanel } from '@/components/orders/OrderDetailPanel';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { PricingService } from '@/services/PricingService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceModal from '@/components/billing/InvoiceModal';
import { generateInvoicePDF } from '@/lib/invoice-generator';
import type { Order } from '@/types/orders';

const LAB_STATUS: Record<string, { key: string, label: string; color: string; icon: any; bg: string; text: string; ring: string }> = {
    'NONE': { key: 'NONE', label: 'Sin enviar', color: 'bg-stone-100 text-stone-500', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-500 dark:text-stone-400', ring: 'ring-stone-200 dark:ring-stone-700', icon: Clock },
    'SENT': { key: 'SENT', label: 'Falta procesar', color: 'bg-amber-100 text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800', icon: Clock },
    'IN_PROGRESS': { key: 'IN_PROGRESS', label: 'Procesado', color: 'bg-blue-100 text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800', icon: Package },
    'FINISHED': { key: 'FINISHED', label: 'Finalizado (Lab)', color: 'bg-fuchsia-100 text-fuchsia-600', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950', text: 'text-fuchsia-600 dark:text-fuchsia-400', ring: 'ring-fuchsia-200 dark:ring-fuchsia-800', icon: Factory },
    'READY': { key: 'READY', label: 'Listo p/ Retirar', color: 'bg-emerald-100 text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800', icon: CheckCircle2 },
    'DELIVERED': { key: 'DELIVERED', label: 'Entregado', color: 'bg-indigo-100 text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-200 dark:ring-indigo-800', icon: Truck },
};

const LAB_STEPS = Object.values(LAB_STATUS);

function getNextStatus(current: string): string | null {
    const idx = LAB_STEPS.findIndex(s => s.key === current);
    if (idx < 0 || idx >= LAB_STEPS.length - 1) return null;
    return LAB_STEPS[idx + 1].key;
}

export default function VentasPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [search, setSearch] = useState('');
    const [filterLab, setFilterLab] = useState<string>('SENT');
    const [filterBalance, setFilterBalance] = useState(false);
    const [filterLaboratory, setFilterLaboratory] = useState<string>('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [editingOrderNumber, setEditingOrderNumber] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [userRole, setUserRole] = useState('STAFF');
    const [loading, setLoading] = useState(true);
    const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
    const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [pageSize, setPageSize] = useState(20);
    const [totalOrders, setTotalOrders] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [allLoaded, setAllLoaded] = useState(false);
    const [searchDebounce, setSearchDebounce] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [requestingInvoiceId, setRequestingInvoiceId] = useState<string | null>(null);

    const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);

    const autoSubmitSmartLab = async (order: any) => {
        setIsAutoSubmitting(true);
        try {
            const rx = order.prescription || {};

            const fmt = (v: number | null | undefined, plus?: boolean) => {
                if (v == null) return '';
                const s = v.toFixed(2);
                return plus && v > 0 ? '+' + s : s;
            };

            const clientName = order.client?.name || '';
            const nameParts = clientName.trim().split(/\s+/);
            const apellido = nameParts.pop() || '';
            const nombre = nameParts.join(' ') || apellido;

            const frameItems = order.items?.filter((i: any) => i.product?.category === 'FRAME' || i.product?.category === 'SUNGLASS' || i.productCategorySnapshot === 'FRAME' || i.productCategorySnapshot === 'SUNGLASS') || [];
            const frameInfo = frameItems.length > 0
                ? `Armazón ${frameItems[0]?.product?.brand || frameItems[0]?.productBrandSnapshot || ''} ${frameItems[0]?.product?.name || frameItems[0]?.productNameSnapshot || ''}`.trim()
                : order.frameSource === 'USUARIO'
                    ? `Armazón del cliente ${order.userFrameBrand || ''} ${order.userFrameModel || ''}`.trim()
                    : '';

            const lensItems = order.items?.filter((i: any) => i.product?.category === 'LENS' || i.productCategorySnapshot === 'LENS') || [];
            const lensProduct = lensItems.length > 0 ? lensItems[0]?.product : null;
            const lensName = lensProduct?.name?.toLowerCase() || lensItems[0]?.productNameSnapshot?.toLowerCase() || '';
            const lensIndex = lensProduct?.lensIndex || '';

            let tipo_lente = 'Monofocal';
            if (lensName.includes('multi') || lensName.includes('progresivo')) tipo_lente = 'Multifocal';
            else if (lensName.includes('bifo') && lensName.includes('kri')) tipo_lente = 'Bifocal Kri';
            else if (lensName.includes('bifo')) tipo_lente = 'Bifocal Ft';
            else if (lensName.includes('ocupa') || lensName.includes('intermedio')) tipo_lente = 'Ocupacional';

            let material = order.labMaterial || '';
            if (!material && lensName) {
                if (lensName.includes('poli')) material = 'Policarbonato';
                else if (lensName.includes('orga') || lensName.includes('orgá')) material = 'Orgánico';
                else if (lensName.includes('alto') || lensName.includes('1.6') || lensName.includes('1.7')) material = 'Alto Índice';
                else if (lensName.includes('vidrio') || lensName.includes('mineral')) material = 'Mineral';
            }

            let tratamiento = order.labTreatment || '';
            if (!tratamiento && lensName) {
                if (lensName.includes('blue') || lensName.includes('block') || lensName.includes('filtro')) tratamiento = 'Filtro Azul';
                else if (lensName.includes('anti') || lensName.includes('ar')) tratamiento = 'Antirreflejo';
                else if (lensName.includes('foto') || lensName.includes('transition')) tratamiento = 'Fotocromático';
            }

            const treatmentItems = order.items?.filter((i: any) => i.product?.category === 'Tratamiento' || i.productCategorySnapshot === 'Tratamiento') || [];
            let tipo_tenido = '';
            let color_tenido = '';
            let intensidad_tenido = '';

            for (const item of treatmentItems) {
                const tName = (item.product?.name || item.productNameSnapshot || '').toLowerCase();
                if (!tratamiento) {
                    if (tName.includes('blue') || tName.includes('block') || tName.includes('filtro')) tratamiento = 'Filtro Azul';
                    else if (tName.includes('anti') || tName.includes('ar')) tratamiento = 'Antirreflejo';
                    else if (tName.includes('foto') || tName.includes('transition')) tratamiento = 'Fotocromático';
                }
                
                if (tName.includes('teñi') || tName.includes('tinte') || tName.includes('color')) {
                    if (tName.includes('degrade') || tName.includes('degradé') || tName.includes('bicolor') || tName.includes('fume')) tipo_tenido = 'Degradé';
                    else if (tName.includes('doble')) tipo_tenido = 'Doble Degradé';
                    else tipo_tenido = 'Pleno';

                    if (tName.includes('gris')) color_tenido = 'Gris';
                    else if (tName.includes('marr') || tName.includes('cafe')) color_tenido = 'Marrón';
                    else if (tName.includes('verde') || tName.includes('g15') || tName.includes('g-15')) color_tenido = 'Verde G15';
                    else if (tName.includes('rosa') || tName.includes('pink')) color_tenido = 'Rosa';
                    else if (tName.includes('azul') || tName.includes('blue')) color_tenido = 'Azul';
                    else if (tName.includes('ama')) color_tenido = 'Amarillo';
                    else if (tName.includes('naran')) color_tenido = 'Naranja';
                    else if (tName.includes('rojo') || tName.includes('red')) color_tenido = 'Rojo';

                    if (tName.includes('10')) intensidad_tenido = '10%';
                    else if (tName.includes('25')) intensidad_tenido = '25%';
                    else if (tName.includes('50')) intensidad_tenido = '50%';
                    else if (tName.includes('75')) intensidad_tenido = '75%';
                    else if (tName.includes('85')) intensidad_tenido = '85%';
                }
            }

            // Fallback: use crystalColor/crystalColorType from order items (set in cotizador)
            if (!color_tenido || !tipo_tenido) {
                const tintItem = order.items?.find((i: any) => i.crystalColor);
                if (tintItem) {
                    if (!color_tenido) color_tenido = tintItem.crystalColor || '';
                    if (!tipo_tenido) {
                        if (tintItem.crystalColorType === 'DEGRADE') tipo_tenido = 'Degradé';
                        else if (tintItem.crystalColorType === 'MUESTRA') tipo_tenido = 'Pleno'; // Según muestra → Pleno in SmartLab
                        else tipo_tenido = 'Pleno';
                    }
                }
            }

            const payload = {
                tipo_lente,
                labType: order.labType || '',
                codigoInterno: clientName,
                paciente_nombre: nombre,
                paciente_apellido: apellido,
                paciente_telefono: '3541215971', // Privacidad: Datos de la óptica, no del paciente
                paciente_email: 'pisano.ishtar@gmail.com', // Privacidad: Datos de la óptica
                od_esfera: fmt(rx.sphereOD, true),
                od_cilindro: fmt(rx.cylinderOD),
                od_eje: rx.axisOD != null ? String(rx.axisOD) : '',
                od_adicion: fmt(rx.additionOD ?? rx.addition, true),
                oi_esfera: fmt(rx.sphereOI, true),
                oi_cilindro: fmt(rx.cylinderOI),
                oi_eje: rx.axisOI != null ? String(rx.axisOI) : '',
                oi_adicion: fmt(rx.additionOI ?? rx.addition, true),
                od_esfera_cerca: fmt(rx.nearSphereOD, true),
                od_cilindro_cerca: fmt(rx.nearCylinderOD),
                od_eje_cerca: rx.nearAxisOD != null ? String(rx.nearAxisOD) : '',
                oi_esfera_cerca: fmt(rx.nearSphereOI, true),
                oi_cilindro_cerca: fmt(rx.nearCylinderOI),
                oi_eje_cerca: rx.nearAxisOI != null ? String(rx.nearAxisOI) : '',
                od_dp: order.labPdOd != null ? String(order.labPdOd) : (rx.distanceOD != null ? String(rx.distanceOD) : ''),
                oi_dp: order.labPdOi != null ? String(order.labPdOi) : (rx.distanceOI != null ? String(rx.distanceOI) : ''),
                od_dp_cerca: order.labNearPdOd != null ? String(order.labNearPdOd) : (rx.nearDistanceOD != null ? String(rx.nearDistanceOD) : ''),
                oi_dp_cerca: order.labNearPdOi != null ? String(order.labNearPdOi) : (rx.nearDistanceOI != null ? String(rx.nearDistanceOI) : ''),
                od_altura: order.labHeightOD != null ? String(order.labHeightOD) : (rx.heightOD != null ? String(rx.heightOD) : ''),
                oi_altura: order.labHeightOI != null ? String(order.labHeightOI) : (rx.heightOI != null ? String(rx.heightOI) : ''),
                observaciones: rx.notes || '',
                color: order.labColor || '',
                armazon: frameInfo,
                diametro: order.labDiameter || '',
                indice: lensIndex,
                material,
                tratamiento,
                tipo_tenido,
                color_tenido,
                intensidad_tenido
            };

            const encodedData = encodeURIComponent(JSON.stringify(payload));
            const smartLabUrl = `https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=${encodedData}`;
            
            alert('✅ ¡Datos copiados al sistema!\n\nPASOS A SEGUIR:\n1️⃣ Se abrirá la web de SmartLab.\n2️⃣ Hacé clic en tu favorito ⭐ "🤖 Atelier → SmartLab".\n3️⃣ ¡No toques nada un segundo! El sistema elegirá el lente y llenará todo.\n\n⚠️ IMPORTANTE:\nSi la página te tira error "404", es porque se cerró tu sesión de SmartLab. Iniciá sesión manualmente y volvé a tocar este botón amarillo.');
            
            window.open(smartLabUrl, '_blank');

        } catch (error) {
            console.error('Error auto-submitting:', error);
            alert('❌ Ocurrió un error al procesar los datos del pedido.');
        } finally {
            setIsAutoSubmitting(false);
        }
    };

    const handleSendWhatsAppInvoice = async (order: Order, invoiceId: string) => {
        const phone = order.client?.phone?.replace(/\D/g, '');
        if (!phone) {
            alert('⚠️ El cliente no tiene teléfono registrado.');
            return;
        }

        setRequestingInvoiceId(`wsp-${invoiceId}`);
        try {
            const res = await fetch(`/api/billing/invoice/${invoiceId}/pdf-data`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al obtener datos de la factura');
            }
            const data = await res.json();
            const pdfResult = await generateInvoicePDF(data, true);
            
            if (!pdfResult) {
                throw new Error('Error generando PDF');
            }

            const text = `✨ *ATELIER ÓPTICA* ✨\n\nHola ${order.client.name},\nTe enviamos adjunta tu factura electrónica de compra.\n\n¡Gracias por elegirnos!`;

            const sendRes = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: `${phone}@c.us`,
                    message: text,
                    media: {
                        base64: pdfResult.base64,
                        mimetype: 'application/pdf',
                        filename: pdfResult.fileName
                    }
                })
            });

            if (sendRes.ok) {
                alert('✅ Factura enviada por WhatsApp al cliente');
            } else {
                throw new Error('Error de conexión con el bot de WhatsApp');
            }
        } catch (error: any) {
            console.error('Error sending invoice via WhatsApp:', error);
            alert(`❌ Error enviando la factura: ${error.message}`);
        } finally {
            setRequestingInvoiceId(null);
        }
    };

    useEffect(() => {
        // Get user role from localStorage or fallback to API
        const loadUserRole = async () => {
            try {
                const stored = localStorage.getItem('user');
                if (stored) {
                    const u = JSON.parse(stored);
                    setUserRole(u.role || 'STAFF');
                    return;
                }
            } catch { }
            // Fallback: fetch from API if localStorage is empty
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const u = await res.json();
                    setUserRole(u.role || 'STAFF');
                    localStorage.setItem('user', JSON.stringify(u));
                }
            } catch { }
        };
        loadUserRole();
    }, []);

    useEffect(() => {
        fetchOrders(search);
    }, [filterLab, filterBalance, filterLaboratory, dateFrom, dateTo]);

    // Auto-sync SmartLab una sola vez al cargar la página
    useEffect(() => {
        const autoSync = async () => {
            try {
                const res = await fetch('/api/smartlab-sync', { method: 'POST' });
                if (res.ok) {
                    fetchOrders(search); // Refrescar con datos de SmartLab
                }
            } catch (err) {
                console.error('Error auto-sync SmartLab:', err);
            }
        };
        autoSync();
    }, []);

    const fetchOrders = async (searchTerm?: string, loadAll?: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const currentSearch = searchTerm !== undefined ? searchTerm : search;
            const params = new URLSearchParams({
                paginate: 'true',
                type: 'SALE',
                limit: loadAll ? '9999' : String(pageSize),
            });
            if (currentSearch) params.set('search', currentSearch);
            if (loadAll) params.set('nolimit', 'true');

            // Apply active filters directly to API request
            if (filterLab !== 'ALL') params.set('labStatus', filterLab);
            if (filterBalance) params.set('hasBalance', 'true');
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            if (filterLaboratory !== 'ALL') params.set('laboratory', filterLaboratory);
            
            const res = await fetch(`/api/orders?${params}`);
            const data = await res.json();
            
            if (data.error) {
                setError(data.error);
                setOrders([]);
            } else {
                const allOrders = data.orders || [];
                const sales = allOrders.filter((o: Order) => !o.isDeleted);
                setOrders(sales);
                setTotalOrders(data.pagination?.total || sales.length);
                setTotalRevenue(data.totalRevenue || 0);
                setAllLoaded(loadAll || sales.length >= (data.pagination?.total || 0));
            }
        } catch (err: any) {
            console.error('Error fetching orders:', err);
            setError('Error al conectar con el servidor. Por favor, reintente.');
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const nextPage = Math.floor(orders.length / pageSize) + 1;
            const params = new URLSearchParams({
                paginate: 'true',
                type: 'SALE',
                limit: String(pageSize),
                page: String(nextPage),
            });
            if (search) params.set('search', search);

            // Apply active filters directly to API request
            if (filterLab !== 'ALL') params.set('labStatus', filterLab);
            if (filterBalance) params.set('hasBalance', 'true');
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            if (filterLaboratory !== 'ALL') params.set('laboratory', filterLaboratory);
            
            const res = await fetch(`/api/orders?${params}`);
            const data = await res.json();
            
            if (data.orders) {
                const newSales = (data.orders || []).filter((o: Order) => !o.isDeleted);
                setOrders(prev => {
                    const existingIds = new Set(prev.map(o => o.id));
                    const unique = newSales.filter((o: Order) => !existingIds.has(o.id));
                    return [...prev, ...unique];
                });
                setTotalOrders(data.pagination?.total || 0);
                if (data.totalRevenue !== undefined) setTotalRevenue(data.totalRevenue);
                if (newSales.length < pageSize || (orders.length + newSales.length) >= (data.pagination?.total || 0)) {
                    setAllLoaded(true);
                }
            }
        } catch (err) {
            console.error('Error loading more:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const loadAll = async () => {
        setLoadingMore(true);
        try {
            const params = new URLSearchParams({
                paginate: 'true',
                type: 'SALE',
                nolimit: 'true',
            });
            if (search) params.set('search', search);
            if (filterLab !== 'ALL') params.set('labStatus', filterLab);
            if (filterBalance) params.set('hasBalance', 'true');
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            if (filterLaboratory !== 'ALL') params.set('laboratory', filterLaboratory);
            
            const res = await fetch(`/api/orders?${params}`);
            const data = await res.json();
            
            if (data.orders) {
                const sales = (data.orders || []).filter((o: Order) => !o.isDeleted);
                setOrders(sales);
                setTotalOrders(data.pagination?.total || sales.length);
                setAllLoaded(true);
            }
        } catch (err) {
            console.error('Error loading all:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const isAdmin = userRole === 'ADMIN';

    // Extract unique laboratories from lens items
    const uniqueLaboratories = Array.from(
        new Set(
            orders.flatMap(o =>
                o.items
                    .filter(i => i.product?.category === 'Cristal' && (i.product as any)?.laboratory)
                    .map(i => (i.product as any).laboratory as string)
            )
        )
    ).sort();

    // Memoize financials per order to avoid redundant recalculations in filter, stats & render
    const financialsMap = useMemo(() => {
        const map = new Map<string, ReturnType<typeof PricingService.calculateOrderFinancials>>();
        for (const o of orders) {
            map.set(o.id, PricingService.calculateOrderFinancials(o));
        }
        return map;
    }, [orders]);

    const getFinancials = (orderId: string) => {
        const f = financialsMap.get(orderId);
        if (f) return f;
        return {
            hasBalance: false,
            remainingCash: 0,
            remainingTransfer: 0,
            remainingCard: 0,
            paidReal: 0,
            listPrice: 0,
            totalCard: 0,
            totalCash: 0,
            totalTransfer: 0,
            progress: 0,
            discountAmount: 0,
            subtotal: 0
        };
    };

    const filteredOrders = orders.filter(o => {
        if (!o) return false;
        const searchWords = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const matchSearch = searchWords.length === 0 || searchWords.every(word =>
            (o.client?.name || '').toLowerCase().includes(word) ||
            (o.id || '').toLowerCase().includes(word) ||
            (o.labOrderNumber || '').toLowerCase().includes(word)
        );
        const matchLab = filterLab === 'ALL' || (o.labStatus || 'NONE') === filterLab;
        const matchLaboratory = filterLaboratory === 'ALL' || (o.items || []).some(i => i.product?.category === 'Cristal' && (i.product as any)?.laboratory === filterLaboratory);
        const matchDate = (!dateFrom || new Date(o.createdAt) >= new Date(dateFrom)) && (!dateTo || new Date(o.createdAt) <= new Date(dateTo + 'T23:59:59'));
        const matchBalance = !filterBalance || getFinancials(o.id).hasBalance;
        return matchSearch && matchLab && matchLaboratory && matchDate && matchBalance;
    });

    const saveLabOrderNumber = async (orderId: string) => {
        await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labOrderNumber: editValue }),
        });
        setEditingOrderNumber(null);
        fetchOrders();
    };

    const handleDeleteRequest = async (orderId: string) => {
        if (isAdmin) {
            const firstConfirm = confirm('⚠️ ATENCIÓN: Estás a punto de eliminar esta venta. ¿Estás seguro?');
            if (!firstConfirm) return;
            
            const secondConfirm = prompt('Para confirmar la eliminación definitiva, escribí "ELIMINAR" en mayúsculas:');
            if (secondConfirm !== 'ELIMINAR') {
                alert('Eliminación cancelada. La palabra no coincide.');
                return;
            }

            const reason = prompt('Motivo de la eliminación (opcional pero recomendado):') || 'Eliminado por admin';
            await fetch(`/api/orders/${orderId}?reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
            fetchOrders();
        } else {
            const order = orders.find(o => o.id === orderId);
            const reason = prompt('Motivo de la solicitud de eliminación:');
            if (!reason) return;
            try {
                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'DELETE_REQUEST',
                        message: `Eliminar venta #${orderId.slice(-4).toUpperCase()} de ${order?.client?.name || 'cliente'}. Motivo: ${reason}`,
                        orderId,
                    }),
                });
                if (res.ok) {
                    alert('✅ Solicitud de eliminación enviada al administrador.');
                } else {
                    alert('Error al enviar la solicitud.');
                }
            } catch {
                alert('Error de conexión.');
            }
        }
    };

    const handleInvoiceRequest = async (order: Order) => {
        const financials = PricingService.calculateOrderFinancials(order);
        const maxInvoiceable = financials.paidReal;

        if (maxInvoiceable <= 0) {
            return alert('No hay pagos registrados para esta venta. No se puede solicitar factura.');
        }

        if (isAdmin) {
            setInvoiceOrder({ ...order, customAmount: maxInvoiceable } as any);
        } else {
            const amountStr = prompt(
                `Monto a facturar para ${order.client.name}:\n(Pago total registrado hasta hoy: $${maxInvoiceable.toLocaleString('es-AR')})`, 
                maxInvoiceable.toString()
            );
            
            if (!amountStr) return;
            
            const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
            
            if (isNaN(amount)) return alert('Monto inválido');
            if (amount > maxInvoiceable) {
                return alert(`Error: No podés facturar más de lo que el cliente pagó ($${maxInvoiceable.toLocaleString('es-AR')}).`);
            }

            setRequestingInvoiceId(order.id);
            try {
                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'INVOICE_REQUEST',
                        message: `Solicitar factura de $${amount.toLocaleString('es-AR')} (Pago total del cliente: $${maxInvoiceable.toLocaleString('es-AR')}) para venta #${order.id.slice(-4).toUpperCase()} (${order.client.name})`,
                        orderId: order.id,
                    }),
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    alert('✅ Solicitud de factura enviada al administrador.');
                } else {
                    alert(data.error || 'Error al enviar la solicitud.');
                }
            } catch {
                alert('Error de conexión al solicitar factura.');
            } finally {
                setRequestingInvoiceId(null);
            }
        }
    };

    const advanceStatus = async (orderId: string, currentStatus: string) => {
        const next = getNextStatus(currentStatus || 'NONE');
        if (!next) return;
        setUpdatingId(orderId);
        try {
            await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labStatus: next }),
            });
            await fetchOrders();
        } catch (error) {
            console.error('Error advancing status:', error);
        }
        setUpdatingId(null);
    };

    const downloadLabSheet = (order: Order) => {
        const items = order.items || [];
        const dateStr = format(new Date(order.createdAt), "d 'de' MMMM yyyy", { locale: es });
        const labDate = order.labSentAt ? format(new Date(order.labSentAt), "d/MM/yyyy HH:mm", { locale: es }) : 'Pendiente';
        const financials = PricingService.calculateOrderFinancials(order);
        const logoUrl = `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido Lab - ${order.client.name} | Atelier</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
  body { padding: 40px 50px; color: #1c1917; font-size: 13px; line-height:1.4; background: white; }
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; border-bottom:2px solid #1c1917; margin-bottom: 8px; }
  .letterhead-logo { height:58px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; font-weight: 500; }
  .address-bold { font-weight:800; color:#1c1917; text-transform: uppercase; letter-spacing: 1px; }
  .tagline { text-align:center; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:2.5px; color:#a0845e; padding:14px 0; border-bottom: 1px solid #f5f5f4; margin-bottom: 10px; }
  .doc-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px; }
  .doc-title { font-size:22px; font-weight:900; text-transform:uppercase; color:#1c1917; letter-spacing: 2px; }
  .doc-meta { font-size:11px; color:#a8a29e; font-weight: 800; }
  .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px; }
  .info-box { border:1.5px solid #e7e5e4; border-radius:14px; padding:14px; background: #fffcf9; }
  .info-box h3 { font-size:9px; font-weight:900; text-transform:uppercase; color:#a8a29e; border-bottom: 1px solid #e7e5e4; padding-bottom: 6px; margin-bottom: 8px; }
  .info-row { display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px; }
  .info-label { color:#78716c; font-weight: 600; }
  .info-value { font-weight:800; color:#1c1917; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; border-radius: 12px; overflow: hidden; border: 1.5px solid #e7e5e4; }
  th { background:#1c1917; color:white; padding:12px 14px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1px; }
  td { padding:12px 14px; border-bottom:1px solid #f5f5f4; font-size:12px; }
  tr:nth-child(even) { background:#fffcf9; }
  .financial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
  .financial-card { border-radius: 18px; padding: 18px; border: 1.5px solid #e7e5e4; text-align: center; }
  .f-title { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; display: block; color: #a8a29e; }
  .f-amount { font-size: 18px; font-weight: 900; color: #1c1917; display: block; margin-bottom: 4px; }
  .f-saldo { font-size: 11px; font-weight: 900; color: #10b981; background: #f0fdf4; padding: 4px 10px; border-radius: 8px; display: inline-block; }
  .totals-summary { margin-top: 25px; padding: 25px; border-radius: 20px; background: #1c1917; color: white; display: flex; justify-content: space-between; align-items: center; }
  .tot-col { text-align: center; padding: 0 15px; border-right: 1px solid rgba(255,255,255,0.1); }
  .tot-col:last-of-type { border-right: none; }
  .tot-val { font-size: 18px; font-weight: 900; display: block; }
  .tot-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; display: block; margin-bottom: 4px; }
  .tot-paid { text-align: right; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 25px; margin-left: 10px; }
  .paid-value { font-size: 24px; font-weight: 900; color: #fbbf24; }
  .footer { margin-top: 40px; text-align: center; border-top: 2px solid #e7e5e4; padding-top: 20px; font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 14px 28px; background: #1c1917; color: white; border: none; border-radius: 14px; font-weight: 900; cursor: pointer; z-index: 1000; }
</style></head><body>
<button class="print-btn" onclick="window.print()">IMPRIMIR PDF</button>
<div class='letterhead'>
    <Image src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
    <div class='letterhead-right'>
        <div class='address-bold'>José Luis de Tejeda 4380 · Córdoba</div>
        <div>Fecha: ${dateStr}</div>
    </div>
</div>
<div class='tagline'>La óptica mejor calificada de Córdoba ⭐ 5/5 Google Business</div>
<div class='doc-header'>
    <div>
        <div class='doc-title'>Pedido de Laboratorio <span style="background:#1c1917; color:white; padding:2px 8px; border-radius:4px; font-size:7px; margin-left:10px; vertical-align:middle;">V2.0</span></div>
        <div class='doc-meta'>#${order.id.slice(-6).toUpperCase()} · ${labDate}</div>
    </div>
</div>
<div class='info-grid'>
    <div class='info-box'>
        <h3>👤 Datos del Cliente</h3>
        <div class='info-row'><span class='info-label'>Nombre</span><span class='info-value'>${order.client.name}</span></div>
        <div class='info-row'><span class='info-label'>Teléfono</span><span class='info-value'>${order.client.phone || 'No registrado'}</span></div>
    </div>
    <div class='info-box'>
        <h3>🔬 Info Cristales</h3>
        <div class='info-row'><span class='info-label'>Tratamiento</span><span class='info-value'>${order.labTreatment || 'Normal'}</span></div>
        <div class='info-row'><span class='info-label'>Color</span><span class='info-value'>${order.labColor || 'Blanco'}</span></div>
        ${(() => {
            const tintItems = items.filter((i: any) => i.crystalColor);
            if (tintItems.length === 0) return '';
            return tintItems.map((i: any) => 
                `<div class='info-row' style='background:#f3e8ff;border-radius:8px;padding:4px 8px;margin-top:4px;'><span class='info-label'>🎨 Teñido${i.eye ? ` (${i.eye})` : ''}</span><span class='info-value' style='color:#7c3aed;font-weight:900;'>${i.crystalColorType === 'DEGRADE' ? 'Degradé' : i.crystalColorType === 'MUESTRA' ? 'Según Muestra' : 'Compacto'} — ${i.crystalColor}</span></div>`
            ).join('');
        })()}
    </div>
</div>

<table>
    <thead><tr><th>Producto</th><th>Tipo</th><th style='text-align:center'>Cant.</th><th style='text-align:right'>Precio</th><th style='text-align:right'>Subtotal</th></tr></thead>
    <tbody>${items.map(it => `<tr><td>${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}</td><td>${it.product?.type || it.product?.category || it.productCategorySnapshot || ''}</td><td style='text-align:center'>${it.quantity}</td><td style='text-align:right'>$${it.price?.toLocaleString()}</td><td style='text-align:right'>$${(it.price * it.quantity).toLocaleString()}</td></tr>`).join('')}</tbody>
</table>

<div class='financial-grid'>
    <div class='financial-card'>
        <span class='f-title'>💵 Saldo Efectivo</span>
        <span class='f-amount'>$${financials.remainingCash.toLocaleString()}</span>
        ${!financials.hasBalance ? '<span class="f-saldo">PAGADO</span>' : ''}
    </div>
    <div class='financial-card'>
        <span class='f-title'>🏦 Saldo Transferencia</span>
        <span class='f-amount'>$${financials.remainingTransfer.toLocaleString()}</span>
        ${!financials.hasBalance ? '<span class="f-saldo">PAGADO</span>' : ''}
    </div>
    <div class='financial-card'>
        <span class='f-title'>💳 Saldo Tarjeta</span>
        <span class='f-amount'>$${financials.remainingCard.toLocaleString()}</span>
        ${!financials.hasBalance ? '<span class="f-saldo">PAGADO</span>' : ''}
    </div>
</div>

<div class='totals-summary'>
    <div class='tot-col'>
        <span class='tot-label'>💵 Efectivo</span>
        <span class='tot-val'>$${financials.totalCash.toLocaleString()}</span>
    </div>
    <div class='tot-col'>
        <span class='tot-label'>🏦 Transf</span>
        <span class='tot-val'>$${financials.totalTransfer.toLocaleString()}</span>
    </div>
    <div class='tot-col'>
        <span class='tot-label'>💳 Tarjeta</span>
        <span class='tot-val'>$${financials.totalCard.toLocaleString()}</span>
    </div>
    <div class='tot-paid'>
        <span class='tot-label'>Abonado Real</span>
        <span class='paid-value'>$${financials.paidReal.toLocaleString()}</span>
    </div>
</div>

<div class='footer'>Atelier Óptica · José Luis de Tejeda 4380, Córdoba · Profesionalismo y Diseño</div>
</body></html>`;

        const printWindow = window.open('', '_blank', 'width=800,height=1000');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 400);
        }
    };

    const ordersWithBalance = orders.filter(o => getFinancials(o.id).hasBalance);
    const totalPendingAmount = ordersWithBalance.reduce((sum, o) => {
        const f = getFinancials(o.id);
        return sum + f.remainingCash + f.remainingTransfer + f.remainingCard;
    }, 0);

    const stats = {
        total: totalOrders,
        sent: orders.filter(o => o.labStatus === 'SENT').length,
        inProgress: orders.filter(o => o.labStatus === 'IN_PROGRESS').length,
        finished: orders.filter(o => o.labStatus === 'FINISHED').length,
        ready: orders.filter(o => o.labStatus === 'READY').length,
        delivered: orders.filter(o => o.labStatus === 'DELIVERED').length,
        revenue: totalRevenue,
        withBalance: ordersWithBalance.length,
    };

    return (
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <ShoppingCart className="w-8 h-8 lg:w-9 lg:h-9 text-emerald-500" /> Ventas
                    </h1>
                    <p className="text-stone-400 text-xs lg:text-sm mt-1">Operaciones confirmadas y enviadas a laboratorio</p>
                </div>
                {isAdmin && (
                    <div className="text-left md:text-right w-full md:w-auto p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl md:bg-transparent md:p-0">
                        <p className="text-2xl lg:text-3xl font-black text-emerald-500">${stats.revenue.toLocaleString()}</p>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Facturación total</p>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {[
                    { label: 'Total Ventas', value: stats.total, color: 'bg-stone-900 text-white' },
                    { label: 'Falta Procesar', value: stats.sent, color: 'bg-amber-100 text-amber-600' },
                    { label: 'Procesados', value: stats.inProgress, color: 'bg-blue-100 text-blue-600' },
                    { label: 'Finalizados (Lab)', value: stats.finished, color: 'bg-fuchsia-100 text-fuchsia-600' },
                    { label: 'Listas', value: stats.ready, color: 'bg-emerald-100 text-emerald-600' },
                    { label: 'Entregadas', value: stats.delivered, color: 'bg-indigo-100 text-indigo-600' },
                ].map(s => (
                    <div key={s.label} className={`${s.color} rounded-2xl p-5 text-center`}>
                        <p className="text-3xl font-black">{s.value}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="space-y-6 mb-8">
                <div className="flex flex-col lg:flex-row gap-5">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-emerald-500 transition-colors duration-300" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, N° venta o N° operación lab..."
                            value={search}
                            onChange={e => {
                                const val = e.target.value;
                                setSearch(val);
                                if (searchDebounce) clearTimeout(searchDebounce);
                                const newDebounce = setTimeout(() => {
                                    setAllLoaded(false);
                                    fetchOrders(val);
                                }, 400);
                                setSearchDebounce(newDebounce);
                            }}
                            className="w-full pl-14 pr-6 py-5 bg-stone-50/50 dark:bg-stone-800/30 backdrop-blur-md border border-stone-200/50 dark:border-stone-700/50 rounded-full shadow-[0_2px_10px_-3px_rgba(16,185,129,0.05)] focus:bg-white dark:focus:bg-stone-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium text-stone-800 dark:text-stone-100 placeholder-stone-400"
                        />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar inline-flex items-center bg-stone-100/50 dark:bg-stone-800/50 backdrop-blur-md p-1.5 rounded-full border border-stone-200/50 dark:border-stone-700/50 w-max">
                        {['ALL', 'SENT', 'IN_PROGRESS', 'FINISHED', 'READY', 'DELIVERED'].map(f => {
                            const isActive = filterLab === f && !filterBalance;
                            return (
                                <button
                                    key={f}
                                    onClick={() => { setFilterLab(f); if (f !== 'ALL') setFilterBalance(false); }}
                                    className={`relative px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                                        isActive 
                                        ? 'text-stone-900 dark:text-white' 
                                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                                    }`}
                                >
                                    {isActive && <div className="absolute inset-0 bg-white dark:bg-stone-600 rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-none -z-10 animate-in zoom-in-95 duration-200" />}
                                    {f === 'ALL' ? 'Todas' : LAB_STATUS[f]?.label || f}
                                </button>
                            );
                        })}

                        {/* Separador visual */}
                        <div className="w-px h-6 bg-stone-300/50 dark:bg-stone-600/50 mx-2" />

                        {/* Filtro de Saldos Pendientes */}
                        <button
                            onClick={() => { setFilterBalance(!filterBalance); if (!filterBalance) setFilterLab('ALL'); }}
                            className={`relative px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                                filterBalance
                                ? 'text-white'
                                : stats.withBalance > 0
                                    ? 'text-red-500 hover:text-red-600'
                                    : 'text-stone-400 hover:text-stone-600'
                            }`}
                        >
                            {filterBalance && <div className="absolute inset-0 bg-red-500 rounded-full shadow-[0_2px_8px_-2px_rgba(239,68,68,0.4)] -z-10 animate-in zoom-in-95 duration-200" />}
                            <Banknote className="w-3.5 h-3.5" />
                            Con Saldo
                            {stats.withBalance > 0 && (
                                <span className={`ml-0.5 px-1.5 py-0.5 rounded-lg text-[9px] font-black ${filterBalance ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                                    {stats.withBalance}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Laboratory & Date Filters */}
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Lab filter dropdown */}
                    <div className="flex items-center gap-3 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm px-4 py-2 rounded-full border border-stone-200/50 dark:border-stone-700/50">
                        <FlaskConical className="w-4 h-4 text-stone-400" />
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Lab:</span>
                        <select
                            value={filterLaboratory}
                            onChange={e => setFilterLaboratory(e.target.value)}
                            className="bg-transparent text-xs font-bold text-stone-700 dark:text-stone-300 outline-none cursor-pointer"
                        >
                            <option value="ALL">Todos los laboratorios</option>
                            {uniqueLaboratories.map(lab => (
                                <option key={lab} value={lab}>{lab}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date filters */}
                    <div className="flex items-center gap-3 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm px-4 py-2.5 rounded-full border border-stone-200/50 dark:border-stone-700/50">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Desde:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="bg-transparent text-xs font-bold text-stone-700 dark:text-stone-300 outline-none cursor-pointer"
                        />
                        <span className="text-stone-400 text-xs font-black px-2">a</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="bg-transparent text-xs font-bold text-stone-700 dark:text-stone-300 outline-none cursor-pointer"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="ml-2 p-1.5 bg-stone-200/50 dark:bg-stone-700/50 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-full transition-all"
                                title="Limpiar fechas"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Orders Grid */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="w-10 h-10 border-4 border-stone-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-stone-400">Cargando ventas...</p>
                </div>
            ) : error ? (
                <div className="text-center py-20 border-2 border-dashed border-red-200 dark:border-red-900/30 rounded-3xl bg-red-50/30 dark:bg-red-900/10">
                    <AlertTriangle className="w-16 h-16 text-red-300 mx-auto mb-4" />
                    <p className="text-sm font-black text-red-400 uppercase tracking-widest">Error al cargar datos</p>
                    <p className="text-xs text-red-400 mt-2">{error}</p>
                    <button 
                        onClick={() => fetchOrders()}
                        className="mt-6 px-6 py-2 bg-stone-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all"
                    >
                        REINTENTAR
                    </button>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-3xl">
                    <ShoppingCart className="w-16 h-16 text-stone-200 mx-auto mb-4" />
                    <p className="text-sm font-black text-stone-300 uppercase tracking-widest">No hay ventas {filterLab !== 'ALL' ? 'con ese estado' : ''}</p>
                    <p className="text-xs text-stone-300 mt-2">Las ventas se crean al convertir un presupuesto en la ficha del contacto</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map(order => {
                        const labInfo = LAB_STATUS[order.labStatus || 'NONE'] || LAB_STATUS['NONE'];
                        const nextStep = getNextStatus(order.labStatus || 'NONE');
                        const nextStepInfo = nextStep ? LAB_STATUS[nextStep] : null;
                        const LabIcon = labInfo.icon;
                        const isUpdating = updatingId === order.id;
                        const financials = getFinancials(order.id);
                        const isGrupoOptico = (order.items || []).some((i: any) => i.product?.category === 'Cristal' && /grupo[\s\-]?ó?o?ptico/i.test((i.product as any)?.laboratory || ''));
                        const orderLabs = Array.from(new Set(
                            (order.items || [])
                                .filter((i: any) => i.product?.category === 'Cristal' && (i.product as any)?.laboratory)
                                .map((i: any) => (i.product as any).laboratory as string)
                        ));

                        return (
                            <div key={order.id} className={`border-2 rounded-2xl p-4 lg:p-6 hover:shadow-lg transition-all ${financials.hasBalance
                                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                                    : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700'
                                }`}>
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                                    {/* Lab Status Icon & Basic Info (Combined on Mobile) */}
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl ${labInfo.color} flex items-center justify-center flex-shrink-0 ${isUpdating ? 'animate-pulse' : ''}`}>
                                            <LabIcon className="w-5 h-5 lg:w-6 lg:h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base lg:text-lg font-black text-stone-800 dark:text-white truncate">
                                                <a 
                                                    href={`/admin/contactos?id=${order.clientId}`}
                                                    className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline underline-offset-2 transition-colors cursor-pointer"
                                                    title="Ver ficha del cliente"
                                                >
                                                    {order.client?.name || 'Cliente Desconocido'}
                                                </a>
                                            </h3>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest ${labInfo.color}`}>
                                                    {labInfo.label}
                                                </span>
                                                {financials.progress >= 100 && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">PAGADO</span>
                                                )}
                                                {orderLabs.length > 0 && orderLabs.map(lab => (
                                                    <span key={lab} className="px-2 py-0.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 flex items-center gap-1">
                                                        <FlaskConical className="w-2.5 h-2.5" />
                                                        {lab}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Total on Mobile Header */}
                                        <div className="lg:hidden text-right">
                                            <p className="text-lg font-black text-stone-800 dark:text-white">${(order.total || 0).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Payment Detail (Triple Saldo) */}
                                    <div className="flex flex-col gap-1.5 lg:border-l-2 lg:border-stone-100 lg:dark:border-stone-700 lg:pl-4 py-0.5">
                                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Saldo Pendiente</span>
                                        <div className="flex flex-wrap gap-2">
                                            {!financials.hasBalance ? (
                                                <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                                                    PAGADO
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex flex-col rounded-lg bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                                        <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Banknote className="w-3 h-3" /> Efvo</span>
                                                        <span className="text-[9px] lg:text-[10px] font-black mt-0.5">${financials.remainingCash.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex flex-col rounded-lg bg-violet-50 dark:bg-violet-900/10 px-2 py-1 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30">
                                                        <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Transf</span>
                                                        <span className="text-[9px] lg:text-[10px] font-black mt-0.5">${financials.remainingTransfer.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex flex-col rounded-lg bg-orange-50 dark:bg-orange-900/10 px-2 py-1 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30">
                                                        <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><CreditCard className="w-3 h-3" /> Cuotas</span>
                                                        <span className="text-[9px] lg:text-[10px] font-black mt-0.5">${financials.remainingCard.toLocaleString()}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info Badges */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] lg:text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                        <span>Venta #{order.id.slice(-4).toUpperCase()}</span>
                                        <span>·</span>
                                        <span>{format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}</span>
                                        <span>·</span>
                                        <span>{(order.items || []).length} item{(order.items || []).length !== 1 ? 's' : ''}</span>
                                        {order.labSentAt && (() => {
                                            const start = new Date(order.labSentAt);
                                            const end = ['READY', 'DELIVERED'].includes(order.labStatus || '') && order.updatedAt
                                                ? new Date(order.updatedAt)
                                                : new Date();
                                            const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                            const isCompleted = ['READY', 'DELIVERED'].includes(order.labStatus || '');
                                            return (
                                                <>
                                                    <span className="hidden sm:inline">·</span>
                                                    <span className="w-full sm:w-auto mt-1 sm:mt-0">
                                                        Enviado: {format(new Date(order.labSentAt), "d/MM HH:mm", { locale: es })}
                                                        <span className={`ml-1 font-black ${isCompleted ? 'text-emerald-500' : 'text-blue-500'}`}>
                                                            ({isCompleted ? `demoró ${days} d` : `${days} d`})
                                                        </span>
                                                    </span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                    {/* SmartLab Info — Multi-cristal */}
                                    {order.smartLabProgress != null && order.smartLabProgress > 0 && (() => {
                                        let details: any[] = [];
                                        try { details = order.smartLabDetails ? JSON.parse(order.smartLabDetails) : []; } catch {}
                                        
                                        return (
                                            <div className="mt-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-100 dark:border-blue-800/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Factory className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">SmartLab</span>
                                                    {order.smartLabDays != null && (
                                                        <span className="ml-auto text-[8px] font-black text-amber-500">{order.smartLabDays}d en lab</span>
                                                    )}
                                                </div>
                                                {details.length > 1 ? (
                                                    <div className="space-y-2">
                                                        {details.map((d: any, i: number) => (
                                                            <div key={i}>
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <span className="text-[8px] font-bold text-stone-500">
                                                                        🔹 {d.num}
                                                                    </span>
                                                                    <span className={`text-[9px] font-black ${d.progress >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
                                                                        {d.progress}%
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden mb-0.5">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all ${d.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                                        style={{ width: `${Math.min(100, d.progress)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[7px] font-bold text-stone-400">{d.sector}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[9px] font-bold text-stone-600 dark:text-stone-300">
                                                                {order.smartLabSector || '\u2014'}
                                                            </span>
                                                            <span className={`text-[10px] font-black ${order.smartLabProgress >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
                                                                {order.smartLabProgress}%
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full transition-all ${order.smartLabProgress >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                                                                style={{ width: `${Math.min(100, order.smartLabProgress)}%` }}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}

                                {/* Lab Order Number & Actions */}
                                <div className="flex flex-col lg:flex-row items-center gap-4 mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
                                    <div className="w-full lg:w-72">
                                        {editingOrderNumber === order.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    placeholder="N° operación"
                                                    className="w-full px-3 py-2 border-2 border-emerald-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveLabOrderNumber(order.id)} className="p-2 bg-emerald-500 text-white rounded-xl hover:scale-105 transition-all">
                                                    <Save className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setEditingOrderNumber(null)} className="p-2 bg-stone-200 text-stone-500 rounded-xl hover:scale-105 transition-all">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingOrderNumber(order.id); setEditValue(order.labOrderNumber || ''); }}
                                                className="w-full text-left px-3 py-2 bg-stone-50 dark:bg-stone-700 border-2 border-dashed border-stone-200 dark:border-stone-600 rounded-xl hover:border-emerald-300 transition-all group"
                                            >
                                                {order.labOrderNumber ? (
                                                    <div>
                                                        <span className="text-[8px] lg:text-[9px] font-black text-stone-400 uppercase tracking-widest block">
                                                            N° Op. Lab {orderLabs.length > 0 ? `(${orderLabs.join(', ')})` : ''}
                                                        </span>
                                                        <span className="text-xs lg:text-sm font-black text-stone-800 dark:text-white">{order.labOrderNumber}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-stone-400 group-hover:text-emerald-500">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest">
                                                            Agregar N° Op. {orderLabs.length > 0 ? `(${orderLabs.join(', ')})` : ''}
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Total on Desktop */}
                                    <div className="hidden lg:block flex-shrink-0 text-right">
                                        <p className="text-xl font-black text-stone-800 dark:text-white">${(order.total || 0).toLocaleString()}</p>
                                        <div className="w-24 h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full mt-2 overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${financials.progress}%` }} />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 lg:flex-shrink-0 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
                                        {/* Advance Status Button */}
                                        {nextStepInfo && (
                                            <button
                                                onClick={() => advanceStatus(order.id, order.labStatus || 'NONE')}
                                                disabled={isUpdating}
                                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm ${nextStepInfo.key === 'SENT'
                                                    ? 'bg-blue-500 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
                                                    : nextStepInfo.key === 'IN_PROGRESS'
                                                        ? 'bg-amber-500 text-white shadow-amber-500/20'
                                                        : nextStepInfo.key === 'FINISHED'
                                                            ? 'bg-fuchsia-500 text-white shadow-fuchsia-500/20'
                                                            : nextStepInfo.key === 'READY'
                                                                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                                                : 'bg-indigo-500 text-white shadow-indigo-500/20'
                                                    }`}
                                            >
                                                {isUpdating ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                )}
                                                {nextStepInfo.label}
                                            </button>
                                        )}


                                        {/* Invoice badge or button */}
                                        {(() => {
                                            const completedInvoices = (order.invoices || []).filter((i: any) => i.status === 'COMPLETED');
                                            const totalInvoiced = completedInvoices.reduce((acc: number, curr: any) => acc + curr.totalAmount, 0);
                                            
                                            const renderNodes: React.ReactNode[] = [];

                                            completedInvoices.forEach((inv: any) => {
                                                renderNodes.push(
                                                    <div key={`inv-group-${inv.id}`} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden p-0.5">
                                                        <button 
                                                            key={`inv-${inv.id}`}
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetch(`/api/billing/invoice/${inv.id}/pdf-data`);
                                                                    if (!res.ok) {
                                                                        const errorData = await res.json();
                                                                        throw new Error(errorData.error || 'Error desconocido');
                                                                    }
                                                                    const data = await res.json();
                                                                    await generateInvoicePDF(data);
                                                                } catch (e: any) {
                                                                    alert('Error abriendo el PDF: ' + e.message);
                                                                }
                                                            }}
                                                            className="px-2 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all text-left flex items-center gap-2 rounded-lg" 
                                                            title={`Ver PDF de Factura\nCAE: ${inv.cae}\nVto: ${inv.caeExpiration}`}
                                                        >
                                                            <div>
                                                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Factura C</span>
                                                                <span className="text-xs font-black text-indigo-600">
                                                                    {inv.pointOfSale?.toString().padStart(4, '0')}-{inv.voucherNumber?.toString().padStart(8, '0')}
                                                                </span>
                                                            </div>
                                                            <ExternalLink className="w-4 h-4 text-indigo-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleSendWhatsAppInvoice(order, inv.id)}
                                                            disabled={requestingInvoiceId === `wsp-${inv.id}`}
                                                            className="p-2 hover:bg-[#25D366]/10 text-stone-400 hover:text-[#25D366] transition-all rounded-lg disabled:opacity-50"
                                                            title="Enviar Factura por WhatsApp"
                                                        >
                                                            {requestingInvoiceId === `wsp-${inv.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                );
                                            });

                                            // Only render "Solicitar Factura" if there is remaining un-invoiced paid balance
                                            if (financials.paidReal > totalInvoiced) {
                                                renderNodes.push(
                                                    <button
                                                        key={`req-${order.id}`}
                                                        onClick={() => handleInvoiceRequest(order)}
                                                        disabled={requestingInvoiceId === order.id}
                                                        className={`p-3 rounded-xl hover:scale-110 transition-all disabled:opacity-50 disabled:hover:scale-100 ${isAdmin ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:bg-indigo-100' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-500 hover:bg-amber-100'}`}
                                                        title={isAdmin ? 'Emitir Factura C' : 'Solicitar Factura'}
                                                    >
                                                        {requestingInvoiceId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                                    </button>
                                                );
                                            }

                                            return <>{renderNodes}</>;
                                        })()}
                                        {/* WhatsApp notify */}
                                        {order.client?.phone && (order.labStatus === 'READY' || financials.hasBalance) && (
                                            <button
                                                onClick={async () => {
                                                    let msg = `*Hola ${order.client?.name || ''}*\n\n`;
                                                    msg += `Te avisamos que *tu pedido ya está listo para retirar* en *Atelier Óptica*\n\n`;
                                                    if (financials.hasBalance) {
                                                        msg += `*Detalle del saldo:*\n`;
                                                        msg += `• *Saldo con TARJETA / CUOTAS: $${financials.remainingCard.toLocaleString()}*\n`;
                                                        msg += `• *Saldo con TRANSFERENCIA: $${financials.remainingTransfer.toLocaleString()}*\n`;
                                                        msg += `• *Saldo si pagás en EFECTIVO: $${financials.remainingCash.toLocaleString()}*\n`;
                                                        msg += `\nPodés abonar con cualquier medio de pago.\n`;
                                                        msg += `*¿Nos podrías avisar cómo quisieras abonar el saldo?*\n\n`;
                                                    } else {
                                                        msg += `Tu pedido está *completamente pago*.\n\n`;
                                                    }
                                                    msg += `*Dirección:* José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
                                                    msg += `*Ubicación:* https://share.google/j2ZT7ReboDLt7onCp\n`;
                                                    msg += `*Horarios:*\n   • Lunes a viernes de 9:00 a 13:30 y de 16:00 a 19:30\n   • Sábados de 10:00 a 14:00 hs\n\n`;
                                                    msg += `¡Te esperamos! Muchas gracias.\n`;
                                                    msg += `\n_La óptica mejor calificada en Google Business 5/5_`;
                                                    const phone = (order.client?.phone || '').replace(/\D/g, '');
                                                    if (!phone) {
                                                        alert('⚠️ El cliente no tiene teléfono registrado.');
                                                        return;
                                                    }
                                                    try {
                                                        const res = await fetch('/api/whatsapp/send', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ chatId: `${phone}@c.us`, message: msg })
                                                        });
                                                        if (res.ok) {
                                                            alert('✅ Mensaje enviado por WhatsApp al cliente.');
                                                        } else {
                                                            alert('❌ Error al enviar el WhatsApp.');
                                                        }
                                                    } catch {
                                                        alert('❌ Error: verificá que el servidor WhatsApp esté corriendo.');
                                                    }
                                                }}
                                                className={`p-3 rounded-xl hover:scale-110 transition-all ${order.labStatus === 'READY' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse hover:animate-none' : 'bg-emerald-50 text-emerald-600'}`}
                                                title={order.labStatus === 'READY' ? 'Avisar que está listo para retirar' : 'Avisar saldo pendiente'}
                                            >
                                                <WhatsAppIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        {/* === ENVIAR A SMARTLAB — BOTÓN PRINCIPAL === */}
                                        {isGrupoOptico && (
                                            <button
                                                onClick={() => autoSubmitSmartLab(order)}
                                                disabled={isAutoSubmitting}
                                                className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-400/30 disabled:opacity-50"
                                                title="Copiar datos y abrir SmartLab"
                                            >
                                                {isAutoSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                                                {isAutoSubmitting ? 'Copiando...' : '🧪 SmartLab'}
                                            </button>
                                        )}
                                        {/* SmartLab detail toggle */}
                                        {isGrupoOptico && (
                                            <button
                                                onClick={() => setExpandedDetail(expandedDetail === order.id ? null : order.id)}
                                                className={`p-3 rounded-xl hover:scale-110 transition-all ${expandedDetail === order.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'}`}
                                                title="Ver detalle para SmartLab"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => downloadLabSheet(order)}
                                            className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:scale-110 transition-all"
                                            title="Descargar hoja de pedido lab"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        {isAdmin ? (
                                            <button
                                                onClick={() => handleDeleteRequest(order.id)}
                                                className="p-3 bg-red-50 text-red-500 rounded-xl hover:scale-110 transition-all"
                                                title="Eliminar venta"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleDeleteRequest(order.id)}
                                                className="p-3 bg-amber-50 text-amber-500 rounded-xl hover:scale-110 transition-all"
                                                title="Solicitar eliminación"
                                            >
                                                <AlertTriangle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ====== Expandable SmartLab Detail Panel ====== */}
                                {expandedDetail === order.id && (
                                    <OrderDetailPanel 
                                        order={order as any} 
                                        context="ventas"
                                        onAutoSubmit={autoSubmitSmartLab}
                                        isAutoSubmitting={isAutoSubmitting}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Pagination Controls */}
            {!loading && !error && orders.length > 0 && (
                <div className="mt-8 flex flex-col items-center gap-4">
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                        Mostrando {filteredOrders.length} de {totalOrders} ventas
                    </p>
                    {!allLoaded && (
                        <div className="flex gap-3">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="px-6 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                Cargar más
                            </button>
                            <button
                                onClick={loadAll}
                                disabled={loadingMore}
                                className="px-6 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all border-2 border-stone-200 dark:border-stone-700 disabled:opacity-50"
                            >
                                Cargar todas
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Invoice Modal */}
            {invoiceOrder && (
                <InvoiceModal
                    order={invoiceOrder}
                    initialAmount={(invoiceOrder as any).customAmount}
                    onClose={() => setInvoiceOrder(null)}
                    onSuccess={() => fetchOrders()}
                />
            )}
        </main>
    );
}
