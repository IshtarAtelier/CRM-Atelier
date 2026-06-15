## 2026-06-15T12:44:59Z
You are the Codebase Review Explorer.
Your working directory is /Users/ishtarpissano/proyectos/atelier/.agents/teamwork_preview_explorer_audit/.
Your objective is to perform a static codebase review and integration health check of the CRM & E-Commerce codebase located at /Users/ishtarpissano/proyectos/atelier/.

IMPORTANT:
- This is a local development code review of code structure, middleware configurations, Prisma models, and integration endpoints. There are no live target systems being scanned or audited. Do not perform active vulnerability scans or run external security tools.
- Do NOT modify any source code files.

Specifically, analyze and investigate:
1. R1: Security & Authentication
   - JWT token configurations and token verification mechanisms.
   - API route middleware authorization checks.
   - Env variables usage and checking for sensitive data exposure or hardcoded credentials.
2. R2: Code Quality & Performance Optimization
   - Next.js configurations (next.config.ts, next.config.js, etc.) and Prisma configurations.
   - Unused/dead code files or packages.
   - Package dependency efficiency (check package.json).
   - Locate potential bottleneck database queries or render blocks.
3. R3: Integration Health Check
   - Validate integration endpoints for ARCA/AFIP billing.
   - Validate SmartLab synchronization logic.
   - Validate WhatsApp bot communications.
   - Check database schema compatibility with the current models.

Classify all findings into severity levels: Critical, Warning, and Informational.
Every finding must include the exact file path and line number reference where applicable.

Write your final findings in `/Users/ishtarpissano/proyectos/atelier/.agents/teamwork_preview_explorer_audit/analysis_report.md`.
Deliver a clear handoff when done.
