import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ralphPaths } from '../utils/paths.js';
import { exists, readTextUtf8 } from '../utils/fs.js';
import { ConfigSchema, type Config } from '../schemas/config.js';
import { runVerificationCommands } from '../core/verify-runner.js';

export interface VerifyOptions {
  cwd?: string;
}

export async function runVerify(options: VerifyOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  if (!(await exists(p.config))) {
    console.error(`Missing config: ${path.relative(cwd, p.config)}`);
    console.error('Run `ralph init` first.');
    process.exitCode = 1;
    return;
  }

  const config: Config = ConfigSchema.parse(
    parseYaml(await readTextUtf8(p.config)),
  );

  const commands = config.verification.commands;
  if (commands.length === 0) {
    console.log('No verification commands configured.');
    return;
  }

  const evidenceDir = path.join(p.evidenceRoot, 'manual-verify', timestampLabel());
  console.log(`Running ${commands.length} verification command(s)...`);
  const result = await runVerificationCommands(commands, cwd, { evidenceDir });

  console.log('');
  console.log('Verification summary:');
  for (const item of result.results) {
    const mark = item.exitCode === 0 ? 'OK  ' : 'FAIL';
    console.log(`  ${mark} ${item.command} (${item.durationMs}ms, exit ${item.exitCode})`);
  }
  console.log(`Evidence saved to: ${path.relative(cwd, evidenceDir)}`);

  if (!result.ok) {
    console.error('Verification failed.');
    process.exitCode = 1;
  }
}

function timestampLabel(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
