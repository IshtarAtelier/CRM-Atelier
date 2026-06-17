#!/bin/bash
fix_dupe() {
  local comp=$1
  local dom=$2
  if [ -f "src/components/$comp.tsx" ]; then
    echo "Moving $comp to $dom"
    mv "src/components/$comp.tsx" "src/components/$dom/$comp.tsx"
    find src/app src/components src/lib -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s|@/components/$comp|@/components/$dom/$comp|g" {} +
  fi
}

fix_dupe "QuickQuote" "quotes"
fix_dupe "ContactForm" "contacts"
fix_dupe "CommandPalette" "ui"
