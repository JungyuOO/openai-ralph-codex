import { describe, expect, test } from 'vitest';
import { pickNextTask } from '../../src/core/scheduler.js';
import { TaskGraphSchema, type TaskGraph } from '../../src/schemas/tasks.js';

function graph(
  tasks: Array<{
    id: string;
    status?: 'pending' | 'in_progress' | 'done' | 'blocked' | 'failed';
    dependsOn?: string[];
  }>,
): TaskGraph {
  return TaskGraphSchema.parse({
    version: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    source: 'test',
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.id,
      description: '',
      dependsOn: t.dependsOn ?? [],
      status: t.status ?? 'pending',
      retryCount: 0,
    })),
  });
}

describe('pickNextTask', () => {
  test('returns the first pending task with no deps', () => {
    const g = graph([{ id: 'T001' }, { id: 'T002' }]);
    expect(pickNextTask(g)?.id).toBe('T001');
  });

  test('skips tasks whose deps are not done', () => {
    const g = graph([
      { id: 'T001', dependsOn: ['T002'] },
      { id: 'T002', status: 'pending' },
    ]);
    expect(pickNextTask(g)?.id).toBe('T002');
  });

  test('returns undefined when nothing is runnable', () => {
    const g = graph([
      { id: 'T001', status: 'done' },
      { id: 'T002', status: 'done' },
    ]);
    expect(pickNextTask(g)).toBeUndefined();
  });

  test('returns undefined when all pending tasks are blocked by unmet deps', () => {
    const g = graph([
      { id: 'T001', status: 'failed' },
      { id: 'T002', dependsOn: ['T001'] },
    ]);
    expect(pickNextTask(g)).toBeUndefined();
  });

  test('picks the next task after deps are done', () => {
    const g = graph([
      { id: 'T001', status: 'done' },
      { id: 'T002', dependsOn: ['T001'] },
    ]);
    expect(pickNextTask(g)?.id).toBe('T002');
  });
});
