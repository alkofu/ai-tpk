# Specialist Review Triggering — Keyword Reference

This file is the canonical keyword list used by the Dungeon Master's heuristic-fallback specialist-routing logic. DM consults these keywords only when no user flag is present (e.g., `--review-security`) and Ruinor has not recommended specialists in its review output. Ruinor's specialist-flagging prose criteria in `claude/agents/ruinor.md` Phase 5 are a parallel but distinct mechanism — both should remain semantically aligned, but they are not auto-synced.

## Keyword Detection (Heuristic Fallback)

**Security keywords** (suggest Riskmancer):
- auth, authentication, authorization, session, jwt, token, password, crypto, encrypt, secret, credential, payment, pii, oauth, api key

**Performance keywords** (suggest Windwarden):
- database, query, performance, scale, optimization, cache, index, pagination, algorithm, batch, real-time, throughput, latency

**Complexity keywords** (suggest Knotcutter):
- refactor, architecture, abstraction, framework, pattern, generalize, redesign, restructure, simplify

**Factual validation keywords** (suggest Truthhammer):
- changelog, breaking change, deprecated, upgrade path, migration guide, compatibility matrix, release notes

**Note:** Keyword detection is a fallback heuristic. Prefer Ruinor's recommendations as the primary trigger mechanism. Truthhammer's factual-validation keywords are intentionally narrow (7 high-signal terms only) — generic infrastructure terms are excluded to avoid triggering Truthhammer on nearly every task. Ruinor's intelligent recommendations and the `--verify-facts` user flag are the primary trigger mechanisms for Truthhammer.
