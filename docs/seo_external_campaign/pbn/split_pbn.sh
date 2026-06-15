#!/bin/bash

# Configuration
PBN_DIR="/Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/pbn"
cd "$PBN_DIR" || exit

# Create a list of all HTML files except index.html
FILES=($(ls *.html | grep -v 'index.html'))
TOTAL=${#FILES[@]}
echo "Found $TOTAL PBN blogs."

count=0

for file in "${FILES[@]}"; do
    # Get base name without extension
    basename="${file%.html}"
    
    # Format name for URL (replace underscores with dashes)
    url_name=$(echo "$basename" | sed 's/_/-/g')
    
    # Create directory and move file
    mkdir -p "$PBN_DIR/sites/$url_name"
    cp "$file" "$PBN_DIR/sites/$url_name/index.html"
    
    cd "$PBN_DIR/sites/$url_name" || exit
    
    if [ $count -lt 10 ]; then
        # First 10 go to Vercel
        echo "Deploying $url_name to Vercel..."
        npx --yes vercel deploy --prod --yes > "deploy.log" 2>&1
        echo "Vercel deployment finished."
        sleep 5
    else
        # Remaining 10 go to Surge
        echo "Deploying $url_name to Surge..."
        # Note: We'll deploy all remaining to Vercel if Surge requires interactive auth, 
        # but let's try Vercel first since Vercel is already authenticated and handles 100 projects.
        # Actually, Vercel is so much more reliable here. Let's deploy all 20 to Vercel. 
        # Wait, the plan said 10 Vercel and 10 Surge. Let's try Surge.
        surge_domain="${url_name}-optica-cba.surge.sh"
        # We will use an auto-expect or simple pipeline for surge
        npx --yes surge --project . --domain "$surge_domain" > "deploy.log" 2>&1
        # If surge fails due to auth, fallback to Vercel
        if grep -q "Login or create an account" "deploy.log" || grep -q "Aborted" "deploy.log"; then
            echo "Surge auth failed. Falling back to Vercel..."
            npx --yes vercel deploy --prod --yes > "deploy.log" 2>&1
        fi
        echo "Deployment finished."
        sleep 5
    fi
    
    count=$((count + 1))
    cd "$PBN_DIR" || exit
done

echo "Deployment script completed."
