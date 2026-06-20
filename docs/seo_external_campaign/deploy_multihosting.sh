#!/bin/bash

# Configuration
PROJECT_DIR="/Users/ishtarpissano/proyectos/atelier"
DEPLOY_DIR="$PROJECT_DIR/docs/seo_external_campaign/deploy_sites"

echo "=========================================================="
# Prepare directories (assuming deploy_clean_sites.sh was run)
echo "Verificando directorios de deploy_sites..."
echo "=========================================================="

# 1. VERCEL DEPLOYMENTS
echo "🚀 [VERCEL] Desplegando dominios asignados..."
VERCEL_DOMAINS=(
    "variluxargentina.com.ar"
    "opticascordoba.com.ar"
)
for dom in "${VERCEL_DOMAINS[@]}"; do
    if [ -d "$DEPLOY_DIR/$dom" ]; then
        echo " -> Desplegando $dom a Vercel..."
        cd "$DEPLOY_DIR/$dom" || exit
        # Run vercel deploy (will use global vercel credentials of the machine)
        npx --yes vercel deploy --prod --yes
    fi
done

# 2. NETLIFY DEPLOYMENTS
echo ""
echo "🚀 [NETLIFY] Instrucciones de despliegue para Netlify..."
NETLIFY_DOMAINS=(
    "multifocalescordoba.com.ar"
    "lentesdecontactocba.com.ar"
)
for dom in "${NETLIFY_DOMAINS[@]}"; do
    echo " -> Para desplegar $dom, podés subir la carpeta:"
    echo "    $DEPLOY_DIR/$dom"
    echo "    directamente arrastrándola a app.netlify.com, o ejecutando:"
    echo "    cd $DEPLOY_DIR/$dom && npx --yes netlify-cli deploy --prod"
done

# 3. CLOUDFLARE PAGES DEPLOYMENTS
echo ""
echo "🚀 [CLOUDFLARE PAGES] Instrucciones de despliegue para Cloudflare..."
CF_DOMAINS=(
    "lentesparacomputadora.com.ar"
    "anteojosdesolcba.com.ar"
    "anteojosonline.com.ar"
)
for dom in "${CF_DOMAINS[@]}"; do
    echo " -> Para desplegar $dom en Cloudflare Pages:"
    echo "    Creá un nuevo proyecto de Pages en tu panel de Cloudflare,"
    echo "    selecciona 'Direct Upload' y arrastrá la carpeta:"
    echo "    $DEPLOY_DIR/$dom"
done

echo "=========================================================="
echo "Proceso terminado."
echo "=========================================================="
