import { rm } from 'node:fs/promises';
import path from 'node:path';
import { ProjectActivationSchema, createProjectActivation, type ProjectActivation } from '../schemas/project-activation.js';
import { exists, ensureDir, readJson, writeJson } from '../utils/fs.js';
import { ralphPaths } from '../utils/paths.js';

export interface ProjectActivationOptions {
  cwd?: string;
}

export interface ProjectActivationResult {
  cwd: string;
  activationPath: string;
  activation: ProjectActivation | null;
}

export async function enableProjectActivation(
  options: ProjectActivationOptions = {},
): Promise<ProjectActivationResult> {
  const cwd = options.cwd ?? process.cwd();
  const paths = ralphPaths(cwd);
  await ensureDir(paths.root);

  const activation = ProjectActivationSchema.parse(createProjectActivation());
  await writeJson(paths.projectActivation, activation);

  return {
    cwd,
    activationPath: paths.projectActivation,
    activation,
  };
}

export async function disableProjectActivation(
  options: ProjectActivationOptions = {},
): Promise<ProjectActivationResult> {
  const cwd = options.cwd ?? process.cwd();
  const paths = ralphPaths(cwd);

  const activation = await readProjectActivation(options);
  if (await exists(paths.projectActivation)) {
    await rm(paths.projectActivation, { force: true });
  }

  return {
    cwd,
    activationPath: paths.projectActivation,
    activation,
  };
}

export async function readProjectActivation(
  options: ProjectActivationOptions = {},
): Promise<ProjectActivation | null> {
  const cwd = options.cwd ?? process.cwd();
  const paths = ralphPaths(cwd);
  if (!(await exists(paths.projectActivation))) {
    return null;
  }

  const parsed = await readJson<unknown>(paths.projectActivation);
  return ProjectActivationSchema.parse(parsed);
}

export function formatActivationPath(cwd: string, activationPath: string): string {
  return path.relative(cwd, activationPath) || '.ralph/project.json';
}
