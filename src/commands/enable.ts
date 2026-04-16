import { enableProjectActivation, formatActivationPath } from '../core/project-activation.js';

export interface EnableCommandOptions {
  cwd?: string;
}

export async function runEnable(options: EnableCommandOptions = {}): Promise<void> {
  const result = await enableProjectActivation(options);
  const relativePath = formatActivationPath(result.cwd, result.activationPath);

  console.log('Ralph project activation enabled.');
  console.log(`Created: ${relativePath}`);
  console.log('');
  console.log('This project will now opt into global Ralph hook routing.');
  console.log('Next: run `orc init` to create project state, or let Codex bootstrap it.');
}
