# Codebase Audit and Integration Health Check Plan

This plan is based on `PROJECT.md` and `ORIGINAL_REQUEST.md`. We will conduct a static codebase review and local development checks of the Atelier CRM & E-Commerce codebase.

## Execution Plan

### Milestone 1: Security & Authentication Audit (M1)
- **Role**: `teamwork_preview_explorer` (Security Specialist)
- **Objective**: Check authentication middleware, API endpoint definitions, JWT configs, env variable handling, and look for secrets/hardcoded credentials or missing authorization checks.
- **Verification**: Output report detailing security findings, including paths and lines.

### Milestone 2: Code Quality & Performance Optimization (M2)
- **Role**: `teamwork_preview_explorer` (Code Quality Specialist)
- **Objective**: Analyze Next.js and Prisma config, dead/unused code, package dependencies, and potential render/query bottlenecks.
- **Verification**: Output report detailing code quality and performance optimization recommendations.

### Milestone 3: Integration Health Check (M3)
- **Role**: `teamwork_preview_explorer` (Integration Specialist)
- **Objective**: Review ARCA/AFIP billing endpoints, SmartLab sync logic, WhatsApp bot communication modules, and compare the database schema against Prisma models.
- **Verification**: Output report detailing integration health issues and schema compatibility.

### Milestone 4: Build & TypeScript Verifications (M4)
- **Role**: `teamwork_preview_worker`
- **Objective**: Execute compile checks and verify that the application builds successfully without critical build blockers.
- **Commands**:
  - `npm run build` or similar build script.
  - `npx tsc --noEmit`.
- **Verification**: Log build and tsc outputs in the report.

### Milestone 5: Final Report Synthesis (M5)
- **Role**: `teamwork_preview_orchestrator` (Self)
- **Objective**: Synthesize the findings from M1, M2, M3, and M4 into the final `/Users/ishtarpissano/proyectos/atelier/audit_report.md` with severity levels (Critical, Warning, Informational).
- **Verification**: Final audit report exists and covers all requirements.
