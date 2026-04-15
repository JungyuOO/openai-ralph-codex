import { describe, expect, test } from 'vitest';
import { compileTaskContract } from '../../src/core/task-contract.js';

describe('compileTaskContract', () => {
  test('keeps explicit acceptance criteria and derives command hints', () => {
    const compiled = compileTaskContract({
      title: 'Add scheduler coverage',
      description: 'Update tests and ensure typecheck/build pass.',
      acceptanceCriteria: [
        'Scheduler tests pass',
        'Typecheck passes',
      ],
    });

    expect(compiled.acceptanceCriteria).toEqual([
      'Scheduler tests pass',
      'Typecheck passes',
    ]);
    expect(compiled.verificationHints.commands).toContain('npm test');
    expect(compiled.verificationHints.commands).toContain('npm run typecheck');
    expect(compiled.verificationHints.commands).toContain('npm run build');
  });

  test('falls back to the task title when no explicit criteria exist', () => {
    const compiled = compileTaskContract({
      title: 'Verify the API response in the browser',
      description: '',
      acceptanceCriteria: [],
    });

    expect(compiled.acceptanceCriteria).toEqual([
      'Verify the API response in the browser',
    ]);
    expect(compiled.verificationHints.notes).toContain(
      'Include a browser or visual check if the change affects UI behavior.',
    );
  });
});
