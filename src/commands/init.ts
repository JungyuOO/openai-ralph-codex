import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ralphPaths } from '../utils/paths.js';
import {
  copyIfMissing,
  ensureDir,
  exists,
  writeJson,
  writeTextUtf8,
} from '../utils/fs.js';
import { createInitialDistilledMemory, DistilledMemorySchema } from '../schemas/memory.js';
import { StateSchema, createInitialState } from '../schemas/state.js';
import { TaskGraphSchema, createEmptyTaskGraph } from '../schemas/tasks.js';

export interface InitOptions {
  cwd?: string;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);
  const bundled = bundledTemplatePaths();

  await ensureDir(p.root);

  const created: string[] = [];
  const skipped: string[] = [];

  const templates: Array<[string, string, string]> = [
    [p.configExample, p.config, bundled.configExample],
    [p.prdExample, p.prd, bundled.prdExample],
    [p.contextMapExample, p.contextMap, bundled.contextMapExample],
  ];

  for (const [projectExample, dest, fallbackExample] of templates) {
    let source = projectExample;
    if (!(await exists(projectExample))) {
      if (!(await exists(fallbackExample))) {
        throw new Error(
          `Missing template: ${path.relative(cwd, projectExample)}. ` +
            'Ensure tracked example files are present in .ralph/ or bundled with the package.',
        );
      }
      await copyIfMissing(fallbackExample, projectExample);
      created.push(path.relative(cwd, projectExample));
      source = projectExample;
    }

    if (!(await exists(source))) {
      throw new Error(
        `Missing template: ${path.relative(cwd, source)}. ` +
          'Ensure tracked example files are present in .ralph/.',
      );
    }
    const didCopy = await copyIfMissing(source, dest);
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
    const header = `# Progress\n\n- ${new Date().toISOString()} ??project initialized\n`;
    await writeTextUtf8(p.progress, header);
    created.push(path.relative(cwd, p.progress));
  } else {
    skipped.push(path.relative(cwd, p.progress));
  }

  if (!(await exists(p.distilledMemory))) {
    const memory = DistilledMemorySchema.parse(createInitialDistilledMemory());
    await writeJson(p.distilledMemory, memory);
    created.push(path.relative(cwd, p.distilledMemory));
  } else {
    skipped.push(path.relative(cwd, p.distilledMemory));
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

function bundledTemplatePaths() {
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../',
  );
  return {
    configExample: path.join(packageRoot, '.ralph', 'config.example.yaml'),
    prdExample: path.join(packageRoot, '.ralph', 'prd.example.md'),
    contextMapExample: path.join(packageRoot, '.ralph', 'context-map.example.md'),
  };
}
