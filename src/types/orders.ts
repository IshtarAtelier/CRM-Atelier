// ── Tipos unificados para Órdenes, Items, Pagos y Prescripciones ──
// Fuente única de la verdad. Todas las páginas del CRM deben importar desde aquí.

export interface OrderItemProduct {
    id: string;
    name: string | null;
    price: number;
    brand: string | null;
    model: string | null;
    category: string;
    type: string | null;
    unitType?: string | null;
    lensIndex?: string | null;
    laboratory?: string | null;
}

export interface OrderItem {
    id: string;
    productId?: string;
    quantity: number;
    price: number;
    eye?: string | null;
    sphereVal?: number | null;
    cylinderVal?: number | null;
    axisVal?: number | null;
    additionVal?: number | null;
    pdVal?: number | null;
    heightVal?: number | null;
    prismVal?: string | null;
    productNameSnapshot?: string | null;
    productBrandSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    product: OrderItemProduct | null;
}

export interface OrderPrescription {
    id: string;
    sphereOD?: number | null;
    cylinderOD?: number | null;
    axisOD?: number | null;
    sphereOI?: number | null;
    cylinderOI?: number | null;
    axisOI?: number | null;
    addition?: number | null;
    additionOD?: number | null;
    additionOI?: number | null;
    pd?: number | null;
    distanceOD?: number | null;
    distanceOI?: number | null;
    heightOD?: number | null;
    heightOI?: number | null;
    notes?: string | null;
    imageUrl?: string | null;
    prescriptionType?: string | null;
    nearSphereOD?: number | null;
    nearSphereOI?: number | null;
    nearCylinderOD?: number | null;
    nearAxisOD?: number | null;
    nearCylinderOI?: number | null;
    nearAxisOI?: number | null;
    prismOD?: string | null;
    prismOI?: string | null;
}

export interface OrderPayment {
    id: string;
    amount: number;
    method: string;
    date: string;
    notes: string | null;
    receiptUrl?: string | null;
}

export interface OrderInvoice {
    id: string;
    cae: string;
    caeExpiration?: string;
    voucherNumber: number;
    pointOfSale: number;
    totalAmount?: number;
    status: string;
    billingAccount?: string;
    createdAt?: string;
}

export interface OrderClient {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    dni?: string | null;
    status?: string;
}

export interface Order {
    id: string;
    clientId: string;
    userId?: string;
    status: string;
    total: number;
    paid: number;
    discount?: number;
    orderType?: string;
    labStatus?: string;
    labSentAt?: string;
    labNotes?: string;
    labOrderNumber?: string;
    frameSource?: string | null;
    userFrameBrand?: string | null;
    userFrameModel?: string | null;
    userFrameNotes?: string | null;
    labFrameShape?: string | null;
    labFrameDetails?: string | null;
    frameA?: string | null;
    frameB?: string | null;
    frameDbl?: string | null;
    frameEdc?: string | null;
    frameA2?: string | null;
    frameB2?: string | null;
    frameDbl2?: string | null;
    frameEdc2?: string | null;
    labFrameShape2?: string | null;
    labFrameDetails2?: string | null;
    appliedPromoName?: string | null;
    createdAt: string;
    updatedAt: string;
    isDeleted?: boolean;
    deletedReason?: string | null;
    markup?: number;
    discountCash?: number;
    discountTransfer?: number;
    discountCard?: number;
    specialDiscount?: number;
    subtotalWithMarkup?: number;
    postSaleNotes?: string | null;
    postSaleCost?: number | null;
    postSaleResponsible?: string | null;
    postSaleOrderOption?: string | null;
    postSaleNewOrderNumber?: string | null;
    labColor?: string | null;
    labTreatment?: string | null;
    labDiameter?: string | null;
    labPdOd?: string | null;
    labPdOi?: string | null;
    labPrismOD?: string | null;
    labPrismOI?: string | null;
    labBaseCurve?: string | null;
    labFrameType?: string | null;
    labBevelPosition?: string | null;
    smartLabScreenshot?: string | null;
    smartLabSector?: string | null;
    smartLabProgress?: number | null;
    smartLabLastSync?: string | null;
    smartLabEntryDate?: string | null;
    smartLabDays?: number | null;
    smartLabDetails?: string | null;
    prescriptionId?: string | null;
    prescriptionSnapshot?: string | null;
    prescription?: OrderPrescription | null;
    client: OrderClient;
    user?: { name: string };
    items: OrderItem[];
    payments: OrderPayment[];
    invoices?: OrderInvoice[];
}

// ── Tipos para Productos ──

export interface Product {
    id: string;
    name: string | null;
    brand: string | null;
    model: string | null;
    type: string | null;
    category: string;
    price: number;
    cost?: number;
    stock: number;
    lensIndex?: string | null;
    unitType?: string | null;
    laboratory?: string | null;
    is2x1?: boolean;
    botLabel?: string | null;
    botRecommended?: boolean;
    sphereMin?: number | null;
    sphereMax?: number | null;
    cylinderMin?: number | null;
    cylinderMax?: number | null;
    additionMin?: number | null;
    additionMax?: number | null;
    imageProcessingStatus?: string | null;
    rawImageUrls?: string[];
    imagenesCatalogo?: string[];
    publishToWeb?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// ── Tipos para Movimientos de Caja ──

export interface CashMovement {
    id: string;
    type: 'IN' | 'OUT';
    amount: number;
    reason: string;
    category: string;
    laboratory?: string | null;
    createdAt: string;
    receiptUrl?: string | null;
    user?: { name: string };
}
