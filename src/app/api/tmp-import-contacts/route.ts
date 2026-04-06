import { NextResponse } from 'next/server';

// ⛔ Este endpoint de importación masiva ya fue utilizado y está DESACTIVADO.
// Los datos fueron importados correctamente. No debe volver a ejecutarse.
// Si necesita reimportar, crear un nuevo script en /scripts/ con autenticación de admin.
export async function GET() {
  return NextResponse.json(
    { error: 'Este endpoint está desactivado. La importación ya fue completada.' },
    { status: 410 } // 410 Gone — recurso desactivado permanentemente
  );
}
