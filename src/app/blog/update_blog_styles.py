import os
import re
import glob

blog_dir = "/Users/ishtarpissano/proyectos/atelier/src/app/blog"
pages = glob.glob(os.path.join(blog_dir, "*/page.tsx"))

for page in pages:
    with open(page, "r") as f:
        content = f.read()

    original_content = content

    # Standardize the main wrapper background
    content = re.sub(r'bg-white(?=.*text-black)', 'bg-[#faf8f5]', content)
    content = re.sub(r'bg-neutral-50(?=.*text-neutral-900)', 'bg-[#faf8f5]', content)
    content = re.sub(r'bg-neutral-50(?=.*flex)', 'bg-[#faf8f5]', content)
    
    # Improve text colors
    content = re.sub(r'text-neutral-900', 'text-[#111]', content)
    content = re.sub(r'text-neutral-600', 'text-[#444]', content)
    content = re.sub(r'text-neutral-500', 'text-[#666]', content)
    content = re.sub(r'text-[#666]', 'text-[#555]', content)
    
    # Enhance borders and shadows
    content = re.sub(r'border-\[#e5e5e5\]', 'border-black/10', content)
    content = re.sub(r'border-neutral-100', 'border-black/5', content)
    content = re.sub(r'border-neutral-200', 'border-black/10', content)
    content = re.sub(r'shadow-sm', 'shadow-[0_2px_10px_rgba(0,0,0,0.02)]', content)

    # Enhance hover and transitions
    content = re.sub(r'hover:opacity-80', 'hover:opacity-70 transition-all duration-300', content)
    content = re.sub(r'hover:border-black', 'hover:border-black/30 transition-all duration-300 hover:shadow-md', content)
    
    # Fix heading font weights for a more premium look (lighter is usually more premium for big text)
    content = re.sub(r'font-bold(?! uppercase)', 'font-medium tracking-tight', content)
    
    # Storefront navbar theme (if any)
    # content = re.sub(r'theme="light"', 'theme="dark"', content) # maybe keep as is, or remove this line
    
    if content != original_content:
        with open(page, "w") as f:
            f.write(content)
        print(f"Updated {os.path.basename(os.path.dirname(page))}/page.tsx")

