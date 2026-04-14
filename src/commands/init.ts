import path from 'node:path';
import { ralphPaths } from '../utils/paths.js';
import {
  copyIfMissing,
  ensureDir,
  exists,
  writeJson,
  writeTextUtf8,
} from '../utils/fs.js';
import { StateSchema, createInitialState } from '../schemas/state.js';
import { TaskGraphSchema, createEmptyTaskGraph } from '../schemas/tasks.js';

export interface InitOptions {
  cwd?: string;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  await ensureDir(p.root);

  const created: string[] = [];
  const skipped: string[] = [];

  const templates: Array<[string, string]> = [
    [p.configExample, p.config],
    [p.prdExample, p.prd],
    [p.contextMapExample, p.contextMap],
  ];

  for (const [src, dest] of templates) {
    if (!(await exists(src))) {
      throw new Error(
        `Missing template: ${path.relative(cwd, src)}. ` +
          'Ensure tracked example files are present in .ralph/.',
      );
    }
    const didCopy = await copyIfMissing(src, dest);
    (didCopy ? created : skipped).push(path.relative(cwd, dest));
  }

  if (!(await exists(p.state))) {
    const state = StateSchema.parse(createInitialState());
    await writeJson(p.state, state);
    created.push(path.relative(cwd, p.state));
  } else {
    skipped.push(path.relative(cwd, p.state));
  }

  if (!(await exists(p.tasks))) {
    const graph = TaskGraphSchema.parse(createEmptyTaskGraph('.ralph/prd.md'));
    await writeJson(p.tasks, graph);
    created.push(path.relative(cwd, p.tasks));
  } else {
    skipped.push(path.relative(cwd, p.tasks));
  }

  if (!(await exists(p.progress))) {
    const header = `# Progress\n\n- ${new Date().toISOString()} — project initialized\n`;
    await writeTextUtf8(p.progress, header);
    created.push(path.relative(cwd, p.progress));
  } else {
    skipped.push(path.relative(cwd, p.progress));
  }

  console.log('Ralph initialized.');
  if (created.length > 0) {
    console.log('Created:');
    for (const f of created) console.log(`  + ${f}`);
  }
  if (skipped.length > 0) {
    console.log('Skipped (already exists):');
    for (const f of skipped) console.log(`  = ${f}`);
  }
  console.log('');
  console.log('Next: run `ralph plan` to generate the initial task graph.');
}
