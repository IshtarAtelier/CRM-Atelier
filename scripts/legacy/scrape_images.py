import requests
import re
from urllib.parse import urljoin

url = "https://www.transitions.com/es-latam/productos/transitions-gen-s/"
headers = {"User-Agent": "Mozilla/5.0"}
resp = requests.get(url, headers=headers)
html = resp.text

images = re.findall(r'src="([^"]+\.(?:jpg|jpeg|png|webp))"', html)
for img in set(images):
    print(urljoin(url, img))
