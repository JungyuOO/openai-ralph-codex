import { describe, expect, test } from 'vitest';
import { ConfigSchema } from '../../src/schemas/config.js';

describe('ConfigSchema', () => {
  test('applies defaults to empty object', () => {
    const cfg = ConfigSchema.parse({});
    expect(cfg.version).toBe(1);
    expect(cfg.runner.type).toBe('codex-cli');
    expect(cfg.runner.command).toBe('codex');
    expect(cfg.runner.args).toEqual([]);
    expect(cfg.verification.commands).toEqual([]);
    expect(cfg.recovery.max_retries_per_task).toBe(2);
  });

  test('accepts the tracked example shape', () => {
    const cfg = ConfigSchema.parse({
      version: 1,
      runner: { type: 'codex-cli', command: 'codex' },
      project: {
        language: 'en',
        prd_path: '.ralph/prd.md',
      },
      verification: {
        commands: ['npm run lint', 'npm test'],
        strict: false,
      },
    });
    expect(cfg.verification.commands).toHaveLength(2);
    expect(cfg.project.language).toBe('en');
  });

  test('rejects unknown runner type', () => {
    expect(() =>
      ConfigSchema.parse({ runner: { type: 'bogus', command: 'x' } }),
    ).toThrow();
  });

  test('rejects context max_estimated_load above 1', () => {
    expect(() =>
      ConfigSchema.parse({ context: { max_estimated_load: 1.5 } }),
    ).toThrow();
  });

  test('rejects negative split_if_files_over', () => {
    expect(() =>
      ConfigSchema.parse({ context: { split_if_files_over: -1 } }),
    ).toThrow();
  });
});
