import { describe, expect, test } from 'vitest';
import { extractTasksFromPrd, bulletsUnder } from '../../src/core/prd-parse.js';

describe('extractTasksFromPrd', () => {
  test('extracts bullets under "## Acceptance Criteria"', () => {
    const prd = [
      '# Title',
      '',
      '## Acceptance Criteria',
      '- first thing',
      '- second thing',
      '',
      '## Other',
      '- unrelated',
      '',
    ].join('\n');
    const tasks = extractTasksFromPrd(prd);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ id: 'T001', title: 'first thing' });
    expect(tasks[1]).toMatchObject({ id: 'T002', title: 'second thing' });
    expect(tasks[0].retryCount).toBe(0);
    expect(tasks[0].dependsOn).toEqual([]);
  });

  test('falls back to "### In scope" when no acceptance criteria', () => {
    const prd = [
      '# Title',
      '## Scope',
      '### In scope',
      '- alpha',
      '- beta',
      '### Out of scope',
      '- gamma',
    ].join('\n');
    const tasks = extractTasksFromPrd(prd);
    expect(tasks.map((t) => t.title)).toEqual(['alpha', 'beta']);
  });

  test('returns empty when neither section exists', () => {
    const prd = '# Title\n\n- orphan bullet\n';
    expect(extractTasksFromPrd(prd)).toEqual([]);
  });

  test('handles CRLF line endings', () => {
    const prd = '## Acceptance Criteria\r\n- win thing\r\n- other\r\n';
    const tasks = extractTasksFromPrd(prd);
    expect(tasks.map((t) => t.title)).toEqual(['win thing', 'other']);
  });
});

describe('bulletsUnder', () => {
  test('stops at the next heading of any level', () => {
    const text = '## A\n- a1\n- a2\n### B\n- b1\n';
    expect(bulletsUnder(text, /^##\s+A\s*$/im)).toEqual(['a1', 'a2']);
  });

  test('ignores lines outside the section', () => {
    const text = '- before\n## A\n- inside\n';
    expect(bulletsUnder(text, /^##\s+A\s*$/im)).toEqual(['inside']);
  });
});
