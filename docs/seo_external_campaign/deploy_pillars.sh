#!/bin/bash

cd /Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/pbn_pillars || exit

for dir in varilux miopia lentes-sol presbicia luz-azul; do
    if [ -d "$dir" ]; then
        cd "$dir" || exit
        echo "Deploying Pillar Site: $dir"
        npx --yes vercel deploy --prod --yes > deploy.log 2>&1
        echo "Deployment for $dir finished."
        sleep 5
        cd ..
    fi
done

echo "Pillar Sites deployed successfully."
