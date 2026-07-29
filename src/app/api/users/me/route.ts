import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const role = request.headers.get('x-user-role') || 'STAFF';
    const name = request.headers.get('x-user-name') || 'Usuario';
    const id = request.headers.get('x-user-id') || '';

    return NextResponse.json({
      id,
      name,
      role,
      isAdmin: role === 'ADMIN',
      isStaff: role === 'STAFF',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
