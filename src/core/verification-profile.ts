import type { Config } from '../schemas/config.js';
import type { Task } from '../schemas/tasks.js';

export function resolveVerificationCommands(
  task: Pick<Task, 'verificationHints'> | null,
  config: Pick<Config, 'verification'>,
): string[] {
  const explicit = config.verification.commands;
  if (explicit.length > 0) {
    return explicit;
  }

  if (!task) {
    return [];
  }

  return task.verificationHints.commands;
}
