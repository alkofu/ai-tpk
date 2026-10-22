import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parse as parseYaml } from 'yaml';
import { c } from './colors.js';

interface McpServerConfig {
  name: string;
  scope: 'user' | 'project';
  transport: 'stdio' | 'sse' | 'streamable-http';
  prereq?: string;
  env?: Record<string, string>;
  command?: string;
  args?: string[];
  wrapper?: string;
}

interface McpServersFile {
  servers: McpServerConfig[];
}

/**
 * Expands $HOME and ${HOME} and $USER and ${USER} in a string value using
 * os.homedir() and os.userInfo().username respectively. No eval or shell
 * is used.
 */
export function expandVars(value: string): string {
  const home = os.homedir();
  const user = os.userInfo().username;
  return value
    .replace(/\$\{HOME\}|\$HOME(?!\w)/g, home)
    .replace(/\$\{USER\}|\$USER(?!\w)/g, user);
}

/**
 * Reads and validates mcp-servers.json from the given repo root directory.
 * - Returns [] if the file does not exist (graceful degradation).
 * - Throws on malformed JSON or schema violations.
 */
export function loadMcpServers(repoRoot: string): McpServerConfig[] {
  const filePath = path.join(repoRoot, 'src/mcp/mcp-servers.json');

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      console.log(
        c.yellow(
          'Warning: mcp-servers.json not found -- skipping MCP server setup',
        ),
      );
      return [];
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`mcp-servers.json: invalid JSON in ${filePath}`);
  }

  if (typeof parsed !== 'object' || parsed === null || !('servers' in parsed)) {
    throw new Error("mcp-servers.json: missing top-level 'servers' field");
  }

  const { servers } = parsed as McpServersFile;

  if (!Array.isArray(servers)) {
    throw new Error("mcp-servers.json: 'servers' must be an array");
  }

  const validScopes = ['user', 'project'] as const;
  const validTransports = ['stdio', 'sse', 'streamable-http'] as const;

  for (const entry of servers as unknown[]) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('mcp-servers.json: each server entry must be an object');
    }
    const server = entry as Record<string, unknown>;

    if (typeof server['name'] !== 'string' || server['name'].trim() === '') {
      throw new Error(
        "mcp-servers.json: server entry missing required non-empty 'name' field",
      );
    }
    const name = server['name'] as string;

    if (
      !validScopes.includes(server['scope'] as (typeof validScopes)[number])
    ) {
      throw new Error(
        `mcp-servers.json: server '${name}' has invalid scope '${String(server['scope'])}' -- must be 'user' or 'project'`,
      );
    }

    if (
      !validTransports.includes(
        server['transport'] as (typeof validTransports)[number],
      )
    ) {
      throw new Error(
        `mcp-servers.json: server '${name}' has invalid transport '${String(server['transport'])}' -- must be 'stdio', 'sse', or 'streamable-http'`,
      );
    }

    const hasWrapper =
      typeof server['wrapper'] === 'string' &&
      (server['wrapper'] as string).trim() !== '';
    const hasCommand =
      typeof server['command'] === 'string' &&
      (server['command'] as string).trim() !== '';

    if (hasWrapper && hasCommand) {
      throw new Error(
        `mcp-servers.json: server '${name}' must not have both 'wrapper' and 'command' fields`,
      );
    }

    if (!hasWrapper && !hasCommand) {
      throw new Error(
        `mcp-servers.json: server '${name}' must have either 'wrapper' or 'command' field`,
      );
    }
  }

  return servers as McpServerConfig[];
}

/**
 * Constructs the argument array for `claude mcp add` from a structured server
 * config. Variable expansion is applied to env values and args entries.
 *
 * For wrapper-based servers, the wrapper script path is resolved to an absolute
 * path and validated to exist on disk. No `-e` flags are emitted.
 */
export function buildAddArgs(
  server: McpServerConfig,
  repoRoot: string,
  homedir: string = os.homedir(),
): string[] {
  if (server.wrapper !== undefined) {
    const absoluteWrapperPath =
      server.scope === 'user'
        ? path.join(homedir, '.claude', server.wrapper)
        : path.join(repoRoot, server.wrapper);
    try {
      fs.statSync(absoluteWrapperPath);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw new Error(
          `Wrapper script not found: ${absoluteWrapperPath} (defined in server '${server.name}')`,
          { cause: err },
        );
      }
      throw err;
    }
    return [
      '-s',
      server.scope,
      '-t',
      server.transport,
      '--',
      server.name,
      absoluteWrapperPath,
    ];
  }

  const result: string[] = ['-s', server.scope, '-t', server.transport];

  for (const [key, value] of Object.entries(server.env ?? {})) {
    result.push('-e', `${key}=${expandVars(value)}`);
  }

  if (!server.command) {
    // Should not be reachable: loadMcpServers ensures exactly one of wrapper/command is set.
    throw new Error(`Server '${server.name}' has no command or wrapper field`);
  }

  result.push('--', server.name, server.command);

  for (const arg of server.args ?? []) {
    result.push(expandVars(arg));
  }

  return result;
}

// Path where install stamps are persisted across runs.
const STAMPS_PATH = path.join(
  os.homedir(),
  '.claude',
  '.mcp-install-stamps.json',
);

/**
 * Computes a stable signature string for a wrapper-based server config.
 * The signature captures the fields that affect the `claude mcp add` invocation:
 * name, scope, transport, and the resolved absolute wrapper path.
 *
 * Throws if `server.wrapper` is undefined (not a wrapper-based server).
 */
export function computeConfigSignature(
  server: McpServerConfig,
  repoRoot: string,
  homedir: string = os.homedir(),
): string {
  if (server.wrapper === undefined) {
    throw new Error(
      `computeConfigSignature: server '${server.name}' has no wrapper field`,
    );
  }
  const wrapperPath =
    server.scope === 'user'
      ? path.join(homedir, '.claude', server.wrapper)
      : path.join(repoRoot, server.wrapper);
  return JSON.stringify({
    name: server.name,
    scope: server.scope,
    transport: server.transport,
    wrapperPath,
  });
}

/**
 * Reads the MCP install stamps file from disk.
 * Returns {} on ENOENT (file not yet created) or invalid JSON (corrupted).
 * Re-throws all other errors.
 */
export function readStamps(stampsPath: string): Record<string, string> {
  let raw: string;
  try {
    raw = fs.readFileSync(stampsPath, 'utf8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return {};
    }
    throw err;
  }
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    console.log(
      c.yellow(
        `Warning: MCP stamps file at ${stampsPath} contains invalid JSON -- resetting`,
      ),
    );
    return {};
  }
}

/**
 * Writes the MCP install stamps to disk as pretty-printed JSON.
 * On any write failure, logs a yellow warning and returns without throwing.
 */
export function writeStamps(
  stampsPath: string,
  stamps: Record<string, string>,
): void {
  try {
    fs.writeFileSync(stampsPath, JSON.stringify(stamps, null, 2), 'utf8');
  } catch {
    console.log(
      c.yellow(
        `Warning: failed to write MCP stamps file at ${stampsPath} -- stamp-based skipping will not persist`,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// GitHub multi-account support
// ---------------------------------------------------------------------------

/**
 * Reads the cross-platform file mode of a path as an octal string.
 * Returns the mode string (e.g. "600", "755") or null if stat failed.
 * Uses the same stat fallback chain as the mcp-github.sh wrapper.
 */
function readFileModeOctal(filePath: string): string | null {
  try {
    return execFileSync('stat', ['-f', '%Lp', filePath], {
      encoding: 'utf8',
    }).trim();
  } catch {
    try {
      return execFileSync('stat', ['-c', '%a', filePath], {
        encoding: 'utf8',
      }).trim();
    } catch {
      return null;
    }
  }
}

/**
 * A spawn function type used by the GitHub registration helpers so that tests
 * can inject a stub without needing to monkey-patch node:child_process.
 * The function receives the command and args; return value is ignored.
 * It MUST throw to indicate command failure.
 */
type SpawnFn = (cmd: string, args: string[]) => void;

/**
 * Default spawnFn that calls execFileSync with stdio: "pipe".
 */
function defaultSpawn(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: 'pipe' });
}

/**
 * A warn function type used by the GitHub helpers so that tests can capture
 * warnings instead of printing them to stdout.
 */
type WarnFn = (msg: string) => void;

function defaultWarn(msg: string): void {
  console.log(c.yellow(msg));
}

/**
 * Removes the legacy single-account 'github' MCP server registration (no suffix).
 * Runs unconditionally on every install run as an upgrade migration.
 * Uses explicit -s user scope flag for symmetry with mcp add calls (F-11).
 * Ignores failure (the registration may not exist on a fresh install).
 *
 * @param spawnFn - Injectable for testing; defaults to execFileSync.
 */
export function removeLegacyGithubRegistration(
  spawnFn: SpawnFn = defaultSpawn,
): void {
  try {
    spawnFn('claude', ['mcp', 'remove', '-s', 'user', 'github']);
    console.log(c.green("Removed legacy 'github' MCP registration"));
  } catch {
    // Registration was not present — that is fine
  }
}

/**
 * Asserts that ~/.claude/wrappers/ is not group- or world-writable (V-5).
 * Prints a warning if the directory mode has the group-write or world-write bit set.
 * This is a warning, not a failure — the user controls their own umask intent.
 *
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param warnFn - Injectable for testing; defaults to console.log yellow.
 */
export function assertWrappersDirNotWorldWritable(
  homedir: string = os.homedir(),
  warnFn: WarnFn = defaultWarn,
): void {
  const wrappersDir = path.join(homedir, '.claude', 'wrappers');
  const modeStr = readFileModeOctal(wrappersDir);
  if (modeStr === null) {
    // Can't stat the dir — skip silently (may not exist yet on a fresh install)
    return;
  }
  const modeNum = parseInt(modeStr, 8);
  if (isNaN(modeNum)) {
    return;
  }
  // Check group-write (020) or world-write (002) bits
  if ((modeNum & 0o022) !== 0) {
    warnFn(
      `Warning: ~/.claude/wrappers/ mode is ${modeStr}; should not be group- or world-writable\n` +
        `(recommended 0755). A writable wrappers directory could allow another process to\n` +
        `replace mcp-github.sh and exfiltrate PATs.\n` +
        `Run: chmod 755 ~/.claude/wrappers`,
    );
  }
}

/**
 * Reads and validates ~/.config/tpk/github-pats.json.
 * Returns the validated flat object of key→PAT pairs, or null on ENOENT/empty.
 * Throws on malformed JSON, wrong shape, or invalid entries.
 *
 * NOTE: does not route through buildAddArgs because buildAddArgs's wrapper-based
 * path explicitly forbids -e flags (asserted in mcp.test.ts:222-225), and we
 * need to pass GITHUB_ACCOUNT per server. Extending buildAddArgs to allow env
 * on wrappers would change the contract for *all* wrapper servers. The simpler
 * local change is for registerGithubAccounts to construct its claude mcp add
 * argv directly.
 *
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param spawnFn - Injectable for testing; defaults to execFileSync.
 * @param warnFn - Injectable for testing; defaults to console.log yellow.
 * @returns Set of successfully registered account keys.
 */
export function registerGithubAccounts(
  homedir: string = os.homedir(),
  spawnFn: SpawnFn = defaultSpawn,
  warnFn: WarnFn = defaultWarn,
): Set<string> {
  const patsPath = path.join(homedir, '.config', 'tpk', 'github-pats.json');

  // PATs file mode check at install time (V-1 part 2)
  try {
    fs.statSync(patsPath);
    const modeStr = readFileModeOctal(patsPath);
    if (modeStr !== null) {
      // Normalise: strip leading zero for comparison
      const normalised = modeStr.replace(/^0+/, '') || '0';
      if (normalised !== '600') {
        warnFn(
          `Warning: ~/.config/tpk/github-pats.json mode is ${modeStr}; recommended mode is 0600.\n` +
            `Run: chmod 600 ~/.config/tpk/github-pats.json\n` +
            `The wrapper will refuse to read this file at MCP server boot until the mode is fixed.`,
        );
      }
    }
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      warnFn(
        'Warning: ~/.config/tpk/github-pats.json not found -- skipping GitHub MCP setup',
      );
      return new Set();
    }
    throw err;
  }

  // Read the PATs file
  let raw: string;
  try {
    raw = fs.readFileSync(patsPath, 'utf8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      warnFn(
        'Warning: ~/.config/tpk/github-pats.json not found -- skipping GitHub MCP setup',
      );
      return new Set();
    }
    throw err;
  }

  // Parse JSON — error message must NOT include file contents (V-4)
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const kind = err instanceof Error ? err.constructor.name : typeof err;
    throw new Error(`github-pats.json: invalid JSON in ${patsPath} (${kind})`, {
      cause: err,
    });
  }

  // Validate shape
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`github-pats.json: ${patsPath} must be a flat JSON object`);
  }

  const d = parsed as Record<string, unknown>;

  // Validate each entry — key by key (V-4: identify by key only, never value)
  const KEY_RE = /^[a-zA-Z0-9_.-]+$/;
  for (const [key, value] of Object.entries(d)) {
    if (!KEY_RE.test(key)) {
      throw new Error(
        `github-pats.json: key '${key}' contains characters outside [a-zA-Z0-9_.-]`,
      );
    }
    if (typeof value !== 'string' || value === '') {
      // SECURITY: identify the offending entry by key only, never by value (V-4)
      throw new Error(
        `github-pats.json: PAT for account '${key}' must be a non-empty string`,
      );
    }
  }

  // Empty object case
  const sortedKeys = Object.keys(d).toSorted();
  if (sortedKeys.length === 0) {
    warnFn(
      'Warning: ~/.config/tpk/github-pats.json is empty -- registering zero GitHub MCP servers',
    );
    return new Set();
  }

  const wrapperPath = path.join(
    homedir,
    '.claude',
    'wrappers',
    'mcp-github.sh',
  );
  const registered = new Set<string>();

  for (const key of sortedKeys) {
    // Best-effort remove any prior registration for this key (idempotent re-add)
    try {
      spawnFn('claude', ['mcp', 'remove', '-s', 'user', `github-${key}`]);
    } catch {
      // Not previously registered — fine
    }

    // Register the new server. Only GITHUB_ACCOUNT is passed as env — the PAT
    // is never passed here (resolves from ~/.config/tpk/github-pats.json at boot time).
    try {
      spawnFn('claude', [
        'mcp',
        'add',
        '-s',
        'user',
        '-t',
        'stdio',
        '-e',
        `GITHUB_ACCOUNT=${key}`,
        '--',
        `github-${key}`,
        wrapperPath,
      ]);
      console.log(c.green(`MCP server 'github-${key}' added`));
      registered.add(key);
    } catch {
      // SECURITY: failure log must NOT include the PAT or any portion of
      // github-pats.json contents (V-4)
      console.log(c.red(`Failed to add MCP server 'github-${key}'`));
    }
  }

  return registered;
}

/**
 * Removes stale github-<key> MCP registrations from ~/.claude.json where
 * <key> is no longer present in desiredKeys.
 *
 * Data source: ~/.claude.json direct read — NOT claude mcp list.
 * Reads ~/.claude.json at top-level key `mcpServers` (object: server name -> config).
 * Verified against claude --version 2.1.119 on 2026-04-23 by inspecting a live
 * ~/.claude.json with at least one user-scope MCP server registered.
 * If a future claude release moves user-scope MCP state to a different key, update
 * the path and re-record the verified version above. Do NOT add a sidecar fallback
 * (~/.claude/.mcp-github-keys.json) -- the direct-read path is the only supported
 * mechanism (per plan F-13).
 *
 * @param desiredKeys - The set of account keys currently desired.
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param spawnFn - Injectable for testing; defaults to execFileSync.
 * @param warnFn - Injectable for testing; defaults to console.log yellow.
 */
export function removeStaleGithubRegistrations(
  desiredKeys: Set<string>,
  homedir: string = os.homedir(),
  spawnFn: SpawnFn = defaultSpawn,
  warnFn: WarnFn = defaultWarn,
): void {
  removeStalePrefixedRegistrations(
    'github',
    'GitHub',
    desiredKeys,
    homedir,
    spawnFn,
    warnFn,
  );
}

/**
 * Removes stale `<prefix>-<key>` MCP registrations from ~/.claude.json where
 * <key> is not in desiredKeys. Shared by the GitHub and Grafana per-instance
 * registrations; see removeStaleGithubRegistrations for the data-source notes.
 *
 * @param prefix - Server-name prefix, e.g. "github" matches "github-<key>".
 * @param label - Human-readable name used in warnings, e.g. "GitHub".
 */
function removeStalePrefixedRegistrations(
  prefix: string,
  label: string,
  desiredKeys: Set<string>,
  homedir: string,
  spawnFn: SpawnFn,
  warnFn: WarnFn,
): void {
  const claudeStorePath = path.join(homedir, '.claude.json');

  let raw: string;
  try {
    raw = fs.readFileSync(claudeStorePath, 'utf8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      // No Claude CLI state present — nothing to clean
      return;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warnFn(
      `Warning: ~/.claude.json contains invalid JSON -- skipping stale ${label} MCP cleanup`,
    );
    return;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('mcpServers' in parsed)
  ) {
    // No mcpServers key — nothing to clean
    return;
  }

  const mcpServers = (parsed as Record<string, unknown>)['mcpServers'];
  if (typeof mcpServers !== 'object' || mcpServers === null) {
    return;
  }

  // Match <prefix>-<suffix> — .+ intentionally matches underscores, dots,
  // hyphens (a superset of every per-instance key validator). `prefix` is a
  // fixed lowercase literal supplied by callers, so it needs no escaping.
  const PREFIX_RE = new RegExp(`^${prefix}-(.+)$`);

  for (const serverName of Object.keys(mcpServers as Record<string, unknown>)) {
    const match = PREFIX_RE.exec(serverName);
    if (!match) continue;
    const suffix = match[1]!;
    if (desiredKeys.has(suffix)) continue;

    // This registration is stale — remove it
    try {
      spawnFn('claude', ['mcp', 'remove', '-s', 'user', serverName]);
      console.log(c.green(`Removed stale MCP registration '${serverName}'`));
    } catch {
      // Best-effort — do not abort
    }
  }
}

/**
 * Injects per-account mcp__github-<key>__* allow-list entries into the
 * installed ~/.claude/settings.json.
 *
 * Constitution check (Principle 2 — Install-time Self-Containment):
 * The file being mutated is ~/.claude/settings.json (the installed copy at
 * the destination, NOT the source claude/settings.json). Mutations happen
 * at install time only; the resulting ~/.claude/settings.json is fully
 * self-contained and contains no back-references to the repo.
 *
 * Atomic via temp + rename. Two concurrent install.sh runs are last-writer-wins
 * on the rename — the file will not corrupt, but one set of edits may be lost.
 * This is acceptable because parallel installs of this repo are not a supported
 * workflow.
 *
 * @param accountKeys - The set of successfully-registered account keys.
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param warnFn - Injectable for testing; defaults to console.log yellow.
 */
export function updateGithubAllowList(
  accountKeys: Set<string>,
  homedir: string = os.homedir(),
  warnFn: WarnFn = defaultWarn,
): void {
  // Regex for existing GitHub allow-list entries — matches same character
  // class as key validator ^[a-zA-Z0-9_.-]+$ so underscore/dot/hyphen keys
  // are correctly cleaned. Must NOT use [^_]+ (would miss underscore keys, F-10).
  const GITHUB_PATTERN_RE = /^mcp__github-[a-zA-Z0-9_.-]+__\*$/;

  rewriteManagedAllowList(
    'GitHub',
    (tool) => GITHUB_PATTERN_RE.test(tool),
    new Set([...accountKeys].map((k) => `mcp__github-${k}__*`)),
    homedir,
    warnFn,
  );
}

/**
 * Rewrites the installed ~/.claude/settings.json `allowedTools` so that the
 * entries the caller manages (those for which `isManaged` returns true) are
 * exactly `desiredPatterns`: managed entries not in the desired set are
 * dropped, desired entries already present keep their position, and missing
 * ones are appended in sorted order. Unmanaged entries are untouched.
 *
 * See updateGithubAllowList for the self-containment and atomicity notes.
 *
 * @param label - Human-readable name used in warnings, e.g. "GitHub".
 */
function rewriteManagedAllowList(
  label: string,
  isManaged: (tool: string) => boolean,
  desiredPatterns: Set<string>,
  homedir: string,
  warnFn: WarnFn,
): void {
  const settingsPath = path.join(homedir, '.claude', 'settings.json');

  let raw: string;
  try {
    raw = fs.readFileSync(settingsPath, 'utf8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      warnFn(
        `Warning: ~/.claude/settings.json not found -- skipping ${label} allow-list update`,
      );
      return;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    throw new Error(
      `settings.json: invalid JSON in ${settingsPath}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`settings.json: expected a JSON object in ${settingsPath}`);
  }

  const settings = parsed as Record<string, unknown>;
  const existingTools: string[] = Array.isArray(settings['allowedTools'])
    ? (settings['allowedTools'] as string[])
    : [];

  // Partition: keep unmanaged entries and desired managed entries; drop stale managed entries
  const kept: string[] = [];
  for (const tool of existingTools) {
    if (isManaged(tool)) {
      if (desiredPatterns.has(tool)) {
        kept.push(tool);
      }
      // else: stale — drop it
    } else {
      kept.push(tool);
    }
  }

  // Append any desired patterns not already present, in sorted order
  const alreadyPresent = new Set(kept.filter((t) => isManaged(t)));
  const toAdd = [...desiredPatterns]
    .filter((p) => !alreadyPresent.has(p))
    .toSorted();
  const updatedTools = [...kept, ...toAdd];

  settings['allowedTools'] = updatedTools;

  // Atomic write via temp + rename
  const tmpPath = `${settingsPath}.tmp.${process.pid}.${randomBytes(8).toString('hex')}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, settingsPath);
  } catch (err: unknown) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Grafana per-cluster support
// ---------------------------------------------------------------------------

/**
 * Cluster ids become part of the server name `grafana-<id>` and of tool names
 * `mcp__grafana-<id>__<tool>`. Claude Code rewrites `.` (and other special
 * characters) to `_` in tool names, and treats `__` as a separator, so ids are
 * restricted to letters, digits, and hyphens to keep the allow-list and agent
 * `tools:` entries an exact match for the real tool names. mcp-grafana.sh
 * applies the same check.
 */
const GRAFANA_CLUSTER_ID_RE = /^[a-zA-Z0-9-]+$/;

/** Placeholder in agent `tools:` lines, expanded per cluster at install time. */
export const GRAFANA_AGENT_TOOLS_PLACEHOLDER = 'mcp__grafana__*';

/**
 * Removes the legacy single-cluster 'grafana' MCP server registration, which
 * was configured per session by tpk. Runs unconditionally on every install as
 * an upgrade migration; ignores failure (absent on fresh installs).
 *
 * @param spawnFn - Injectable for testing; defaults to execFileSync.
 */
export function removeLegacyGrafanaRegistration(
  spawnFn: SpawnFn = defaultSpawn,
): void {
  try {
    spawnFn('claude', ['mcp', 'remove', '-s', 'user', 'grafana']);
    console.log(c.green("Removed legacy 'grafana' MCP registration"));
  } catch {
    // Registration was not present — that is fine
  }
}

/**
 * Reads ~/.config/tpk/grafana-clusters.yaml and returns the sorted ids of the
 * clusters that get a read-only MCP server: those with a valid id, a non-empty
 * `url`, and a non-empty `viewer_token`. Clusters failing any check are skipped
 * with a warning that names the cluster, never a token. Returns [] (with a
 * warning) when the file is absent.
 *
 * Throws on malformed YAML or a file whose top level is not
 * `{ clusters: [...] }`, matching registerGithubAccounts' fail-loud handling
 * of a malformed credentials file. Error messages never include file contents.
 *
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param warnFn - Injectable for testing; defaults to console.log yellow.
 */
export function loadGrafanaViewerClusters(
  homedir: string = os.homedir(),
  warnFn: WarnFn = defaultWarn,
): string[] {
  const clustersPath = path.join(
    homedir,
    '.config',
    'tpk',
    'grafana-clusters.yaml',
  );

  let raw: string;
  try {
    raw = fs.readFileSync(clustersPath, 'utf8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      warnFn(
        'Warning: ~/.config/tpk/grafana-clusters.yaml not found -- skipping Grafana MCP setup',
      );
      return [];
    }
    throw err;
  }

  const modeStr = readFileModeOctal(clustersPath);
  if (modeStr !== null && (modeStr.replace(/^0+/, '') || '0') !== '600') {
    warnFn(
      `Warning: ~/.config/tpk/grafana-clusters.yaml mode is ${modeStr}; recommended mode is 0600.\n` +
        `Run: chmod 600 ~/.config/tpk/grafana-clusters.yaml\n` +
        `The wrapper will refuse to read this file at MCP server boot until the mode is fixed.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err: unknown) {
    // SECURITY: report the error type only — YAML errors can quote the
    // offending line, which may contain a token.
    const kind = err instanceof Error ? err.constructor.name : typeof err;
    throw new Error(
      `grafana-clusters.yaml: invalid YAML in ${clustersPath} (${kind})`,
      { cause: err },
    );
  }

  const clusters =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)['clusters']
      : undefined;
  if (!Array.isArray(clusters)) {
    throw new Error(
      `grafana-clusters.yaml: ${clustersPath} must contain a top-level 'clusters' list`,
    );
  }

  const ids = new Set<string>();
  for (const [index, entry] of clusters.entries()) {
    const cluster =
      typeof entry === 'object' && entry !== null && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};
    const id = cluster['id'];
    if (typeof id !== 'string' || !GRAFANA_CLUSTER_ID_RE.test(id)) {
      // SECURITY: identify by position — the id itself may be malformed.
      warnFn(
        `Warning: grafana-clusters.yaml cluster #${index + 1} has a missing or invalid id ` +
          `(letters, digits, and hyphens only) -- skipping`,
      );
      continue;
    }
    if (ids.has(id)) {
      warnFn(
        `Warning: grafana-clusters.yaml has a duplicate cluster id '${id}' -- skipping the repeat`,
      );
      continue;
    }
    const url = cluster['url'];
    const token = cluster['viewer_token'];
    if (typeof url !== 'string' || url.trim() === '') {
      warnFn(
        `Warning: Grafana cluster '${id}' has no url -- skipping its MCP server`,
      );
      continue;
    }
    if (typeof token !== 'string' || token.trim() === '') {
      // SECURITY: identify the offending entry by id only, never by value.
      warnFn(
        `Warning: Grafana cluster '${id}' has no viewer_token -- skipping its MCP server`,
      );
      continue;
    }
    ids.add(id);
  }

  return [...ids].toSorted();
}

/**
 * Registers one read-only `grafana-<id>` MCP server per cluster id. Only
 * GRAFANA_CLUSTER is passed as env; the wrapper resolves the url and viewer
 * token from grafana-clusters.yaml at boot, so no token reaches
 * ~/.claude.json. Each registration is removed first so re-runs are
 * idempotent.
 *
 * @param clusterIds - Validated ids from loadGrafanaViewerClusters.
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param spawnFn - Injectable for testing; defaults to execFileSync.
 * @returns Set of successfully registered cluster ids.
 */
export function registerGrafanaClusters(
  clusterIds: string[],
  homedir: string = os.homedir(),
  spawnFn: SpawnFn = defaultSpawn,
): Set<string> {
  const wrapperPath = path.join(
    homedir,
    '.claude',
    'wrappers',
    'mcp-grafana.sh',
  );
  const registered = new Set<string>();

  for (const id of clusterIds) {
    try {
      spawnFn('claude', ['mcp', 'remove', '-s', 'user', `grafana-${id}`]);
    } catch {
      // Not previously registered — fine
    }

    try {
      spawnFn('claude', [
        'mcp',
        'add',
        '-s',
        'user',
        '-t',
        'stdio',
        '-e',
        `GRAFANA_CLUSTER=${id}`,
        '--',
        `grafana-${id}`,
        wrapperPath,
      ]);
      console.log(c.green(`MCP server 'grafana-${id}' added`));
      registered.add(id);
    } catch {
      console.log(c.red(`Failed to add MCP server 'grafana-${id}'`));
    }
  }

  return registered;
}

/**
 * Removes `grafana-<id>` registrations whose id is not in desiredIds.
 *
 * @param desiredIds - The set of cluster ids currently registered.
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param spawnFn - Injectable for testing; defaults to execFileSync.
 * @param warnFn - Injectable for testing; defaults to console.log yellow.
 */
export function removeStaleGrafanaRegistrations(
  desiredIds: Set<string>,
  homedir: string = os.homedir(),
  spawnFn: SpawnFn = defaultSpawn,
  warnFn: WarnFn = defaultWarn,
): void {
  removeStalePrefixedRegistrations(
    'grafana',
    'Grafana',
    desiredIds,
    homedir,
    spawnFn,
    warnFn,
  );
}

/**
 * Sets the installed ~/.claude/settings.json allow-list to exactly one
 * `mcp__grafana-<id>__*` entry per registered cluster. Whole-server approval
 * is safe because every server runs with --disable-write on a viewer token.
 * Also drops the legacy per-tool `mcp__grafana__<tool>` entries left over from
 * the single-cluster server, which local allow-list unions would otherwise
 * keep forever.
 *
 * @param clusterIds - The set of successfully registered cluster ids.
 * @param homedir - Injectable for testing; defaults to os.homedir().
 * @param warnFn - Injectable for testing; defaults to console.log yellow.
 */
export function updateGrafanaAllowList(
  clusterIds: Set<string>,
  homedir: string = os.homedir(),
  warnFn: WarnFn = defaultWarn,
): void {
  const GRAFANA_CLUSTER_PATTERN_RE = /^mcp__grafana-[a-zA-Z0-9-]+__\*$/;
  rewriteManagedAllowList(
    'Grafana',
    (tool) =>
      tool.startsWith('mcp__grafana__') ||
      GRAFANA_CLUSTER_PATTERN_RE.test(tool),
    new Set([...clusterIds].map((id) => `mcp__grafana-${id}__*`)),
    homedir,
    warnFn,
  );
}

/**
 * Returns `content` with the GRAFANA_AGENT_TOOLS_PLACEHOLDER entry on the
 * frontmatter `tools:` line replaced by one `mcp__grafana-<id>__*` entry per
 * cluster (in the given order), or removed when there are none. The line's
 * quoting style and the order of the other entries are preserved. Returns
 * `content` unchanged when it has no frontmatter, no `tools:` line, or no
 * placeholder.
 */
export function expandGrafanaAgentTools(
  content: string,
  clusterIds: string[],
): string {
  const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(content);
  if (frontmatter === null) return content;

  const toolsLine = /^tools:[ \t]*(.*)$/m.exec(frontmatter[1]!);
  if (toolsLine === null) return content;

  const rawValue = toolsLine[1]!.trim();
  const quote = /^(["'])[\s\S]*\1$/.test(rawValue) ? rawValue[0]! : '';
  const inner = quote === '' ? rawValue : rawValue.slice(1, -1);
  const entries = inner
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e !== '');
  if (!entries.includes(GRAFANA_AGENT_TOOLS_PLACEHOLDER)) return content;

  const expanded = entries.flatMap((e) =>
    e === GRAFANA_AGENT_TOOLS_PLACEHOLDER
      ? clusterIds.map((id) => `mcp__grafana-${id}__*`)
      : [e],
  );
  const newLine = `tools: ${quote}${expanded.join(', ')}${quote}`;

  // Offsets: frontmatter body starts after the opening "---\n" (4 chars).
  const lineStart = 4 + toolsLine.index;
  const lineEnd = lineStart + toolsLine[0].length;
  return content.slice(0, lineStart) + newLine + content.slice(lineEnd);
}

/**
 * Applies expandGrafanaAgentTools to every installed agent in
 * ~/.claude/agents/, so agents that restrict their tools can reach the
 * per-cluster servers (Claude Code allows no wildcard in the server-name
 * segment, so `mcp__grafana-*__*` would match nothing). The agents directory
 * is re-copied from the repo on every install, so the placeholder is always
 * present to expand.
 *
 * @param clusterIds - The set of successfully registered cluster ids.
 * @param homedir - Injectable for testing; defaults to os.homedir().
 */
export function updateGrafanaAgentTools(
  clusterIds: Set<string>,
  homedir: string = os.homedir(),
): void {
  const agentsDir = path.join(homedir, '.claude', 'agents');
  let names: string[];
  try {
    names = fs.readdirSync(agentsDir);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return;
    }
    throw err;
  }

  const ids = [...clusterIds].toSorted();
  for (const name of names.filter((n) => n.endsWith('.md')).toSorted()) {
    const agentPath = path.join(agentsDir, name);
    const content = fs.readFileSync(agentPath, 'utf8');
    const updated = expandGrafanaAgentTools(content, ids);
    if (updated !== content) {
      fs.writeFileSync(agentPath, updated, 'utf8');
      console.log(
        c.green(`Expanded Grafana tools for agent '${name}' (${ids.length})`),
      );
    }
  }
}

export function installMcpServers(repoRoot: string): void {
  // Check claude CLI availability
  try {
    execFileSync('claude', ['--version'], { stdio: 'pipe' });
  } catch {
    console.log(c.yellow('Skipping MCP server setup (claude CLI not found)'));
    return;
  }

  const stamps = readStamps(STAMPS_PATH);
  const updatedStamps: Record<string, string> = { ...stamps };

  const servers = loadMcpServers(repoRoot);

  // Collect wrapper server names for stale stamp cleanup after the loop.
  const wrapperServerNames = new Set(
    servers.filter((s) => s.wrapper !== undefined).map((s) => s.name),
  );

  console.log(c.blue('Configuring MCP servers (user scope)...'));

  for (const server of servers) {
    if (server.wrapper !== undefined) {
      // Wrapper-based servers: stamp-aware skip or remove-then-re-add.
      const signature = computeConfigSignature(server, repoRoot);

      if (stamps[server.name] === signature) {
        // Stamp matches — check that the registration is actually present.
        try {
          execFileSync('claude', ['mcp', 'get', server.name], {
            stdio: 'pipe',
          });
          console.log(
            c.green(`MCP server '${server.name}' already configured, skipping`),
          );
          continue;
        } catch {
          // Stamp is current but registration is missing — re-add without removing first.
          console.log(
            c.yellow(
              `MCP server '${server.name}' stamp is current but registration is missing, re-adding`,
            ),
          );
        }
      } else {
        // Stamp is absent or stale — remove any existing registration and re-add.
        try {
          execFileSync('claude', ['mcp', 'remove', server.name], {
            stdio: 'pipe',
          });
        } catch {
          // Server was not registered — that is fine, proceed to add
        }
      }

      // Check prereq
      if (server.prereq !== undefined) {
        try {
          fs.statSync(expandVars(server.prereq));
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            (err as NodeJS.ErrnoException).code === 'ENOENT'
          ) {
            // prereq check is advisory: warn if missing, but always proceed to add
            console.log(
              c.yellow(
                `Warning: ${expandVars(server.prereq)} not found -- ${server.name} MCP will fail until this file is created`,
              ),
            );
          }
        }
      }

      // Add the server
      try {
        execFileSync(
          'claude',
          ['mcp', 'add', ...buildAddArgs(server, repoRoot)],
          {
            stdio: 'pipe',
          },
        );
        updatedStamps[server.name] = signature;
        console.log(c.green(`MCP server '${server.name}' added`));
      } catch {
        delete updatedStamps[server.name];
        console.log(c.red(`Failed to add MCP server '${server.name}'`));
      }
    } else {
      // Command-based servers: skip if already configured
      try {
        execFileSync('claude', ['mcp', 'get', server.name], { stdio: 'pipe' });
        console.log(
          c.green(`MCP server '${server.name}' already configured, skipping`),
        );
        continue;
      } catch {
        // Not yet configured — proceed
      }

      // Check prereq
      if (server.prereq !== undefined) {
        try {
          fs.statSync(expandVars(server.prereq));
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            (err as NodeJS.ErrnoException).code === 'ENOENT'
          ) {
            // prereq check is advisory: warn if missing, but always proceed to add
            console.log(
              c.yellow(
                `Warning: ${expandVars(server.prereq)} not found -- ${server.name} MCP will fail until this file is created`,
              ),
            );
          }
        }
      }

      // Add the server
      try {
        execFileSync(
          'claude',
          ['mcp', 'add', ...buildAddArgs(server, repoRoot)],
          {
            stdio: 'pipe',
          },
        );
        console.log(c.green(`MCP server '${server.name}' added`));
      } catch {
        console.log(c.red(`Failed to add MCP server '${server.name}'`));
      }
    }
  }

  // Remove stale stamps for servers no longer in the config.
  for (const key of Object.keys(updatedStamps)) {
    if (!wrapperServerNames.has(key)) {
      delete updatedStamps[key];
    }
  }

  writeStamps(STAMPS_PATH, updatedStamps);

  // GitHub multi-account registration sequence.
  // Runs after wrapper-copy completes (installDir in main.ts:29 ran before us).
  assertWrappersDirNotWorldWritable(); // V-5: warn if wrappers dir is group/world-writable
  removeLegacyGithubRegistration(); // unconditional upgrade migration
  const registeredKeys = registerGithubAccounts(); // may be empty
  removeStaleGithubRegistrations(registeredKeys); // clean even when empty
  updateGithubAllowList(registeredKeys); // clean even when empty

  // Grafana per-cluster registration sequence (read-only, one server per
  // cluster with a viewer_token). Same shape as the GitHub sequence above,
  // plus agent `tools:` expansion. The settings merge and agent copy ran
  // before us (installClaudeWhitelist in main.ts), so we edit installed files.
  removeLegacyGrafanaRegistration(); // unconditional upgrade migration
  const grafanaIds = registerGrafanaClusters(loadGrafanaViewerClusters());
  removeStaleGrafanaRegistrations(grafanaIds); // clean even when empty
  updateGrafanaAllowList(grafanaIds); // clean even when empty
  updateGrafanaAgentTools(grafanaIds); // expand placeholder even when empty
}
