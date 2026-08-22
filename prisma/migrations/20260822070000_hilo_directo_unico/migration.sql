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
-- El ORDER BY dentro del string_agg es lo que hace la llave determinística:
-- sin él, A:B y B:A serían llaves distintas y el constraint no serviría.
UPDATE "InternalThread" t SET "directKey" = sub.k
FROM (
  SELECT p."threadId" AS tid,
         string_agg(p."userId", ':' ORDER BY p."userId") AS k
  FROM "InternalThreadParticipant" p
  WHERE p."leftAt" IS NULL
  GROUP BY p."threadId"
  HAVING COUNT(*) = 2
) sub
WHERE t.id = sub.tid AND t.kind = 'DIRECT';

CREATE UNIQUE INDEX "InternalThread_directKey_key" ON "InternalThread"("directKey");
