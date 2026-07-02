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
      
      const status = error.status || 500;
      const message = error.message || 'Internal Server Error';
      
      return NextResponse.json({ error: message }, { status });
    }
  };
}
