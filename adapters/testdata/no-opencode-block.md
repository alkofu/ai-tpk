---
description: "Test fixture — agent without an opencode block"
model: claude-3-5-sonnet-20241022
claude:
  tools: "Read, Bash"
  level: 1
---

This is a minimal test fixture for validating the best-effort fallback path. The
absence of an `opencode:` block causes the adapter to fall back to deriving
OpenCode output from the `claude:` block.
