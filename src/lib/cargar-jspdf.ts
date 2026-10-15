import type { jsPDF as JsPDF } from 'jspdf';

/**
 * El constructor de jsPDF, venga como venga el módulo.
 *
 * En el servidor (Node), `import('jspdf')` resuelve al build CommonJS y su
 * `default` es el objeto de exports, no la clase: `new (await
 * import('jspdf')).default()` tira "jsPDF is not a constructor". Los tres
 * respaldos de PDF (presupuesto, recibo y ficha del cliente) se escribieron
 * así, de modo que el respaldo —que solo corre cuando falla el navegador
 * headless— fallaba siempre, y el cliente se quedaba sin PDF (comprobado el
 * 10/10/2026). Los que importaban `{ jsPDF }` andaban.
 */
export async function cargarJsPDF(): Promise<typeof JsPDF> {
  const m: any = await import('jspdf');
  return (m.jsPDF ?? m.default?.jsPDF ?? m.default) as typeof JsPDF;
}
