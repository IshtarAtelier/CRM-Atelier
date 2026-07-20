/**
 * Logging estructurado + captura de errores.
 *
 * Emite JSON a stdout (lo agrega Railway) con nivel y contexto, en vez de
 * console.log sueltos. `captureError` es el punto único para reportar
 * excepciones: hoy loguea estructurado; para agregar Sentry más adelante,
 * enchufar el SDK dentro de captureError (un solo lugar) — el resto del código
 * ya lo llama.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
type Context = Record<string, unknown>;

function emit(level: Level, message: string, context?: Context) {
  const entry: Record<string, unknown> = { level, message, ...(context || {}) };
  const line = safeStringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

export const log = {
  debug: (msg: string, ctx?: Context) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: Context) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Context) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Context) => emit('error', msg, ctx),
};

/**
 * Reporta una excepción con contexto. Único lugar para integrar un error-tracker.
 * No lanza: reportar nunca debe romper el flujo que lo llama.
 */
export function captureError(error: unknown, context?: Context): void {
  try {
    const err = error as any;
    emit('error', err?.message || String(error), {
      ...context,
      errorName: err?.name,
      stack: err?.stack,
    });
    // Para activar Sentry: instalar @sentry/nextjs y llamar aquí
    //   Sentry.captureException(error, { extra: context });
  } catch {
    /* noop */
  }
}
