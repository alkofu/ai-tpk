import * as fs from 'node:fs';
import * as os from 'node:os';
import { c } from './colors.js';
import { backupIfExists, installPath } from './fs-utils.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keys whose array values are combined via set-union (rather than replaced
// wholesale) by deepMergeJson. Only `allowedTools` is included: it is a
// flat, set-like list of tool-permission patterns where local additions
// should survive reinstalls. `hooks.*` arrays are deliberately excluded —
// a value-based union would duplicate a repo hook whenever the template
// changes it (the stale live copy no longer matches). Hooks are instead
// merged by ownership in `mergeHooks`, applied by `installMergedJson`. The whitelist
// matches by key name at any nesting depth, which is safe today because
// `allowedTools` only ever appears at the top level of settings.json.
const ARRAY_UNION_KEYS = new Set(['allowedTools']);

/**
 * Returns the set-union of `overlay` and `base`, deduplicated by value
 * (via `JSON.stringify` equality, which is robust for future non-string
 * entries and correct for the current string entries). Ordering is
 * `overlay` entries first (in their original order), followed by any
 * `base`-only entries. Duplicates are removed regardless of which array
 * (or both) they originated from, including duplicates within a single
 * input array. Neither input is mutated.
 */
function unionArrays(base: unknown[], overlay: unknown[]): unknown[] {
  const seen = new Set<string>();
  const result: unknown[] = [];
  for (const value of [...overlay, ...base]) {
    const key = JSON.stringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

/**
 * Recursively merges `overlay` onto `base`, returning a new object.
 *
 * For every key in `overlay`: if both `base[key]` and `overlay[key]` are
 * plain (non-array) objects, they are merged recursively; if `key` is in
 * `arrayUnionKeys` and both values are arrays, they are combined via
 * `unionArrays` (template entries first, then live-only entries,
 * deduplicated); otherwise `overlay[key]` replaces `base[key]` wholesale
 * (scalars, non-whitelisted arrays, and `null` all replace rather than
 * combine). Keys present only in `base` are carried through unchanged.
 * Neither input is mutated.
 *
 * This is intentionally a 2-way "template overlays live" merge, not a
 * 3-way merge: it has no concept of a prior common ancestor, so a key
 * that the template used to define and has since removed will NOT be
 * removed from an already-installed live file (only additions and
 * value-changes propagate). This applies to whitelisted array unions too:
 * template entries removed from a whitelisted array are not pruned from an
 * already-installed live file. This is a known, accepted non-goal.
 */
export function deepMergeJson(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
  arrayUnionKeys: Set<string> = ARRAY_UNION_KEYS,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(overlay)) {
    const baseValue = base[key];
    const overlayValue = overlay[key];

    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      result[key] = deepMergeJson(baseValue, overlayValue, arrayUnionKeys);
    } else if (
      arrayUnionKeys.has(key) &&
      Array.isArray(baseValue) &&
      Array.isArray(overlayValue)
    ) {
      result[key] = unionArrays(baseValue, overlayValue);
    } else {
      result[key] = overlayValue;
    }
  }

  return result;
}

/**
 * Returns true when `hook` runs a script from the installed
 * `~/.claude/hooks/` directory, written as `~`, `$HOME`, `${HOME}`, or the
 * absolute home path. The installer replaces that directory wholesale, so
 * every such hook is repo-owned; any other hook (e.g. a terminal integration
 * added by another tool) is user-owned.
 */
export function isRepoManagedHook(
  hook: unknown,
  homedir: string = os.homedir(),
): boolean {
  if (!isPlainObject(hook) || typeof hook.command !== 'string') return false;
  const command = hook.command;
  const homeForms = ['~', '$HOME', '${HOME}'];
  if (homedir !== '') homeForms.push(homedir);
  return homeForms.some((home) => command.includes(`${home}/.claude/hooks/`));
}

/**
 * Removes repo-owned hooks from a live event's matcher groups. A group left
 * with no hooks is dropped; groups whose shape is not recognized (not an
 * object, or no `hooks` array) are kept unchanged. Inputs are not mutated.
 */
function stripRepoManagedHooks(groups: unknown[], homedir: string): unknown[] {
  const result: unknown[] = [];
  for (const group of groups) {
    if (!isPlainObject(group) || !Array.isArray(group.hooks)) {
      result.push(group);
      continue;
    }
    const kept = group.hooks.filter((h) => !isRepoManagedHook(h, homedir));
    if (kept.length > 0) result.push({ ...group, hooks: kept });
  }
  return result;
}

/**
 * Merges the `hooks` object of settings.json by ownership rather than by
 * value. For each event:
 *
 * - repo-owned hooks (see `isRepoManagedHook`) are taken from the template
 *   only, so template changes and removals propagate without duplicates;
 * - user-owned live hooks are kept, appended after the template's groups.
 *
 * An event the template does not define keeps its user-owned hooks and is
 * dropped if none remain, so a hook removed from the template does not leave
 * a live entry pointing at a script the installer no longer ships. A live
 * event value that is not an array is kept as-is unless the template
 * defines that event. Neither input is mutated.
 */
export function mergeHooks(
  live: Record<string, unknown>,
  template: Record<string, unknown>,
  homedir: string = os.homedir(),
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const events = new Set([...Object.keys(template), ...Object.keys(live)]);

  for (const event of events) {
    const templateValue = template[event];
    const liveValue = live[event];
    const userGroups = Array.isArray(liveValue)
      ? stripRepoManagedHooks(liveValue, homedir)
      : [];

    if (Array.isArray(templateValue)) {
      result[event] = [...templateValue, ...userGroups];
    } else if (event in template) {
      result[event] = templateValue;
    } else if (!Array.isArray(liveValue)) {
      result[event] = liveValue;
    } else if (userGroups.length > 0) {
      result[event] = userGroups;
    }
  }

  return result;
}

/**
 * Installs a JSON file at `dest`, merging it with the pre-existing live
 * file at `dest` (if any) rather than overwriting it wholesale.
 *
 * - If `dest` does not exist, the template at `src` is written verbatim.
 * - If `dest` exists and parses to a plain JSON object, the merged result
 *   (`deepMergeJson(live, template)`) is written, with the prior file
 *   preserved via `backupIfExists`. When both files define a `hooks`
 *   object, it is merged with `mergeHooks` instead, so user-owned hooks
 *   survive the reinstall.
 * - If `dest` exists but is malformed JSON, or parses to a non-object
 *   (e.g. a scalar or array), this falls back to the existing
 *   overwrite-with-backup behavior of `installPath` rather than
 *   attempting to merge non-object/malformed live data.
 */
export function installMergedJson(src: string, dest: string): void {
  // The template is repo-controlled and expected to always be valid JSON;
  // a parse failure here indicates a repo-side bug, so we deliberately let
  // it throw rather than silently falling back.
  const template = JSON.parse(fs.readFileSync(src, 'utf8')) as unknown;

  let live: unknown;
  try {
    live = JSON.parse(fs.readFileSync(dest, 'utf8'));
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      console.log(c.green(`Copying: ${src} -> ${dest}`));
      backupIfExists(dest);
      fs.writeFileSync(dest, JSON.stringify(template, null, 2) + '\n');
      return;
    }
    console.log(
      c.yellow(`Existing ${dest} is not valid JSON; falling back to overwrite`),
    );
    installPath(src, dest);
    return;
  }

  if (!isPlainObject(live) || !isPlainObject(template)) {
    console.log(
      c.yellow(
        `Existing ${dest} is not a JSON object; falling back to overwrite`,
      ),
    );
    installPath(src, dest);
    return;
  }

  const merged = deepMergeJson(live, template);
  if (isPlainObject(live.hooks) && isPlainObject(template.hooks)) {
    merged.hooks = mergeHooks(live.hooks, template.hooks);
  }
  backupIfExists(dest);
  console.log(c.green(`Merging: ${src} -> ${dest}`));
  fs.writeFileSync(dest, JSON.stringify(merged, null, 2) + '\n');
}
