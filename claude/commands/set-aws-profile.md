---
description: Select an AWS profile for the CloudWatch MCP server
---

List available AWS profiles from `~/.aws/config` or `~/.aws/credentials` and let the user choose one to activate for the CloudWatch MCP server.

## Steps

1. **Read AWS profile configuration** and enumerate all profile names:
   - First, try `~/.aws/config`:
     - Include `[default]` if present (display as `default`)
     - Include each `[profile <name>]` entry (display as `<name>`)
   - If `~/.aws/config` does not exist, fall back to `~/.aws/credentials`:
     - Include every `[<name>]` section header as a profile name (including `[default]`)
     - Note: credentials file uses bare section names with no `profile` prefix
     - Deduplicate: treat `.` and `_` as equivalent when comparing names — if two entries differ only by `.` vs `_` in the same position(s), show only the first occurrence and suppress the duplicate
     - Sort the final list alphabetically
   - If neither file exists or contains no profiles, tell the user and stop.

2. **Show the current active profile** (if any): read `~/.claude/.current-aws-profile` — if it exists and is non-empty, display its first line as the current profile next to "(active)". If the file does not exist, note "no profile currently set."

3. **Present the profile list** and ask the user to choose one by name.

4. **Validate the selection:** the chosen name must exactly match one of the profiles enumerated in step 1.
   - If it does not match, respond: "That profile name was not found in ~/.aws/config (or ~/.aws/credentials). Please choose from the list above." Ask again. Do not write anything to disk.

5. **Write the validated profile name** to `~/.claude/.current-aws-profile` (create or overwrite). Then set file permissions to mode 0600 by running: `chmod 600 ~/.claude/.current-aws-profile`

6. **Confirm:** "Profile set to `<name>`. Restart Claude Code or reload MCP servers for this to take effect."
