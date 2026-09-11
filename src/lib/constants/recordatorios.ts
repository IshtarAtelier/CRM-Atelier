/**
 * Recordatorios simples que aparecen al abrir el panel, una vez por día.
 *
 * A diferencia de NovedadesGuiadas (un anuncio puntual, obligatorio, que se
 * marca visto en el server) y de BriefingDiario (métricas reales de venta,
 * también obligatorio): esto es un cartel liviano, sin bloquear nada, que
 * se puede cerrar con un clic y vuelve a aparecer al día siguiente. Se
 * recuerda en el navegador (localStorage) — cambiar de máquina lo vuelve a
 * mostrar, que para un recordatorio de tarea diaria no es un problema.
 *
 * Agregar uno nuevo: una línea en este array. Sacarlo: `activo: false` o
 * borrar la línea.
 */
export interface Recordatorio {
  id: string;
  texto: string;
  activo: boolean;
}

export const RECORDATORIOS_DIARIOS: Recordatorio[] = [
  {
    id: "stories-ig-a-wsp-2026-09",
    texto: "Descargar las stories publicadas en Instagram y compartirlas en el Estado de WhatsApp.",
    activo: true,
  },
];
