#!/usr/bin/env bash
# Vuelca de PRODUCCIÓN, SOLO CON SELECT, lo que el banco necesita para cotizar
# como en prod: catálogo (Product + WebProduct), SystemSetting web_* /
# MANUFACTURING_TIMES y etiquetas con regla automática. Nada de clientes ni chats.
#   bash armar-fixtures.sh <dir-fuera-del-repo>
set -euo pipefail
DIR="${1:?Uso: armar-fixtures.sh <dir>}"
mkdir -p "$DIR"
ENVF="$(cd "$(dirname "$0")/../../../.." && pwd)/.env"
[ -f "$ENVF" ] || ENVF="$HOME/proyectos/atelier/.env"
P=$(grep '^PROD_DATABASE_URL' "$ENVF" | head -1 | sed 's/^PROD_DATABASE_URL=//; s/^"//; s/"$//')
q() { docker exec atelier-postgres psql "$P" -Atq -v ON_ERROR_STOP=1 -c "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY" -c "$1"; }
q "select coalesce(json_agg(t),'[]') from (select p.id,p.name,p.brand,p.model,p.type,p.category,p.price,p.\"salePrice\",p.\"lensIndex\",p.\"is2x1\",p.\"botRecommended\",p.\"botLabel\",p.laboratory,p.\"publishToWeb\",p.gender,p.stock,p.\"rawImageUrls\",(select coalesce(json_agg(json_build_object('slug',w.slug,'imageUrl',w.\"imageUrl\",'isActive',w.\"isActive\",'category',w.category)),'[]') from \"WebProduct\" w where w.\"productId\"=p.id) as \"webProducts\" from \"Product\" p) t" > "$DIR/productos.json"
q "select coalesce(json_agg(t),'[]') from (select key, value from \"SystemSetting\" where key like 'web_%' or key in ('bot_daily_context','MANUFACTURING_TIMES')) t" > "$DIR/settings.json"
q "select coalesce(json_agg(t),'[]') from (select id,name,\"autoAssignCondition\" from \"Tag\" where coalesce(\"autoAssignCondition\",'')<>'') t" > "$DIR/tags.json"
echo "Fixtures en $DIR: $(wc -c < "$DIR/productos.json") bytes de catálogo."
