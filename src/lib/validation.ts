import { z } from 'zod';

/**
 * Esquemas de validación (zod) para rutas públicas. Centralizados acá para poder
 * reutilizarlos y para ir cubriendo las rutas que hoy confían en el body crudo.
 */

const trimmed = (max: number) => z.string().trim().max(max);

export const webContactSchema = z.object({
  name: trimmed(120).min(1, 'Nombre requerido'),
  email: z.string().trim().email('Email inválido').max(160),
  phone: trimmed(40).optional().nullable(),
  subject: trimmed(160).optional().nullable(),
  message: trimmed(4000).min(1, 'Mensaje requerido'),
});
export type WebContactInput = z.infer<typeof webContactSchema>;

export const productReviewSchema = z.object({
  productId: trimmed(60).min(1, 'Producto requerido'),
  authorName: trimmed(80).min(2, 'Nombre requerido'),
  rating: z.coerce.number().int().min(1, 'Puntaje 1-5').max(5, 'Puntaje 1-5'),
  comment: trimmed(2000).min(3, 'Comentario muy corto'),
});
export type ProductReviewInput = z.infer<typeof productReviewSchema>;

/**
 * Valida un body con un esquema zod. Devuelve { data } o { error } con el detalle.
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { success: true, data: parsed.data };
  const first = parsed.error.issues[0];
  return { success: false, error: first ? first.message : 'Datos inválidos' };
}
