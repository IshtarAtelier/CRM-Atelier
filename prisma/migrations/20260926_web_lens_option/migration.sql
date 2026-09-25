-- Opciones de cristal del configurador "Arma tus lentes": cada una apunta a UN
-- producto del sistema por id. Reemplaza el matching por palabras clave de
-- src/lib/config/crystal-mapping.ts y sus números de respaldo (ver
-- docs/cristales-web.md).
--
-- Escrita a MANO, solo AGREGA y es idempotente: corre en cada arranque de las
-- dos instancias de Railway (migrate deploy) y el deploy viejo sigue andando
-- durante el rollout porque no toca ninguna tabla existente.

CREATE TABLE IF NOT EXISTS "WebLensOption" (
    "clave"       TEXT NOT NULL,
    "grupo"       TEXT NOT NULL,
    "codigo"      TEXT NOT NULL,
    "etiqueta"    TEXT NOT NULL,
    "descripcion" TEXT,
    "badge"       TEXT,
    "destacados"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "orden"       INTEGER NOT NULL DEFAULT 0,
    "activa"      BOOLEAN NOT NULL DEFAULT true,
    "productId"   TEXT,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy"   TEXT,
    CONSTRAINT "WebLensOption_pkey" PRIMARY KEY ("clave")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebLensOption_productId_fkey') THEN
        ALTER TABLE "WebLensOption"
            ADD CONSTRAINT "WebLensOption_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WebLensOption_productId_idx" ON "WebLensOption"("productId");

-- Las opciones que ya mostraba el configurador, con sus mismas claves (son las
-- que viajan en los carritos guardados en los navegadores) y sus textos.
INSERT INTO "WebLensOption" ("clave", "grupo", "codigo", "etiqueta", "descripcion", "badge", "destacados", "orden") VALUES
    ('MONOFOCAL.ORGANICO_BLANCO',       'MONOFOCAL',  'ORGANICO_BLANCO',        'Básico (Sin Protección)',     NULL, NULL, ARRAY['Visión estándar','Sin Antirreflex','Grosor normal'], 10),
    ('MONOFOCAL.ORGANICO_AR',           'MONOFOCAL',  'ORGANICO_AR',            'Antirreflex (Evita Brillos)', NULL, NULL, ARRAY['Visión más nítida','Sin reflejos molestos','Mayor estética'], 20),
    ('MONOFOCAL.ORGANICO_BLUE',         'MONOFOCAL',  'ORGANICO_BLUE',          'Super Blue',                  NULL, 'MÁS ELEGIDO ⭐', ARRAY['Antirreflex Premium','Filtro luz azul (Pantallas)','20% más delgado'], 30),
    ('MONOFOCAL.POLI_BLUE',             'MONOFOCAL',  'POLI_BLUE',              'Extra Fino y Resistente',     NULL, 'PREMIUM 👑', ARRAY['Policarbonato irrompible','Filtro luz azul','Ultra liviano'], 40),
    ('MONOFOCAL.ORGANICO_FOTOCROMATICO','MONOFOCAL',  'ORGANICO_FOTOCROMATICO', 'Fotocromático',               NULL, NULL, ARRAY['Se oscurece al sol','Protección UV 100%','Uso interior/exterior'], 50),
    ('BIFOCAL.ORGANICO_BLANCO',         'BIFOCAL',    'ORGANICO_BLANCO',        'Bifocal Estándar',            'Cristal tradicional con línea divisoria.', NULL, ARRAY[]::TEXT[], 10),
    ('MULTIFOCAL.SMART_FREE',           'MULTIFOCAL', 'SMART_FREE',             'Diseño Digital ONE',          'Campo visual amplio y transición natural.', NULL, ARRAY[]::TEXT[], 10),
    ('MULTIFOCAL.VARILUX',              'MULTIFOCAL', 'VARILUX',                'Varilux Premium',             'La experiencia visual definitiva. Incluye 2x1 en cristales y armazones.', NULL, ARRAY[]::TEXT[], 20),
    ('MULTIFOCAL.FOTOCROMATICO',        'MULTIFOCAL', 'FOTOCROMATICO',          'Multi Fotocromático',         'Tecnología digital que se oscurece al sol.', NULL, ARRAY[]::TEXT[], 30),
    ('TENIDO.COMPACTO',                 'TENIDO',     'COMPACTO',               'Compacto',                    'Color uniforme en todo el lente.', NULL, ARRAY[]::TEXT[], 10),
    ('TENIDO.DEGRADE',                  'TENIDO',     'DEGRADE',                'Degradé',                     'Más oscuro arriba y claro abajo.', NULL, ARRAY[]::TEXT[], 20)
ON CONFLICT ("clave") DO NOTHING;

-- Vínculo inicial, por ÚNICA vez y solo sobre filas sin producto: el nombre
-- exacto de cada producto del catálogo de producción elegido el 26/9/2026.
-- Si un nombre no existe en la base donde corre, la fila queda sin producto,
-- la opción no se publica y /admin/web la muestra en rojo hasta vincularla.
-- Así el deploy no deja la tienda ni un minuto sin cristales.
UPDATE "WebLensOption" o SET "productId" = (
    SELECT p."id" FROM "Product" p
    WHERE p."name" = v.nombre AND p."category" = v.categoria AND p."price" > 0
    ORDER BY p."price" ASC LIMIT 1
)
FROM (VALUES
    ('MONOFOCAL.ORGANICO_BLANCO',        'Stock · Orgánico Blanco 1.49',                            'Cristal'),
    ('MONOFOCAL.ORGANICO_AR',            'Stock · Orgánico Blanco c/AR 1.56',                       'Cristal'),
    ('MONOFOCAL.ORGANICO_BLUE',          'Stock · Orgánico Blue c/AR 1.56',                         'Cristal'),
    ('MONOFOCAL.POLI_BLUE',              'Monofocal TALLADO (CNC) · Policarbonato Blue Light 1.59', 'Cristal'),
    ('MONOFOCAL.ORGANICO_FOTOCROMATICO', 'Stock · Orgánico Fotocromático c/AR Gris 1.56',           'Cristal'),
    ('BIFOCAL.ORGANICO_BLANCO',          'Bifocal Kriptock · Orgánico Blanco 1.49',                 'Cristal'),
    ('MULTIFOCAL.SMART_FREE',            'Multifocal Smart ONE · Orgánico Blanco 1.49',             'Cristal'),
    ('MULTIFOCAL.VARILUX',               'VARILUX COMFORT - ORMA + CRIZAL 2x1',                     'Cristal'),
    ('MULTIFOCAL.FOTOCROMATICO',         'Multifocal Smart ONE · Orgánico Fotocromático Grey 1.56', 'Cristal'),
    ('TENIDO.COMPACTO',                  'Teñido Compacto · Grupo Óptico',                          'Tratamiento'),
    ('TENIDO.DEGRADE',                   'Teñido Degradé · Grupo Óptico',                           'Tratamiento')
) AS v(clave, nombre, categoria)
WHERE o."clave" = v.clave AND o."productId" IS NULL;
