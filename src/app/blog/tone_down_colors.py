import os
import re
import glob

blog_dir = "/Users/ishtarpissano/proyectos/atelier/src/app/blog"
pages = glob.glob(os.path.join(blog_dir, "*/page.tsx"))

for page in pages:
    with open(page, "r") as f:
        content = f.read()

    original_content = content

    # Replace colorful things with premium monochrome/neutral
    content = re.sub(r'text-indigo-\d+', 'text-[#111]', content)
    content = re.sub(r'bg-indigo-\d+', 'bg-[#faf8f5]', content)
    content = re.sub(r'border-indigo-\d+', 'border-black/10', content)
    
    content = re.sub(r'text-amber-\d+', 'text-[#111]', content)
    content = re.sub(r'bg-amber-\d+', 'bg-[#f5f5f5]', content)
    content = re.sub(r'border-amber-\d+', 'border-black/10', content)

    content = re.sub(r'text-blue-\d+', 'text-[#111]', content)
    content = re.sub(r'bg-blue-\d+', 'bg-[#faf8f5]', content)
    content = re.sub(r'border-blue-\d+', 'border-black/10', content)

    # Some specifics
    content = re.sub(r'bg-indigo-600', 'bg-[#111]', content)
    content = re.sub(r'hover:bg-indigo-700', 'hover:bg-black', content)

    # Improve fonts
    content = re.sub(r'text-neutral-800', 'text-[#111]', content)
    content = re.sub(r'bg-neutral-50', 'bg-[#faf8f5]', content)

    if content != original_content:
        with open(page, "w") as f:
            f.write(content)
        print(f"Toned down {os.path.basename(os.path.dirname(page))}/page.tsx")

