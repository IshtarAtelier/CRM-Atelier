import re

file_path = "/Users/ishtarpissano/proyectos/atelier/src/app/blog/[slug]/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Replace bg-stone-50 with bg-[#faf8f5]
content = re.sub(r'bg-stone-50', 'bg-[#faf8f5]', content)
# Replace bg-white with bg-[#faf8f5] except inside components that really need white (actually, let's keep it safe)
# Let's replace the header bg
content = re.sub(r'bg-white dark:bg-stone-900 border-b border-stone-200', 'bg-[#faf8f5] border-b border-black/5', content)
content = re.sub(r'dark:border-stone-800', '', content)
content = re.sub(r'dark:bg-stone-900', '', content)
content = re.sub(r'dark:text-white', '', content)
content = re.sub(r'dark:text-stone-100', '', content)
content = re.sub(r'dark:text-stone-400', '', content)

# Change prose to look more elegant
content = re.sub(r'prose-headings:font-black', 'prose-headings:font-medium tracking-tight', content)
content = re.sub(r'font-black', 'font-medium tracking-tight', content)

# Typography colors
content = re.sub(r'text-stone-900', 'text-[#111]', content)
content = re.sub(r'text-stone-800', 'text-[#222]', content)
content = re.sub(r'text-stone-600', 'text-[#444]', content)
content = re.sub(r'text-stone-500', 'text-[#555]', content)
content = re.sub(r'text-stone-400', 'text-[#777]', content)

# Borders
content = re.sub(r'border-stone-200', 'border-black/5', content)
content = re.sub(r'border-stone-100', 'border-black/5', content)

# CTA Background
content = re.sub(r'bg-primary', 'bg-[#111]', content)
content = re.sub(r'text-primary', 'text-[#111]', content)
content = re.sub(r'hover:bg-primary/90', 'hover:bg-black', content)
content = re.sub(r'hover:text-primary', 'hover:text-[#444]', content)
content = re.sub(r'hover:border-primary/30', 'hover:border-black/30', content)
content = re.sub(r'bg-primary/10', 'bg-black/5', content)

# Remove any double font-medium tracking-tight
content = content.replace('font-medium tracking-tight tracking-tight', 'font-medium tracking-tight')

with open(file_path, "w") as f:
    f.write(content)
print("Updated [slug]/page.tsx")
