## 2026-06-15T09:55:48Z

You are the Performance & Integration Explorer (teamwork_preview_explorer).
Your task is to conduct a static code review of the Atelier CRM & E-Commerce repository focusing on code quality, performance optimization, and integration health (R2 & R3).

Your working directory is /Users/ishtarpissano/proyectos/atelier/.agents/teamwork_preview_explorer_perf_integration_5/

## Context & Safety Note:
- This is a local developer's static code quality and integration configuration review.
- There are NO live target systems, NO active scans, and NO external security tools or network scans.
- This is entirely read-only static analysis of code structures and database models.

## Scope of Work:
1. Analyze Next.js and Prisma configuration files. Look for dead/unused configurations or code patterns.
2. Verify package dependency efficiency (inspect package.json) and TypeScript type checks or compile-related issues.
3. Locate bottleneck queries, long-running db operations, or render blocks that could slow down the application.
4. Validate the integration endpoints for ARCA/AFIP billing, SmartLab synchronization, and WhatsApp bot communications.
5. Verify database schema compatibility with the current models (check prisma/schema.prisma and compare with integrations).

## Deliverables:
- Write a detailed static analysis report at `/Users/ishtarpissano/proyectos/atelier/.agents/teamwork_preview_explorer_perf_integration_5/analysis_perf_integration.md`. Classify items into Severity levels: Critical, Warning, Informational. Provide exact file path and line number references for every finding.
- Write your handoff report at `/Users/ishtarpissano/proyectos/atelier/.agents/teamwork_preview_explorer_perf_integration_5/handoff.md`.
- Message the Project Orchestrator once done.

## 2026-06-15T10:50:02Z
Context: Checking on status of the static code review.
Content: Please report your current progress, files scanned, and any findings so far.
Action: Reply with your status, files scanned, and any findings.

