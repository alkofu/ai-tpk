# Open Questions — migrate-npm-to-pnpm

This file tracks reservations from ACCEPT-WITH-RESERVATIONS reviewer verdicts for this plan.

## Review Reservations - 2026-04-10

### F-2 (MINOR) — No test for symlink edge case in ~/bin/myclaude

**Location:** `installer/test/launcher-install.test.ts`

The symlink guard path in `installer/launcher-install.ts` (lines 39–48) is exercised only implicitly. If `~/bin/myclaude` is a symlink, the function prints a warning and returns early — the bundle is still installed to `~/.ai-tpk/` but the wrapper script is NOT updated. A regression in the symlink detection logic (e.g., accidentally using `fs.stat` instead of `fs.lstatSync`, which would follow symlinks) would go undetected.

**Suggested follow-up:** Add a test that creates a symlink at `~/bin/myclaude`, runs `installLauncherScript`, and asserts that: (a) the symlink is still present, (b) the function returns without throwing, and (c) the bundle was still copied to `~/.ai-tpk/`.

---

### F-3 (MINOR) — Launcher bundle shebang is effectively dead code

**Location:** `build.ts`, lines 15–25 (launcher build config)

The launcher bundle receives a `#!/usr/bin/env node` shebang banner (same as the installer bundle). However, the launcher is always invoked via `exec node "$LAUNCHER_BUNDLE"` from `myclaude.sh` — it is never directly executed. The shebang is dead code in the launcher bundle.

**Impact:** No functional impact. The shebang is harmless and provides a minor forward-compatibility benefit: if the launcher bundle were ever made directly executable (e.g., `chmod +x ~/.ai-tpk/launcher.js`), it would work. No action required unless cleanliness is a concern.
