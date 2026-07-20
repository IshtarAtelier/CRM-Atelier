import { NextResponse } from 'next/server';
import { serverCache } from '@/lib/cache';

type ApiHandler = (req: Request, ...args: any[]) => Promise<NextResponse | Response> | NextResponse | Response;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: Request, ...args: any[]) => {
    try {
      const response = await handler(req, ...args);
      
      // If it's a successful mutation, clear the in-memory cache
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && response.ok) {
        serverCache.clear();
      }
      
      return response;
    } catch (error: any) {
      console.error(`[API Error] ${req.method} ${req.url}:`, error);
      
      const status = error.status || error.statusCode || 500;
      // No filtrar detalle interno (esquema/infra) al cliente: los 5xx inesperados
      // responden genérico; los 4xx deliberados (ApiError) conservan su mensaje.
      const message = status >= 500 ? 'Error interno del servidor' : (error.message || 'Error');

      return NextResponse.json({ error: message }, { status });
    }
  };
}
