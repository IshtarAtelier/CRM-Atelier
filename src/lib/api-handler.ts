import { NextResponse } from 'next/server';

type ApiHandler = (req: Request, ...args: any[]) => Promise<NextResponse | Response> | NextResponse | Response;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: Request, ...args: any[]) => {
    try {
      return await handler(req, ...args);
    } catch (error: any) {
      console.error(`[API Error] ${req.method} ${req.url}:`, error);
      
      const status = error.status || 500;
      const message = error.message || 'Internal Server Error';
      
      return NextResponse.json({ error: message }, { status });
    }
  };
}
