/** Sub-directories of claude/ installed into ~/.claude */
export const CLAUDE_WHITELIST_DIRS: readonly string[] = [
  'skills',
  'agents',
  'hooks',
  'commands',
  'references',
  'scripts',
];

/** Standalone files of claude/ installed into ~/.claude */
export const CLAUDE_WHITELIST_FILES: readonly string[] = [
  'settings.json',
  'CLAUDE.md',
];

/** Minimum Node.js version required by install.sh (major.minor) */
export const NODE_MIN_VERSION = '18.18.0';
