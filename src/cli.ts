#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runPlan } from './commands/plan.js';
import { runResume } from './commands/resume.js';
import { runRun } from './commands/run.js';
import { runStatus } from './commands/status.js';
import { runVerify } from './commands/verify.js';

const program = new Command();

program
  .name('ralph')
  .description('Codex-native CLI harness for PRD-driven software delivery')
  .version('0.1.0');

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
  .description('Re-queue blocked or interrupted work so `ralph run` can continue')
  .action(async () => {
    await runResume();
  });

program
  .command('status')
  .description('Show the current Ralph project phase and next action')
  .action(async () => {
    await runStatus();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
