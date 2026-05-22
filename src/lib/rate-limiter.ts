type RateLimitEntry = {
  count: number;
  resetTime: number;
};

// Mapa en memoria para rate limiting
const rateLimits = new Map<string, RateLimitEntry>();

export interface RateLimiterOptions {
  limit: number; // Max requests
  windowMs: number; // Time window in milliseconds
}

export function checkRateLimit(
  identifier: string,
  options: RateLimiterOptions = { limit: 10, windowMs: 60000 }
): { success: boolean; limit: number; remaining: number; reset: Date } {
  const now = Date.now();
  const entry = rateLimits.get(identifier);

  if (!entry || now > entry.resetTime) {
    // Primera petición o ventana expirada
    rateLimits.set(identifier, { count: 1, resetTime: now + options.windowMs });
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      reset: new Date(now + options.windowMs),
    };
  }

  if (entry.count >= options.limit) {
    // Límite excedido
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      reset: new Date(entry.resetTime),
    };
  }

  // Incrementar contador
  entry.count += 1;
  return {
    success: true,
    limit: options.limit,
    remaining: options.limit - entry.count,
    reset: new Date(entry.resetTime),
  };
}

// Opcional: Función para limpiar el mapa cada hora y evitar memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetTime) {
      rateLimits.delete(key);
    }
  }
}, 3600000);
