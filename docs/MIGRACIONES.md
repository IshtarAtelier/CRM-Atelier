# 🗄️ Guía de Migraciones de Base de Datos

## ¿Qué son las migraciones?

Las migraciones son archivos SQL que registran cada cambio que hacés en la base de datos (crear tablas, agregar columnas, etc.). Es como el "historial de commits" pero para la estructura de tu base de datos.

## Comandos disponibles

### Desarrollo (tu máquina)

```bash
# Crear una nueva migración después de modificar schema.prisma
npm run db:migrate

# Ver el estado de las migraciones
npx prisma migrate status

# Resetear la base de datos (BORRA TODOS LOS DATOS)
npm run db:reset

# Abrir Prisma Studio (explorador visual de la DB)
npm run db:studio

# Hacer backup manual
npm run db:backup
```

### Producción (servidor)

```bash
# Aplicar migraciones pendientes SIN crear nuevas
npm run db:deploy
```

## Flujo de trabajo paso a paso

### Cuando necesitás cambiar la base de datos:

1. **Editá** `prisma/schema.prisma` (agregar campo, tabla, etc.)
2. **Ejecutá** `npm run db:migrate` — esto crea el archivo SQL y lo aplica
3. **Commiteá** el archivo de migración junto con tu código
4. **En producción**, ejecutá `npm run db:deploy` para aplicar los cambios

### Ejemplo: agregar un campo "nickname" al modelo Client

```prisma
model Client {
  // ... campos existentes
  nickname String?  // ← Agregar esto
}
```

```bash
npm run db:migrate
# Te pide un nombre → escribí "agregar_nickname_client"
# Se crea: prisma/migrations/20260311_agregar_nickname_client/migration.sql
```

## ¿Qué hacer si algo sale mal?

### La migración falló

1. Revisá el error en la terminal
2. Corregí el `schema.prisma`
3. Volvé a correr `npm run db:migrate`

### Necesito volver a una versión anterior

1. Restaurá desde un backup: `copy backups\dev_FECHA.db prisma\dev.db`
2. Ajustá el schema al estado anterior
3. Ejecutá `npx prisma migrate resolve --rolled-back NOMBRE_MIGRACION`

## Estructura de archivos

```
prisma/
  schema.prisma          ← Definición del esquema actual
  dev.db                 ← Base de datos SQLite (NO va al repo)
  migrations/            ← Historial de cambios (SÍ va al repo)
    20260311_init/
      migration.sql      ← SQL de la migración inicial
    20260312_agregar_xyz/
      migration.sql      ← SQL del siguiente cambio

backups/                 ← Copias de seguridad (NO va al repo)
  dev_2026-03-11_12-00-00.db

scripts/
  backup-db.js           ← Script de backup automático
```

## Reglas de oro

1. **NUNCA** modifiques la DB directamente con SQL en producción
2. **SIEMPRE** hacé backup antes de migrar en producción
3. **SIEMPRE** probá la migración en desarrollo primero
4. **SIEMPRE** commiteá los archivos de migración con tu código
5. Para **agregar** columnas/tablas: es seguro y directo
6. Para **renombrar o eliminar**: primero agregá lo nuevo, migrá datos, después borrá lo viejo
