#!/usr/bin/env node
import path from 'node:path';
import { Command } from 'commander';
import { runDisable } from './commands/disable.js';
import { runEnable } from './commands/enable.js';
import { runInit } from './commands/init.js';
import { runPlan } from './commands/plan.js';
import { runPluginInstall, runPluginStatus } from './commands/plugin.js';
import { runResume } from './commands/resume.js';
import { runRun } from './commands/run.js';
import { runStatus } from './commands/status.js';
import { runVerify } from './commands/verify.js';

const program = new Command();
const cliName = resolveCliName(process.argv[1]);

program
  .name(cliName)
  .description('Codex-native CLI harness for PRD-driven software delivery')
  .version('0.1.5');

program
  .command('enable')
  .description('Opt the current project into Ralph hook routing')
  .action(async () => {
    await runEnable();
  });

program
  .command('disable')
  .description('Opt the current project out of Ralph hook routing')
  .action(async () => {
    await runDisable();
  });

program
  .command('init')
  .description('Create .ralph/ working files from tracked example templates')
  .action(async () => {
    await runInit();
  });

program
  .command('plan')
  .description('Generate an initial task graph from .ralph/prd.md')
  .action(async () => {
    await runPlan();
  });

program
  .command('run')
  .description('Execute the next runnable task through the configured runner')
  .option('--dry-run', 'Print the prompt without launching the runner')
  .action(async (opts: { dryRun?: boolean }) => {
    await runRun({ dryRun: opts.dryRun });
  });

program
  .command('verify')
  .description('Run the configured verification commands (no state changes)')
  .action(async () => {
    await runVerify();
  });

program
  .command('resume')
  .description('Re-queue blocked or interrupted work so `orc run` can continue')
  .action(async () => {
    await runResume();
  });

const plugin = program
  .command('plugin')
  .description('Install or inspect the home-local Codex plugin packaging');

plugin
  .command('install')
  .description('Copy the Ralph plugin into the home-local Codex plugin location')
  .action(async () => {
    await runPluginInstall();
  });

plugin
  .command('status')
  .description('Show whether the home-local Ralph plugin is installed')
  .action(async () => {
    await runPluginStatus();
  });

program
  .command('status')
  .description('Show the current Ralph project phase and next action')
  .option('--project', 'Show whether the current project is opted into Ralph hook routing')
  .action(async (opts: { project?: boolean }) => {
    await runStatus({ project: opts.project });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});

function resolveCliName(argv1?: string): string {
  if (!argv1) {
    return 'ralph';
  }

  const ext = path.extname(argv1);
  return path.basename(argv1, ext) || 'ralph';
}
