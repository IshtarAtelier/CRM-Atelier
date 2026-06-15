# Original User Request

## Initial Request — 2026-06-14T23:45:21-03:00

Audit and review the Atelier CRM & E-Commerce codebase for security, code quality, and integration health.

Working directory: /Users/ishtarpissano/proyectos/atelier
Integrity mode: development

## Requirements

### R1. Security & Authentication Audit
Audit all API endpoints, JWT token configurations, route middleware checks, and env variables. Identify any sensitive data exposure, missing authorization checks, or hardcoded credentials.

### R2. Code Quality & Performance Optimization
Analyze the Next.js and Prisma configuration, look for dead/unused code, verify package dependency efficiency, check TypeScript types, and locate bottleneck queries or render blocks that could slow down the application.

### R3. Integration Health Check
Validate the integration endpoints for ARCA/AFIP billing, SmartLab synchronization, and WhatsApp bot communications. Verify database schema compatibility with the current models.

## Acceptance Criteria

### Audit Output
- [ ] A comprehensive audit report saved in `/Users/ishtarpissano/proyectos/atelier/audit_report.md`.
- [ ] The report must classify issues into severity levels: Critical, Warning, and Informational.
- [ ] Every finding must include exact file path and line number references where applicable.

### Build & Integrity Check
- [ ] Verify that the application builds successfully without critical build blockers.
- [ ] Compile check `npx tsc --noEmit` must be executed and all findings documented in the report.
