List available AWS profiles from `~/.aws/config` and let the user choose one to activate for the CloudWatch MCP server.

## Steps

1. **Read `~/.aws/config`** and enumerate all profile names:
   - Include `[default]` if present (display as `default`)
   - Include each `[profile <name>]` entry (display as `<name>`)
   - If `~/.aws/config` does not exist or contains no profiles, tell the user and stop.

2. **Show the current active profile** (if any): read `~/.claude/.current-aws-profile` — if it exists and is non-empty, display its first line as the current profile next to "(active)". If the file does not exist, note "no profile currently set."

3. **Present the profile list** and ask the user to choose one by name.

4. **Validate the selection:** the chosen name must exactly match one of the profiles enumerated in step 1.
   - If it does not match, respond: "That profile name was not found in ~/.aws/config. Please choose from the list above." Ask again. Do not write anything to disk.

5. **Write the validated profile name** to `~/.claude/.current-aws-profile` (create or overwrite). Then set file permissions to mode 0600 by running: `chmod 600 ~/.claude/.current-aws-profile`

6. **Confirm:** "Profile set to `<name>`. Restart Claude Code or reload MCP servers for this to take effect."
