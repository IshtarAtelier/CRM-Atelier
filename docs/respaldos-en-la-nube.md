# Respaldos fuera de la Mac: qué usar y cómo

Hoy (24/9/2026) el proyecto tiene tres copias de seguridad, y las tres viven
en el mismo lugar: la Mac de Ishtar (`~/respaldos-crm-atelier/`). Si la Mac se
rompe, se pierde o se la roban, se pierden las tres. Lo único que ya está afuera
es el **código** (GitHub, `IshtarAtelier/CRM-Atelier`). La **base de datos** y
los **secretos** (`.env`) no tienen ninguna copia fuera de Railway y la Mac.

## Qué hay que proteger, y de qué tamaño es

| Qué | Tamaño | Dónde vive hoy | Riesgo si se pierde |
|---|---|---|---|
| Base de producción (clientes, ventas, pagos, WhatsApp) | 12 MB comprimida | Railway (Singapur) + dump en la Mac | **El negocio.** Railway no promete backups del plan actual |
| `.env` del proyecto y del `wa-service` | 15 KB | La Mac | Sin esto no se puede levantar el sitio en otro lado: Payway, Meta, Google, AFIP, JWT |
| Historial de git | 1,07 GB (bundle) | GitHub + la Mac | Bajo: GitHub ya es una copia |
| El proyecto en disco (`storage/` con confirmaciones, `social/`, fotos) | 3,2 GB | La Mac | Medio: las confirmaciones de clientes y las piezas de redes no están en git |

## Recomendación: Backblaze B2 + `rclone`, y un cron de GitHub para la base

**Por qué B2 y no otra cosa:**
- Cuesta **USD 6 por TB al mes** y los primeros 10 GB son gratis. Todo lo de
  arriba entra en 10 GB: la cuenta sale **$0** hasta que crezca mucho.
- Tiene **Object Lock** (los archivos quedan inmutables un tiempo fijo): si un
  ransomware o un `rm` equivocado borra la Mac, los respaldos en B2 no se pueden
  borrar ni pisar hasta que venza el plazo. Cloudflare R2 (que sería lo natural
  porque el DNS ya está en Cloudflare) no lo tiene; iCloud Drive tampoco, y
  además **sincroniza los borrados**: si se borra en la Mac, se borra en iCloud.
- `rclone` es una herramienta de línea de comandos gratis que copia carpetas a
  B2 (y a 70 nubes más) con cifrado opcional y sin instalar nada raro.

**Descartados:** Google Drive / iCloud (sincronizan borrados, sin inmutabilidad),
un segundo Railway (mismo proveedor, misma región), un disco externo (mismo
lugar físico que la Mac).

## Cómo quedaría (tres piezas)

### 1. La base, todos los días, automática (GitHub Actions → B2)

Un workflow en `.github/workflows/respaldo-base.yml` que corre a las 04:00
Argentina, hace `pg_dump` de `PROD_DATABASE_URL`, lo cifra con `age` (clave
pública en el repo, privada en la Mac y en un gestor de claves) y lo sube a B2
con `rclone`. Guarda 30 diarios + 12 mensuales. Los secretos (`PROD_DATABASE_URL`,
`B2_KEY_ID`, `B2_APP_KEY`) van en *Settings → Secrets* del repo, nunca en el
YAML. Un `pg_dump` de 12 MB tarda menos de un minuto: el Action es gratis.

### 2. La Mac, todas las semanas (`rclone` + `launchd`)

`rclone sync ~/respaldos-crm-atelier b2:crm-atelier-respaldos/mac --backup-dir
...` desde un `launchd` los domingos a la noche. Sube solo lo nuevo (el bundle
de 1 GB se sube una vez). La carpeta `secretos/` va cifrada con `rclone crypt`.

### 3. Los secretos, hoy mismo, a mano

Mientras no exista lo de arriba: copiar `~/respaldos-crm-atelier/2026-09-24/secretos/`
a un **gestor de contraseñas** (1Password, Bitwarden — los dos guardan archivos
adjuntos) como "Atelier — .env producción 2026-09-24". Es lo que más duele
perder y lo que menos pesa.

## Qué hace falta de Ishtar para arrancar

1. Crear la cuenta en backblaze.com (gratis) y un bucket `crm-atelier-respaldos`
   con **Object Lock** de 30 días. Me pasa el *Key ID* y la *Application Key*
   (o los carga ella en GitHub Secrets — mejor).
2. Decidir dónde guardar la clave privada de `age` (recomiendo el gestor de
   contraseñas). Sin esa clave, los respaldos cifrados no se abren nunca más.
3. Con eso, armo el workflow y el `launchd` en una sesión, y la primera
   restauración de prueba en un Postgres de docker para verificar que el respaldo
   sirve (un respaldo sin restaurar es una suposición).

## Lo que NO cambia

Los respaldos locales siguen en `~/respaldos-crm-atelier/` con su `LEEME.md`
(una carpeta por fecha, nombre del proyecto y fecha en cada archivo, verificados
con `git bundle verify` / `gzip -t` / `pg_restore -l`). La nube es la copia de
la copia, no el reemplazo.
