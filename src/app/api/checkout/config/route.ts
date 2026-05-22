import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.PAYWAY_PUBLIC_KEY || '',
    environment: process.env.PAYWAY_ENVIRONMENT || 'sandbox'
  });
}
