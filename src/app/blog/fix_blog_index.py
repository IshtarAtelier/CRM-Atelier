import re

file_path = "/Users/ishtarpissano/proyectos/atelier/src/app/blog/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

content = re.sub(r'text-\[#283f5a\]', 'text-[#111]', content)
content = re.sub(r'bg-\[#283f5a\]', 'bg-[#111]', content)
content = re.sub(r'shadow-sm', 'shadow-[0_2px_10px_rgba(0,0,0,0.02)]', content)
content = re.sub(r'font-bold', 'font-medium tracking-tight', content)

with open(file_path, "w") as f:
    f.write(content)

print("Fixed blog/page.tsx")
