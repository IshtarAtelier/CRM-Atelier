#!/bin/bash

PBN_DIR="/Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/pbn"
cd "$PBN_DIR" || exit

for file in *.html; do
    if [ "$file" = "index.html" ]; then continue; fi
    
    basename="${file%.html}"
    url_name=$(echo "$basename" | sed 's/_/-/g')
    
    mkdir -p "$PBN_DIR/sites/$url_name"
    cp "$file" "$PBN_DIR/sites/$url_name/index.html"
    
    cd "$PBN_DIR/sites/$url_name" || exit
    echo "Deploying PBN Blog: $url_name"
    npx --yes vercel deploy --prod --yes > deploy.log 2>&1
    echo "Deployment finished for $url_name"
    sleep 5
    cd "$PBN_DIR" || exit
done

echo "All 20 rewritten blogs deployed successfully."
