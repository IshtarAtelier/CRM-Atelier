import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  PROD_DATABASE_URL: z.string().url().optional(),

  // Authentication
  JWT_SECRET: z.string().min(10),
  BOT_API_KEY: z.string().min(1).optional(),
  
  // Cron
  CRON_SECRET: z.string().min(1).optional(),

  // Email
  EMAIL_USER: z.string().email().optional(),
  EMAIL_PASS: z.string().min(1).optional(),
  ADMIN_EMAIL: z.string().email().optional(),

  // Google / AI
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default('us-central1'),
  GOOGLE_VERTEX_AI_WEB_CREDENTIALS: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  // Payment
  PAYWAY_SITE_ID: z.string().optional(),
  PAYWAY_PUBLIC_KEY: z.string().optional(),
  PAYWAY_PRIVATE_KEY: z.string().optional(),
  PAYWAY_ENVIRONMENT: z.enum(['development', 'production']).default('development'),

  // WhatsApp
  META_ACCESS_TOKEN: z.string().optional(),
  WA_SERVER_URL: z.string().url().default('http://127.0.0.1:3100'),
  WA_API_KEY: z.string().optional(),

  // Others
  CORS_ORIGINS: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  
  // Public
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_WHATSAPP_PHONE: z.string().optional(),
  NEXT_PUBLIC_WA_URL: z.string().url().optional(),
});

// En Next.js (entorno servidor), verificamos todo.
// En el entorno cliente (browser), Next.js solo expone las variables NEXT_PUBLIC_
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    PROD_DATABASE_URL: process.env.PROD_DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    BOT_API_KEY: process.env.BOT_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
    GOOGLE_VERTEX_AI_WEB_CREDENTIALS: process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    PAYWAY_SITE_ID: process.env.PAYWAY_SITE_ID,
    PAYWAY_PUBLIC_KEY: process.env.PAYWAY_PUBLIC_KEY,
    PAYWAY_PRIVATE_KEY: process.env.PAYWAY_PRIVATE_KEY,
    PAYWAY_ENVIRONMENT: process.env.PAYWAY_ENVIRONMENT,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    WA_SERVER_URL: process.env.WA_SERVER_URL,
    WA_API_KEY: process.env.WA_API_KEY,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_WHATSAPP_PHONE: process.env.NEXT_PUBLIC_WHATSAPP_PHONE,
    NEXT_PUBLIC_WA_URL: process.env.NEXT_PUBLIC_WA_URL,
  });
} catch (error: any) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:', error.issues);
  }
  // En Next.js build, fallar ruidosamente si faltan variables críticas (evitando fallar en cliente)
  if (typeof window === 'undefined') {
      throw new Error('Invalid environment variables. See console above.');
  } else {
      // Dummy inicialización para el cliente para evitar crashear
      env = {} as any;
  }
}

export { env };
