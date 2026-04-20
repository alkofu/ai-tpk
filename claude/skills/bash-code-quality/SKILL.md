---
name: bash-code-quality
description: >
  Defensive coding standards for bash scripts authored as deliverables. Self-apply
  when writing or editing any file whose path ends in `.sh` or whose first line is
  a bash shebang (`#!/bin/bash` or `#!/usr/bin/env bash`). Use when writing a shell
  script, editing install.sh, creating a CI helper script, adding a setup script,
  refactoring a bash function, authoring a post-commit utility, or building any
  hook helper. Apply this skill even when the user does not ask for "best practices"
  — the trigger is the file type, not the request wording. This skill does NOT
  govern Bash tool invocations issued during a Claude session — those are covered by
  the bash-style reference.
---

# Bash Code Quality

This skill defines defensive coding standards for bash scripts authored as deliverables — files that are committed to the repository, installed on user machines, or executed in CI/CD environments. It synthesises strict-mode discipline, safe quoting, error trapping, and proven recurring patterns into a single actionable reference.

## When to Use This Skill

- Authoring or editing any `.sh` file in the repository
- Creating or modifying scripts with a `#!/bin/bash` or `#!/usr/bin/env bash` shebang
- Writing install, setup, or migration scripts
- Building hook helper scripts (pre-commit, post-merge, etc.)
- Creating CI/CD pipeline shell scripts
- Authoring utility or maintenance scripts committed to the repo
- Refactoring an existing bash function or script structure
- Reviewing a bash script for correctness before a PR

## When NOT to Use This Skill

- **Invoking the Bash tool inside a Claude session** — that is governed by the bash-style reference (`references/bash-style.md`), not this skill.
- Fish, zsh, or plain POSIX `sh` scripts — the bash idioms here (`[[ ]]`, arrays, `mapfile`, `local`) require bash 4+. POSIX-portable equivalents are noted where relevant but are not the recommended default.
- One-off throwaway commands that are not committed to the repository.

## Relationship to Other Rules

In repositories with their own bash conventions (a project `CLAUDE.md`, a style guide, or a bash-style reference file), the project's rules take precedence over this skill whenever they conflict. Read the project's own rules first; this skill is the fallback when the project is silent.

Three precedence cases that come up most often:

1. **`&&` in script bodies is fine.** If the project forbids `&&` chaining for Bash tool invocations (as `bash-style.md` does), that rule does not restrict `&&` inside `.sh` script bodies — `&&` is a normal bash short-circuit operator and is used freely in scripts.
2. **`$(...)` in script bodies is fine.** If the project forbids `$(...)` in `git commit` Bash-tool invocations, that does not restrict `$(...)` in script bodies — `$(...)` is the recommended form for command substitution inside scripts (preferred over backticks).
3. **Heredocs and multiple `-m` flags are separate concerns.** If the project requires multiple `-m` flags for `git commit` commands issued via the Bash tool, that does not apply to scripts that contain `git commit` calls — scripts may construct commit messages however they wish.

When in doubt, read the project's own bash references first; this skill is the fallback when the project is silent.

---

## Core Defensive Principles

### 1. Strict Mode

Enable strict mode at the top of every script. It is the single most effective safeguard against silent failures.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
```

Flag breakdown:

- `-E` — ERR traps are inherited by functions and subshells, so an error deep in a call stack still fires the top-level trap.
- `-e` — exits the script immediately when any command returns a non-zero status.
- `-u` — makes bash exit when a variable is referenced but has never been assigned; catches typos in variable names early.
- `-o pipefail` — a pipeline fails if any command in it fails, not just the last one. Without this, `false | true` succeeds.

The shebang line should be `#!/usr/bin/env bash` (portable) or `#!/bin/bash` (direct). Never `/bin/sh` when bash features are used.

### 2. Quote Every Variable

Unquoted variable expansions undergo word splitting and pathname expansion. Both can corrupt filenames that contain spaces or glob characters.

```bash
# BAD — word splits on spaces; globs expand
cp $source $dest

# GOOD — quoted, safe for any filename
cp "$source" "$dest"

# Required env vars — fail immediately with a helpful message if unset or empty
: "${REQUIRED_VAR:?REQUIRED_VAR must be set and non-empty}"
```

Quote every `$variable` and `${expansion}` unless you deliberately intend word splitting (rare). When in doubt, quote.

### 3. Use `[[ ]]` for Conditionals

`[[ ]]` is the bash compound conditional. It is safer than `[ ]`: no word splitting inside it, no quoting of variables required for tests, supports `&&`/`||` natively, and handles empty strings correctly.

```bash
# GOOD — bash conditional, handles spaces in variables safely
if [[ -f "$file" && -r "$file" ]]; then
    content=$(<"$file")
fi

# Testing for an empty or unset variable (safe even under set -u with :-)
if [[ -z "${VAR:-}" ]]; then
    echo "VAR is not set or empty" >&2
fi
```

Use `[ ]` only when explicitly targeting POSIX `sh` compatibility. In bash scripts, always prefer `[[ ]]`.

### 4. Declare Function Locals

Variables assigned inside a function without `local` are global by default and visible in the caller's scope — this is a bash scoping rule, unrelated to `set -u`. Use `local` (or `local -r` for read-only) to confine variables to their function. `set -u` is a separate safeguard: it makes bash exit when referencing an unset variable, which helps catch typos in variable names.

```bash
validate_file() {
    local -r file="$1"
    local -r message="${2:-File not found: $file}"

    if [[ ! -f "$file" ]]; then
        echo "ERROR: $message" >&2
        return 1
    fi
}
```

**Pitfall — `local x="$(cmd)"` masks exit codes (ShellCheck SC2155):**

```bash
# BAD — set -e will NOT catch a failure inside the command substitution
# because `local` itself returns 0 even when the assignment fails
local result="$(some_command)"

# GOOD — declare first, assign separately so the exit code propagates
local result
result="$(some_command)"
```

Always split `local` declaration from `$(...)` assignment. This also applies to `declare`.

### 5. Trap Errors and Clean Up

Register cleanup and error-reporting traps near the top of the script, right after `set -Eeuo pipefail`.

```bash
TMPDIR_WORK=""

cleanup() {
    [[ -n "$TMPDIR_WORK" ]] && rm -rf -- "$TMPDIR_WORK"
}

trap 'echo "Error on line $LINENO" >&2' ERR
trap cleanup EXIT
```

- The `ERR` trap fires whenever a command fails; log the line number to aid debugging.
- The `EXIT` trap fires on all exits (normal, `exit N`, and error), making it the right place to remove temp files and release locks.
- Register `EXIT` cleanup before creating the resource being cleaned up — if `mktemp` itself fails the trap still runs safely.

### 6. Use Arrays for Lists

Passing space-separated strings for lists is fragile: any element containing a space breaks iteration silently.

```bash
# BAD — breaks if any element contains a space
items="item one item two item three"
for item in $items; do
    process "$item"   # will see six tokens, not three
done

# GOOD — bash array, handles spaces in elements correctly
declare -a items=("item one" "item two" "item three")
for item in "${items[@]}"; do
    process "$item"
done

# Reading command output into an array
mapfile -t lines < <(some_command)
```

Always expand arrays as `"${arr[@]}"` (double-quoted, at-sign). `"${arr[*]}"` joins elements with IFS, which is rarely what you want.

### 7. NUL-Safe File Iteration

`for f in $(ls dir)` and `for f in $(find ...)` both break on filenames containing spaces, newlines, or glob characters. Use NUL-delimited output from `find` combined with `read -d ''`.

```bash
# GOOD — safe for filenames containing spaces, newlines, or special chars
while IFS= read -r -d '' f; do
    process "$f"
done < <(find "$dir" -type f -name "*.sh" -print0)
```

Note: process substitution (`<(...)`) is used here and is perfectly fine inside script bodies. It is only forbidden for Bash tool invocations per the project's bash-style reference.

---

## Recurring Patterns

### Script Directory Detection

Lets a script reliably locate sibling files regardless of the caller's current working directory.

```bash
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
```

Why: `$0` can be a symlink or a relative path. `${BASH_SOURCE[0]}` resolves to the actual script file; `pwd -P` resolves any remaining symlinks in the directory path.

### Safe Temporary Files

Create a temporary directory once and clean it up automatically on exit.

```bash
TMPDIR_WORK=$(mktemp -d)
trap 'rm -rf -- "$TMPDIR_WORK"' EXIT

# Create files inside it — no further mktemp calls needed
TMPFILE="$TMPDIR_WORK/output.txt"
LOCKFILE="$TMPDIR_WORK/lock"
```

Why: `mktemp -d` creates a uniquely named directory that no other process can predict. All temp files live inside it, so a single `rm -rf` cleans everything. Hardcoding `/tmp/foo` creates race conditions and leaves residue on failure.

### Argument Parsing

A `case` loop that handles short and long options, a value-bearing flag, separator `--`, unknown options, and a `usage()` function.

```bash
usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
    -v, --verbose       Enable verbose output
    -n, --dry-run       Preview changes without applying them
    -o, --output FILE   Write output to FILE
    -h, --help          Show this help message
EOF
    exit "${1:-0}"
}

VERBOSE=false
DRY_RUN=false
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -v|--verbose)  VERBOSE=true; shift ;;
        -n|--dry-run)  DRY_RUN=true; shift ;;
        -o|--output)   OUTPUT_FILE="$2"; shift 2 ;;
        -h|--help)     usage 0 ;;
        --)            shift; break ;;
        -*)            echo "ERROR: Unknown option: $1" >&2; usage 1 ;;
        *)             break ;;
    esac
done
```

Why: the `case` approach handles combined short options and value-bearing flags cleanly without external tools.

### Structured Logging

All log output goes to stderr so it does not pollute stdout pipelines. Debug output is gated by a `DEBUG` environment variable.

```bash
log_info()  { echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO:  $*" >&2; }
log_warn()  { echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARN:  $*" >&2; }
log_error() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2; }
log_debug() {
    [[ "${DEBUG:-0}" == "1" ]] && echo "[$(date +'%Y-%m-%d %H:%M:%S')] DEBUG: $*" >&2
}
```

Why: structured levels make it easy to filter logs. Sending all diagnostics to stderr keeps stdout clean for machine-readable output.

### Dependency Checks

Check for all required external commands up front. Aggregate missing dependencies into an array and report them all at once rather than dying on the first missing tool.

```bash
check_dependencies() {
    local -a missing=()
    local -a required=("git" "curl" "jq")

    for cmd in "${required[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required commands: ${missing[*]}"
        log_error "Install them and re-run this script."
        return 1
    fi
}

check_dependencies
```

Why: `command -v` is a shell built-in, always available, and is preferred over `which` (which is not guaranteed to exist or behave consistently across systems).

### Idempotent Operations

Scripts should be safe to re-run. Check existing state before taking action.

```bash
ensure_directory() {
    local -r dir="$1"
    if [[ -d "$dir" ]]; then
        log_debug "Directory already exists: $dir"
        return 0
    fi
    mkdir -p "$dir"
    log_info "Created directory: $dir"
}

ensure_config() {
    local -r config_file="$1"
    local -r default_value="$2"
    if [[ -f "$config_file" ]]; then
        log_debug "Config already exists: $config_file"
        return 0
    fi
    printf '%s\n' "$default_value" > "$config_file"
    log_info "Created config: $config_file"
}
```

Why: idempotent functions let users re-run the script after partial failures without manual cleanup.

### Dry-Run Support

Wrap every destructive command in a `run_cmd()` function guarded by a `DRY_RUN` flag.

```bash
DRY_RUN="${DRY_RUN:-false}"

run_cmd() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY RUN] Would execute: $*" >&2
        return 0
    fi
    "$@"
}

# Usage
run_cmd cp "$source" "$dest"
run_cmd rm -rf -- "$old_dir"
run_cmd chown "$owner:$group" "$target"
```

Why: lets users preview what a script would do before committing to irreversible changes.

### Atomic File Writes

Write to a temporary file first, then rename into place. A rename within the same filesystem is atomic on Linux and macOS.

```bash
atomic_write() {
    local -r target="$1"
    local tmpfile
    tmpfile=$(mktemp "$(dirname "$target")/.tmp.XXXXXX")

    # Write content to the temp file
    cat > "$tmpfile"

    # Atomic rename — readers never see a partial write
    mv "$tmpfile" "$target"
}

# Usage: pipe content through atomic_write
generate_config | atomic_write "/etc/myapp/config.conf"
```

Why: without the temp-file rename pattern, a reader can see a half-written file if the script is interrupted mid-write.

---

## Anti-Patterns to Avoid

- **Backtick command substitution** `` `cmd` `` — use `$(cmd)` instead; it is readable, nestable, and consistent.
- **Using `which` to check for executables** — use `command -v cmd >/dev/null 2>&1`; `which` is not a shell built-in and behaves inconsistently across systems.
- **Parsing `ls` output** — use globs (`for f in dir/*.sh`) or NUL-safe `find -print0` instead; `ls` output is not safely parseable.
- **`for f in $(find ...)` or `for f in $(ls dir/)`** — breaks on filenames with spaces; use the `while read -r -d ''` / `find -print0` pattern.
- **`cat file | grep pattern`** — use `grep pattern file`; the useless `cat` adds a process and hides intent.
- **Bare `rm -rf "$dir/"` without a non-empty guard** — always validate: `[[ -n "$dir" ]] || { log_error "dir is empty"; exit 1; }` before removing.
- **Echoing structured or multi-line data with `echo`** — `echo` interprets `-n`, `-e`, and backslashes inconsistently across systems; additionally, data that begins with a dash (e.g., a value like `-n` or `-e`) will be silently misread as a flag rather than printed. Use `printf '%s\n' "$data"` instead.
- **Hardcoding `/tmp/foo`** — other processes can predict and race this path; use `mktemp` or `mktemp -d` to create uniquely named temp resources.
- **Using `local x="$(cmd)"`** — `local` always returns 0, masking the command's exit code; declare first, assign separately (see Principle 4).

---

## Quick Checklist

Before declaring a bash script done, verify each item:

- [ ] Shebang is `#!/usr/bin/env bash` or `#!/bin/bash`
- [ ] `set -Eeuo pipefail` appears immediately after the shebang
- [ ] All variable references are quoted (`"$var"`, `"${arr[@]}"`)
- [ ] Functions declare all local variables with `local` or `local -r`
- [ ] `local` declarations and `$(...)` assignments are on separate lines
- [ ] Cleanup is registered via `trap ... EXIT` before resources are created
- [ ] Required environment variables are validated with `: "${VAR:?message}"`
- [ ] Temp files and directories are created with `mktemp` / `mktemp -d`
- [ ] External command dependencies are checked with `command -v` up front
- [ ] All diagnostic and log output goes to stderr (`>&2`)
- [ ] The script is idempotent or documents explicitly why it cannot be
- [ ] Exit codes are intentional: zero on success, non-zero on failure
- [ ] User-facing scripts have a `usage()` / `--help` implementation
- [ ] No deprecated forms: no backticks, no `which`, no `for f in $(ls ...)`, no `local x="$(cmd)"`

---

## Optional Tooling

Running `shellcheck script.sh` locally can catch many of the issues this skill targets — unquoted variables, deprecated forms, SC2155 (`local x="$(cmd)"`), and more. It is a useful manual aid during development. Do not invoke it automatically and do not treat it as a required gate; it is a linter, not a substitute for the practices above.

---

This skill is non-mandatory but should be the default standard for any bash script you write. When the project provides its own bash guidance, follow that first and fall back to this skill for anything the project does not cover.
