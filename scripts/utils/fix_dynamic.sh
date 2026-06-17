#!/bin/bash
file="src/components/Storefront/CustomGlassesBuilder.tsx"
sed -i '' 's/import { Interactive3DImage } from ".\/Interactive3DImage";/import dynamic from "next\/dynamic";\nconst Interactive3DImage = dynamic(() => import(".\/Interactive3DImage").then(mod => mod.Interactive3DImage), { ssr: false });/g' "$file"
