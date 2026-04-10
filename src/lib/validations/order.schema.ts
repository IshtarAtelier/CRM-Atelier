import { z } from 'zod';

export const OrderItemSchema = z.object({
    productId: z.string().nullable().optional(),
    quantity: z.number().int().positive().default(1),
    price: z.number().nonnegative(),
    eye: z.string().nullable().optional(),
    sphereVal: z.number().nullable().optional(),
    cylinderVal: z.number().nullable().optional(),
    axisVal: z.number().int().nullable().optional(),
    additionVal: z.number().nullable().optional(),
    pdVal: z.number().nullable().optional(),
    heightVal: z.number().nullable().optional(),
    prismVal: z.string().nullable().optional(),
});

export const CreateOrderSchema = z.object({
    clientId: z.string(),
    items: z.array(OrderItemSchema).min(1),
    discount: z.number().optional().default(0),
    markup: z.number().optional().default(0),
    discountCash: z.number().optional().default(0),
    discountTransfer: z.number().optional().default(0),
    discountCard: z.number().optional().default(0),
    frameSource: z.string().nullable().optional(),
    userFrameBrand: z.string().nullable().optional(),
    userFrameModel: z.string().nullable().optional(),
    userFrameNotes: z.string().nullable().optional(),
    prescriptionId: z.string().nullable().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
