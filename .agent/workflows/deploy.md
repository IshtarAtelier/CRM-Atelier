---
description: Deploy changes directly to production (Railway)
---

After making any code changes, always deploy directly to production by following these steps:

// turbo-all

1. Stage all changes:
```
git add -A
```

2. Commit with a descriptive message:
```
git commit -m "<descriptive message>"
```

3. Push directly to main (production):
```
git push origin main
```

Railway will automatically build and deploy from the `main` branch.
Production URL: https://crm-atelier-production-ae72.up.railway.app
