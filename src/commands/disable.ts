import { disableProjectActivation, formatActivationPath } from '../core/project-activation.js';

export interface DisableCommandOptions {
  cwd?: string;
}

export async function runDisable(options: DisableCommandOptions = {}): Promise<void> {
  const result = await disableProjectActivation(options);
  const relativePath = formatActivationPath(result.cwd, result.activationPath);

  console.log('Ralph project activation disabled.');
  if (result.activation) {
    console.log(`Removed: ${relativePath}`);
  } else {
    console.log(`No activation file found at: ${relativePath}`);
  }
  console.log('');
  console.log('Global Ralph plugin files remain installed, but this project no longer opts in.');
}
