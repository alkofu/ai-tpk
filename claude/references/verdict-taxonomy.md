# Verdict and Severity Taxonomy — Shared Reference

This file defines the shared vocabulary for verdicts and severity levels used across all reviewer agents. It is the authoritative source for these labels. Each agent applies them through the lens of its own domain.

## Verdict Definitions

These four verdicts are used by all reviewer agents. The shared meaning is defined here; domain-specific application is defined per-agent.

- **REJECT**: Fundamental flaws prevent this from being viable. Must be substantially reworked or reconsidered. Issued when critical, blocking problems exist that make the artifact unsafe or unexecutable to proceed with.
- **REVISE**: The approach is sound but significant issues must be addressed before proceeding. Issued when serious problems exist but the overall direction is correct.
- **ACCEPT-WITH-RESERVATIONS**: Acceptable to proceed, but noted issues should be addressed. Issued when only minor or acknowledged trade-off findings exist.
- **ACCEPT**: The artifact meets the relevant standards with no material issues. Issued when no findings or only trivial observations exist.

## Severity Scales

Two severity scales are in use across the system. Which scale an agent uses is determined by that agent's role.

### Scale A — Ruinor's Quality Review Scale (CRITICAL / MAJOR / MINOR)

Used by Ruinor for baseline quality gate reviews of plans and code.

**CRITICAL** — Blocks execution. The artifact has a fundamental flaw that will cause failure, data loss, security breach, or renders the work unachievable.

All CRITICAL findings require concrete evidence: `file:line` citations for code, backtick-quoted excerpts for plans.

**MAJOR** — Requires significant rework. The artifact will technically work but has serious quality, maintainability, or reliability issues.

All MAJOR findings require concrete evidence: `file:line` citations for code, backtick-quoted excerpts for plans.

**MINOR** — Suboptimal but acceptable. The artifact works and is reasonable but could be improved.

### Scale B — Specialist Scale (CRITICAL / HIGH / MEDIUM / LOW)

Used by specialist reviewers (Riskmancer, Windwarden, Knotcutter, Truthhammer) for domain-specific analysis.

**CRITICAL** — Blocks production. A flaw that will cause system failure, security breach, runtime error, or complete unacceptability under expected conditions.

**HIGH** — Requires immediate attention before deployment. Significant degradation or risk under normal conditions.

**MEDIUM** — Optimization or risk opportunity. Noticeable but not immediately critical impact.

**LOW** — Minor inefficiency or low-confidence concern. Measurable but negligible real-world impact.

## Evidence Doctrine

> "Findings without evidence are opinions, not findings."

All CRITICAL and MAJOR/HIGH findings must include concrete citations. For code: `file:line` references. For plans: backtick-quoted excerpts from the relevant plan step. A finding without a citation is not a finding — it is speculation and must be removed or downgraded.

## Domain-Specific Application

This reference defines the shared vocabulary. It does not define what each severity level means in each domain — that is each agent's responsibility.

For example:
- Ruinor applies CRITICAL to logic errors and impossible plan steps.
- Riskmancer applies CRITICAL to vulnerabilities that make a system unsafe for production.
- Windwarden applies CRITICAL to performance flaws that will cause outages under expected load.
- Knotcutter uses CRITICAL/HIGH/MEDIUM/LOW to classify complexity concerns proportional to their architectural impact.
- Truthhammer applies CRITICAL to CONTRADICTED claims that will cause runtime failure.

**Truthhammer's claim classification system** (VERIFIED / UNVERIFIABLE / CONTRADICTED) is a separate taxonomy entirely. It describes the epistemic status of factual claims about external systems. This classification system maps onto the shared CRITICAL/HIGH/MEDIUM/LOW severity scale — the severity label describes the consequence of the claim being wrong, while the classification describes whether the claim was confirmed. Both concepts coexist within Truthhammer's domain-specific output.

Each agent defines what its severity levels mean in the context of its domain. This file defines the labels; the agents define the meaning.
