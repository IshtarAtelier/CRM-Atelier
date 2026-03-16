export type ContactStatus = 'ALL' | 'CONTACT' | 'CONFIRMED' | 'CLIENT';

export interface Tag {
    name: string;
    color: string | null;
}

export interface Interaction {
    id: string;
    type: string;
    content: string;
    createdAt: string;
}

export interface Prescription {
    id: string;
    sphereOD?: number | null;
    cylinderOD?: number | null;
    axisOD?: number | null;
    sphereOI?: number | null;
    cylinderOI?: number | null;
    axisOI?: number | null;
    addition?: number | null;
    pd?: number | null;
    imageUrl?: string | null;
    notes?: string | null;
    date: string;
}

export interface OrderItem {
    id: string;
    quantity: number;
    price: number;
    product: {
        brand: string | null;
        model: string | null;
        type: string | null;
    };
}

export interface Payment {
    id: string;
    amount: number;
    method: string;
    date: string;
    notes: string | null;
}

export interface Order {
    id: string;
    status: string;
    total: number;
    paid: number;
    isDeleted?: boolean;
    deletedReason?: string | null;
    createdAt: string;
    items: OrderItem[];
    payments?: Payment[];
}

export interface Contact {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    dni: string | null;
    status: string;
    contactSource: string | null;
    interest: string | null;
    expectedValue: number | null;
    avgTicket?: number;
    priority: number;
    isFavorite: boolean;
    address: string | null;
    insurance: string | null;
    doctor: string | null;
    tags: Tag[];
    interactions?: Interaction[];
    prescriptions?: Prescription[];
    orders?: Order[];
    tasks?: any[];
    createdAt: string;
}

export interface ContactFormData {
    name: string;
    phone: string;
    email?: string;
    dni?: string;
    interest?: string;
    expectedValue?: number;
    priority?: number;
    status?: string;
    contactSource?: string;
    address?: string;
    insurance?: string;
    doctor?: string;
    followUpTask?: string;
    followUpDate?: string;
}
