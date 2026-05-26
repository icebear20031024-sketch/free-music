import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pluginManager } from './plugin-manager.js';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    access: vi.fn(),
    writeFile: vi.fn(),
  }
}));

describe('PluginManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format all plugins entries', () => {
    const plugins = pluginManager.getAllPlugins();
    // initially loadedPlugins is empty until initialize runs
    expect(plugins).toEqual([]);
  });

  it('should return undefined for unknown plugin', () => {
    expect(pluginManager.getPlugin('unknown-plugin')).toBeUndefined();
  });
});
