import { describe, expect, test } from 'vitest';
import { TaskSchema, TaskGraphSchema } from '../../src/schemas/tasks.js';

describe('TaskSchema', () => {
  test('applies defaults to minimal input', () => {
    const parsed = TaskSchema.parse({ id: 'T001', title: 'hello' });
    expect(parsed.status).toBe('pending');
    expect(parsed.retryCount).toBe(0);
    expect(parsed.dependsOn).toEqual([]);
    expect(parsed.description).toBe('');
  });

  test('rejects unknown status', () => {
    expect(() =>
      TaskSchema.parse({ id: 'T001', title: 'x', status: 'bogus' }),
    ).toThrow();
  });

  test('rejects negative retryCount', () => {
    expect(() =>
      TaskSchema.parse({ id: 'T001', title: 'x', retryCount: -1 }),
    ).toThrow();
  });
});

describe('TaskGraphSchema', () => {
  test('parses a minimal graph', () => {
    const graph = TaskGraphSchema.parse({
      version: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      source: '.ralph/prd.md',
      tasks: [{ id: 'T001', title: 'x' }],
    });
    expect(graph.tasks[0].status).toBe('pending');
    expect(graph.tasks[0].retryCount).toBe(0);
  });

  test('requires version 1', () => {
    expect(() =>
      TaskGraphSchema.parse({
        version: 2,
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: '.ralph/prd.md',
        tasks: [],
      }),
    ).toThrow();
  });
});
