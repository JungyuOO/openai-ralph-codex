import { describe, expect, test } from 'vitest';
import {
  findContextBlockedTask,
  isTaskWithinContextBudget,
  pickNextTask,
  scoreTaskPriority,
} from '../../src/core/scheduler.js';
import { ContextConfigSchema } from '../../src/schemas/config.js';
import { TaskGraphSchema, type TaskGraph } from '../../src/schemas/tasks.js';

function graph(
  tasks: Array<{
    id: string;
    status?: 'pending' | 'in_progress' | 'done' | 'blocked' | 'failed';
    dependsOn?: string[];
    contextFiles?: string[];
    estimatedLoad?: number;
    crossLayer?: boolean;
    splitRecommended?: boolean;
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
      contextFiles: t.contextFiles ?? [],
      estimatedLoad: t.estimatedLoad ?? 0,
      crossLayer: t.crossLayer ?? false,
      splitRecommended: t.splitRecommended ?? false,
    })),
  });
}

describe('pickNextTask', () => {
  test('returns the first pending task with no deps', () => {
    const g = graph([{ id: 'T001' }, { id: 'T002' }]);
    expect(pickNextTask(g)?.id).toBe('T001');
  });

  test('prefers narrower runnable work over broader work', () => {
    const g = graph([
      {
        id: 'T001',
        contextFiles: ['src/commands/run.ts', 'src/core/verify-runner.ts'],
        estimatedLoad: 0.61,
        crossLayer: true,
        splitRecommended: true,
      },
      {
        id: 'T002',
        contextFiles: ['src/core/scheduler.ts'],
        estimatedLoad: 0.18,
      },
    ]);

    expect(pickNextTask(g)?.id).toBe('T002');
    expect(scoreTaskPriority(g.tasks[1], g)).toBeGreaterThan(scoreTaskPriority(g.tasks[0], g));
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

  test('prefers runnable tasks that unlock more downstream work when cost is similar', () => {
    const g = graph([
      { id: 'T001', estimatedLoad: 0.2 },
      { id: 'T002', estimatedLoad: 0.2 },
      { id: 'T003', dependsOn: ['T001'] },
      { id: 'T004', dependsOn: ['T001'] },
      { id: 'T005', dependsOn: ['T002'] },
    ]);

    expect(pickNextTask(g)?.id).toBe('T001');
    expect(scoreTaskPriority(g.tasks[0], g)).toBeGreaterThan(scoreTaskPriority(g.tasks[1], g));
  });

  test('skips runnable tasks that exceed the current context budget', () => {
    const g = graph([
      {
        id: 'T001',
        contextFiles: ['src/commands/run.ts'],
        estimatedLoad: 0.2,
      },
      {
        id: 'T002',
        contextFiles: ['src/commands/run.ts', 'src/core/verify-runner.ts'],
        estimatedLoad: 0.8,
        crossLayer: true,
      },
      { id: 'T003', estimatedLoad: 0.25 },
    ]);
    const context = ContextConfigSchema.parse({
      max_estimated_load: 0.5,
      split_if_files_over: 4,
      split_if_cross_layer: true,
    });
    expect(pickNextTask(g, context)?.id).toBe('T001');
  });

  test('surfaces the blocked task when no runnable task fits the context budget', () => {
    const g = graph([
      {
        id: 'T001',
        contextFiles: ['src/commands/run.ts'],
        estimatedLoad: 0.62,
        crossLayer: false,
      },
      {
        id: 'T002',
        contextFiles: ['src/commands/run.ts', 'src/core/verify-runner.ts', 'tests/commands/run.test.ts'],
        estimatedLoad: 0.62,
        crossLayer: true,
        splitRecommended: true,
      },
    ]);
    const context = ContextConfigSchema.parse({
      max_estimated_load: 0.4,
      split_if_files_over: 2,
      split_if_cross_layer: true,
    });
    expect(pickNextTask(g, context)).toBeUndefined();
    expect(findContextBlockedTask(g, context)?.id).toBe('T001');
    expect(isTaskWithinContextBudget(g.tasks[0], context)).toBe(false);
  });
});
