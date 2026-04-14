import { describe, expect, test } from 'vitest';
import { runCodexCli } from '../../src/runners/codex-cli.js';

const smokeTest = process.env.RUN_CODEX_SMOKE === '1' ? test : test.skip;

describe('runCodexCli smoke', () => {
  smokeTest(
    'can drive a real Codex CLI exec session',
    async () => {
      const result = await runCodexCli({
        command: 'codex',
        args: [
          'exec',
          '--skip-git-repo-check',
          '--ephemeral',
          '--color',
          'never',
          '-C',
          process.cwd(),
        ],
        cwd: process.cwd(),
        stdin: 'Reply with exactly OK.\nDo not use tools.\n',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK');
      expect(result.stderr).not.toContain('Error:');
    },
    120_000,
  );
});
