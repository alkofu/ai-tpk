import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAgentLine, resolveSavedAgent } from './agent.js';
import type { LauncherConfig } from './types.js';

// ---------------------------------------------------------------------------
// resolveSavedAgent
// ---------------------------------------------------------------------------

describe('resolveSavedAgent', () => {
  it("returns 'dungeonmaster' when agent is absent (configs saved before agent selection existed)", () => {
    const config: LauncherConfig = { selectedMcps: [] };
    assert.strictEqual(resolveSavedAgent(config), 'dungeonmaster');
  });

  it("returns 'dungeonmaster' when agent is 'dungeonmaster'", () => {
    const config: LauncherConfig = { selectedMcps: [], agent: 'dungeonmaster' };
    assert.strictEqual(resolveSavedAgent(config), 'dungeonmaster');
  });

  it("returns 'default' when agent is 'default'", () => {
    const config: LauncherConfig = { selectedMcps: [], agent: 'default' };
    assert.strictEqual(resolveSavedAgent(config), 'default');
  });

  it("returns 'dungeonmaster' when agent holds an unrecognised value", () => {
    const config = {
      selectedMcps: [],
      agent: 'pathfinder',
    } as unknown as LauncherConfig;
    assert.strictEqual(resolveSavedAgent(config), 'dungeonmaster');
  });
});

// ---------------------------------------------------------------------------
// formatAgentLine
// ---------------------------------------------------------------------------

describe('formatAgentLine', () => {
  it('shows Dungeon Master when agent is absent', () => {
    const config: LauncherConfig = { selectedMcps: [] };
    assert.strictEqual(formatAgentLine(config), 'Agent: Dungeon Master');
  });

  it("shows Default Claude when agent is 'default'", () => {
    const config: LauncherConfig = { selectedMcps: [], agent: 'default' };
    assert.strictEqual(formatAgentLine(config), 'Agent: Default Claude');
  });
});
