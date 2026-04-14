import { describe, expect, test } from 'vitest';
import {
  buildShellCommand,
  shouldUseShellForRunner,
} from '../../src/runners/codex-cli.js';

describe('shouldUseShellForRunner', () => {
  test('uses shell for bare commands on Windows', () => {
    expect(shouldUseShellForRunner('codex', 'win32')).toBe(true);
  });

  test('uses shell for .cmd shims on Windows', () => {
    expect(shouldUseShellForRunner('codex.cmd', 'win32')).toBe(true);
  });

  test('does not use shell for regular binaries on non-Windows platforms', () => {
    expect(shouldUseShellForRunner('codex', 'linux')).toBe(false);
    expect(shouldUseShellForRunner('codex', 'darwin')).toBe(false);
  });

  test('quotes shell arguments with spaces for Windows shell mode', () => {
    expect(
      buildShellCommand('codex', ['exec', '-C', 'C:/Users/Test User/project']),
    ).toBe('codex exec -C "C:/Users/Test User/project"');
  });
});
