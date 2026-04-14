type Stage = {
  id: string;
  title: string;
  summary: string;
  input: string;
  output: string;
  highlights: string[];
};

const stages: Stage[] = [
  {
    id: '01',
    title: 'Initialize',
    summary: 'Seed local Ralph state from tracked examples.',
    input: 'ralph init',
    output: '.ralph/config.yaml, prd.md, context-map.md, state.json, tasks.json',
    highlights: [
      'Creates working files from committed templates',
      'Leaves existing local state untouched on repeated runs',
    ],
  },
  {
    id: '02',
    title: 'Plan',
    summary: 'Turn the PRD into a persisted task graph.',
    input: 'ralph plan',
    output: '.ralph/tasks.json + updated .ralph/state.json',
    highlights: [
      'Extracts tasks from acceptance criteria',
      'Estimates context load and flags tasks that should be split',
    ],
  },
  {
    id: '03',
    title: 'Schedule',
    summary: 'Pick the next runnable task that still fits the context budget.',
    input: 'pending tasks + dependency state + context policy',
    output: 'next runnable task or blocked state',
    highlights: [
      'Skips tasks with unmet dependencies',
      'Blocks broad work when every runnable task exceeds the budget',
    ],
  },
  {
    id: '04',
    title: 'Run Codex',
    summary: 'Launch Codex with a focused prompt for one task.',
    input: 'ralph run',
    output: 'runner stdout/stderr + code changes',
    highlights: [
      'Supports dry-run prompt preview',
      'Passes context file hints and load estimate into the prompt',
    ],
  },
  {
    id: '05',
    title: 'Verify',
    summary: 'Run configured checks and capture evidence for each command.',
    input: 'verification.commands',
    output: '.ralph/evidence/<task-id>/<timestamp>/...',
    highlights: [
      'Stops on the first failing verification command',
      'Stores command.txt, stdout.txt, stderr.txt, and result.json',
    ],
  },
  {
    id: '06',
    title: 'Recover or Complete',
    summary: 'Retry, block, resume, or finish the loop.',
    input: 'runner result + verify result + retry policy',
    output: 'task done, retry queued, or blocked for manual intervention',
    highlights: [
      'Retry budget is tracked per task',
      'ralph resume re-queues blocked or interrupted work',
    ],
  },
];

const artifacts = [
  ['PRD source', '.ralph/prd.md'],
  ['Task graph', '.ralph/tasks.json'],
  ['Project state', '.ralph/state.json'],
  ['Progress log', '.ralph/progress.md'],
  ['Evidence', '.ralph/evidence/'],
];

const commands = [
  ['init', 'Create local Ralph working files'],
  ['plan', 'Generate or regenerate the task graph'],
  ['run', 'Execute the next schedulable task through Codex'],
  ['verify', 'Run checks without changing Ralph state'],
  ['resume', 'Re-queue blocked or interrupted work'],
  ['status', 'Inspect the current phase, task, and hints'],
];

export default function App() {
  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">openai-ralph-codex</span>
          <h1>How Ralph moves a PRD through a delivery loop</h1>
          <p className="hero-text">
            Ralph keeps task execution small, stateful, and recoverable:
            plan from a PRD, select work that fits the context budget, run
            Codex, verify the result, and either continue or block with an
            explicit next action.
          </p>
          <div className="hero-pills">
            <span>PRD-driven</span>
            <span>Context-budgeted</span>
            <span>Verification-gated</span>
            <span>Evidence-recorded</span>
          </div>
        </div>
        <aside className="hero-panel">
          <h2>Loop summary</h2>
          <ol>
            <li>Initialize local Ralph state</li>
            <li>Plan tasks from the PRD</li>
            <li>Schedule a task within budget</li>
            <li>Run Codex on exactly one task</li>
            <li>Verify and record evidence</li>
            <li>Retry, resume, or complete</li>
          </ol>
        </aside>
      </header>

      <main className="content">
        <section className="section">
          <div className="section-header">
            <span className="section-kicker">Flowchart</span>
            <h2>Execution flow</h2>
          </div>
          <div className="stage-grid">
            {stages.map((stage, index) => (
              <div key={stage.id} className="stage-card">
                <div className="stage-topline">
                  <span className="stage-id">{stage.id}</span>
                  <span className="stage-arrow">
                    {index < stages.length - 1 ? '→' : '✓'}
                  </span>
                </div>
                <h3>{stage.title}</h3>
                <p>{stage.summary}</p>
                <dl className="meta-list">
                  <div>
                    <dt>Input</dt>
                    <dd>{stage.input}</dd>
                  </div>
                  <div>
                    <dt>Output</dt>
                    <dd>{stage.output}</dd>
                  </div>
                </dl>
                <ul>
                  {stage.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="section two-column">
          <article className="info-card">
            <div className="section-header">
              <span className="section-kicker">State</span>
              <h2>Artifacts that survive each iteration</h2>
            </div>
            <div className="artifact-list">
              {artifacts.map(([label, value]) => (
                <div key={label} className="artifact-row">
                  <span>{label}</span>
                  <code>{value}</code>
                </div>
              ))}
            </div>
          </article>

          <article className="info-card">
            <div className="section-header">
              <span className="section-kicker">CLI</span>
              <h2>Commands in the current implementation</h2>
            </div>
            <ul className="command-list">
              {commands.map(([name, description]) => (
                <li key={name}>
                  <code>ralph {name}</code>
                  <span>{description}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="section two-column">
          <article className="info-card accent-card">
            <div className="section-header">
              <span className="section-kicker">Context budget</span>
              <h2>Why Ralph blocks broad work</h2>
            </div>
            <p>
              Planning estimates file count, cross-layer impact, and
              overall task load. The scheduler only launches tasks that
              fit the configured limits. If every runnable task is still
              too large, Ralph blocks and asks for one of two changes:
            </p>
            <ul>
              <li>split the PRD item into smaller tasks</li>
              <li>relax the context policy in <code>.ralph/config.yaml</code></li>
            </ul>
          </article>

          <article className="info-card accent-card">
            <div className="section-header">
              <span className="section-kicker">Recovery</span>
              <h2>What happens after failure</h2>
            </div>
            <p>
              Runner failures and verification failures consume retry
              budget. If budget remains, the task goes back to pending.
              When the budget is exhausted, the task is marked blocked and
              <code>ralph resume</code> can re-queue it after manual
              intervention.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
