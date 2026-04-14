import path from 'node:path';

export interface RalphPaths {
  root: string;
  config: string;
  configExample: string;
  prd: string;
  prdExample: string;
  contextMap: string;
  contextMapExample: string;
  state: string;
  tasks: string;
  progress: string;
  evidenceRoot: string;
}

export function ralphDir(cwd: string = process.cwd()): string {
  return path.join(cwd, '.ralph');
}

export function ralphPaths(cwd: string = process.cwd()): RalphPaths {
  const dir = ralphDir(cwd);
  return {
    root: dir,
    config: path.join(dir, 'config.yaml'),
    configExample: path.join(dir, 'config.example.yaml'),
    prd: path.join(dir, 'prd.md'),
    prdExample: path.join(dir, 'prd.example.md'),
    contextMap: path.join(dir, 'context-map.md'),
    contextMapExample: path.join(dir, 'context-map.example.md'),
    state: path.join(dir, 'state.json'),
    tasks: path.join(dir, 'tasks.json'),
    progress: path.join(dir, 'progress.md'),
    evidenceRoot: path.join(dir, 'evidence'),
  };
}
