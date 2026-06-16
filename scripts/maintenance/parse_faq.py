import re
import json

with open("/Users/ishtarpissano/.gemini/antigravity/brain/623961af-513c-49e6-b31d-d37c2d1ecdc4/.system_generated/steps/408/content.md", "r") as f:
    text = f.read()

# Find the json chunk
match = re.search(r'<script id="__NEXT_DATA__" type="application/json">([\s\S]*?)</script>', text)
if match:
    data = json.loads(match.group(1))
    
    def extract_faqs(obj):
        faqs = []
        if isinstance(obj, dict):
            # Often, essilor stores questions in teaserTitle and answers in teaserText
            if "teaserTitle" in obj and isinstance(obj["teaserTitle"], str) and "?" in obj["teaserTitle"]:
                faqs.append((obj["teaserTitle"], obj.get("teaserText", "")))
            for k, v in obj.items():
                faqs.extend(extract_faqs(v))
        elif isinstance(obj, list):
            for item in obj:
                faqs.extend(extract_faqs(item))
        return faqs

    results = extract_faqs(data)
    for q, a in results:
        print(f"Q: {q}")
        print(f"A: {a}")
        print("---")
else:
    print("No next data found")
