#!/bin/bash
# Find all .tsx files and replace <img with <Image and add next/image import if needed
for file in $(find src/app src/components -type f -name "*.tsx"); do
  if grep -q "<img" "$file"; then
    echo "Fixing images in $file"
    # Replace <img with <Image
    sed -i '' 's/<img /<Image /g' "$file"
    sed -i '' 's/<\/img>/<\/Image>/g' "$file"
    
    # Check if next/image is imported
    if ! grep -q "import Image from ['\"]next/image['\"]" "$file"; then
      # Add import after the last import or at the top
      awk '/^import / {last_import=NR} {lines[NR]=$0} END {for(i=1;i<=NR;i++) {if(i==last_import) {print lines[i]; print "import Image from \"next/image\";"} else {print lines[i]}}}' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
  fi
done
