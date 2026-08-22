-- Hace IMPOSIBLE que existan dos conversaciones uno-a-uno entre las mismas dos
-- personas.
--
-- Antes la invariante dependía de que un `findFirst` viera el hilo que otra
-- petición estaba creando en ese mismo instante: si A y B se escribían por
-- primera vez a la vez, nacían dos hilos y a partir de ahí la mitad de los
-- mensajes quedaba en el que el otro no estaba mirando. Eso no se arregla con
-- timing, se arregla con un constraint.
--
-- SOLO agrega: ni un DROP. (Escrita a mano; `prisma migrate diff` contra la
-- base local arrastra desfasaje que no pertenece a este cambio.)

ALTER TABLE "InternalThread" ADD COLUMN "directKey" TEXT;

-- Rellena los DIRECT que ya existan, con los dos ids de usuario ordenados.
--
-- EL PROBLEMA DEL HUEVO Y LA GALLINA: los hilos duplicados son exactamente el
-- bug que esta migración viene a impedir, así que pueden EXISTIR ya en la base.
-- Si dos hilos del mismo par recibieran la misma llave, el CREATE UNIQUE INDEX
-- de abajo fallaría y la migración quedaría aplicada a medias, con la columna
-- puesta y sin índice.
--
-- Por eso solo se rellena UN hilo por par: el de actividad más reciente, que es
-- el que la gente está mirando. Los duplicados viejos quedan con la llave en
-- NULL — siguen siendo legibles para quien participaba (nada se pierde), pero
-- dejan de ser candidatos a reuso, así que el próximo mensaje entre esas dos
-- personas va al hilo vivo.
--
-- El ORDER BY dentro del string_agg es lo que hace la llave determinística: sin
-- él, A:B y B:A serían llaves distintas y el constraint no serviría de nada.
WITH pares AS (
    SELECT p."threadId" AS tid,
           string_agg(p."userId", ':' ORDER BY p."userId") AS k
    FROM "InternalThreadParticipant" p
    WHERE p."leftAt" IS NULL
    GROUP BY p."threadId"
    HAVING COUNT(*) = 2
),
elegidos AS (
    SELECT DISTINCT ON (pares.k) pares.tid, pares.k
    FROM pares
    JOIN "InternalThread" t ON t.id = pares.tid
    WHERE t.kind = 'DIRECT'
    ORDER BY pares.k, t."lastMessageAt" DESC, t.id
)
UPDATE "InternalThread" t
SET "directKey" = e.k
FROM elegidos e
WHERE t.id = e.tid;

-- NULL no cuenta para la unicidad en Postgres, así que los duplicados viejos y
-- los grupos conviven sin chocar.
CREATE UNIQUE INDEX "InternalThread_directKey_key" ON "InternalThread"("directKey");
