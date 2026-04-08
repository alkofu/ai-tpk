---
description: Open a pull request following the open-pull-request skill workflow
---

First, invoke the `validate-before-pr` skill. Run its lint and format checks. Only if both checks pass, proceed to the next step. If either check fails, stop and report the failure -- do not open the PR.

Follow the `open-pull-request` skill exactly — conventional branch naming, conventional PR title,
draft mode, assigned to @me, pre-flight checklist. Do not use any shortcut or simplified workflow.
