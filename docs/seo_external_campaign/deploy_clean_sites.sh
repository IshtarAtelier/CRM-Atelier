#!/bin/bash

# Configuration
PROJECT_DIR="/Users/ishtarpissano/proyectos/atelier"
CLEAN_SITES_DIR="$PROJECT_DIR/docs/seo_external_campaign/pbn_clean_sites"
DEPLOY_DIR="$PROJECT_DIR/docs/seo_external_campaign/deploy_sites"

echo "=========================================================="
echo "Preparando directorios para despliegue AEO Cruzado..."
echo "=========================================================="

mkdir -p "$DEPLOY_DIR"

# List of domains to deploy as ACTIVE Q&A Landings
ACTIVE_DOMAINS=(
    "multifocalescordoba.com.ar"
    "lentesdecontactocba.com.ar"
    "lentesparacomputadora.com.ar"
    "anteojosdesolcba.com.ar"
    "anteojosonline.com.ar"
    "opticascordoba.com.ar"
)

# Function to check if domain is in active list
is_active() {
    local domain=$1
    for act in "${ACTIVE_DOMAINS[@]}"; do
        if [ "$act" = "$domain" ]; then
            return 0 # True
        fi
    done
    return 1 # False
}

# Mapping of redirect domains to Atelier main hub URLs
get_redirect_url() {
    local domain=$1
    case "$domain" in
        "variluxcordoba.com.ar")
            echo "https://www.atelieroptica.com.ar/cristales-opticos"
            ;;
        "variluxargentina.com.ar")
            echo "https://www.atelieroptica.com.ar/cristales-opticos"
            ;;
        "multifocalesargentina.com.ar")
            echo "https://www.atelieroptica.com.ar/cristales-opticos"
            ;;
        "multifocalesonline.com.ar")
            echo "https://www.atelieroptica.com.ar/cristales-opticos"
            ;;
        "lentesonlinecordoba.com.ar")
            echo "https://www.atelieroptica.com.ar/tienda"
            ;;
        "opticaencordoba.com.ar")
            echo "https://www.atelieroptica.com.ar/nuestro-local"
            ;;
        "lentesfotocromaticos.com.ar")
            echo "https://www.atelieroptica.com.ar/cristales-opticos"
            ;;
        "opticaaprosscba.com.ar")
            echo "https://www.atelieroptica.com.ar/obras-sociales"
            ;;
        *)
            echo "https://www.atelieroptica.com.ar"
            ;;
    esac
}

cd "$CLEAN_SITES_DIR" || exit

for file in *.html; do
    domain="${file%.html}"
    site_dir="$DEPLOY_DIR/$domain"
    mkdir -p "$site_dir"
    
    if is_active "$domain"; then
        echo "🟢 [ACTIVO] Preparando Landing Q&A para: $domain"
        # Copy the pre-generated rich HTML page
        cp "$file" "$site_dir/index.html"
    else
        redirect_url=$(get_redirect_url "$domain")
        echo "🔵 [REDIRECT] Creando redirección 301 de: $domain -> $redirect_url"
        
        # Write redirect HTML file for static hosting (Vercel/Cloudflare Pages)
        cat <<EOF > "$site_dir/index.html"
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redireccionando...</title>
  <meta http-equiv="refresh" content="0; url=$redirect_url">
  <link rel="canonical" href="$redirect_url">
  <script type="text/javascript">
    window.location.href = "$redirect_url";
  </script>
</head>
<body>
  <p>Si no eres redireccionado automáticamente, haz <a href="$redirect_url">clic aquí</a>.</p>
</body>
</html>
EOF
    fi
done

echo "=========================================================="
echo "Estructura AEO completada en:"
echo "$DEPLOY_DIR"
echo "Para desplegar un sitio, entra a su carpeta y ejecuta:"
echo "npx vercel deploy --prod"
echo "=========================================================="
