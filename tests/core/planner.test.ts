import { describe, expect, test } from 'vitest';
import { ContextConfigSchema } from '../../src/schemas/config.js';
import { planTaskGraph } from '../../src/core/planner.js';

describe('planTaskGraph', () => {
  test('adds context metadata from explicit file references', () => {
    const graph = planTaskGraph({
      prdText: [
        '## Acceptance Criteria',
        '- Update `src/commands/run.ts`, `src/core/verify-runner.ts`, and `tests/commands/run.test.ts`',
      ].join('\n'),
      context: ContextConfigSchema.parse({
        max_estimated_load: 0.4,
        split_if_files_over: 2,
        split_if_cross_layer: true,
      }),
      contextMapText: '# Context Map\n',
    });

    expect(graph.tasks).toHaveLength(1);
    expect(graph.tasks[0].contextFiles).toEqual([
      'src/commands/run.ts',
      'src/core/verify-runner.ts',
      'tests/commands/run.test.ts',
    ]);
    expect(graph.tasks[0].crossLayer).toBe(true);
    expect(graph.tasks[0].estimatedLoad).toBeGreaterThan(0.4);
    expect(graph.tasks[0].splitRecommended).toBe(true);
  });

  test('infers relevant context refs from the context map when the PRD omits paths', () => {
    const graph = planTaskGraph({
      prdText: [
        '## Acceptance Criteria',
        '- Add a command status summary',
      ].join('\n'),
      context: ContextConfigSchema.parse({}),
      contextMapText: [
        '# Context Map',
        '- `src/commands/`: CLI entrypoints',
        '- `src/cli.ts`: main registration',
        '- `src/core/`: orchestration logic',
      ].join('\n'),
    });

    expect(graph.tasks[0].contextFiles).toContain('src/commands/');
    expect(graph.tasks[0].estimatedLoad).toBeGreaterThan(0);
    expect(graph.tasks[0].splitRecommended).toBe(false);
  });
});
