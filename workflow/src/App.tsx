const commands = [
  ['ralph init', 'Create local Ralph working files from tracked examples'],
  ['ralph plan', 'Turn the PRD into a task graph with context metadata'],
  ['ralph run', 'Execute the next task that still fits the budget'],
  ['ralph verify', 'Run verification only and save evidence'],
  ['ralph resume', 'Re-queue blocked or interrupted work'],
  ['ralph status', 'Show phase, current task, and blocked hints'],
];

const artifacts = [
  ['PRD', '.ralph/prd.md'],
  ['Task graph', '.ralph/tasks.json'],
  ['State', '.ralph/state.json'],
  ['Progress', '.ralph/progress.md'],
  ['Evidence', '.ralph/evidence/'],
];

export default function App() {
  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">openai-ralph-codex</span>
          <h1>Ralph pipeline architecture for Codex</h1>
          <p className="hero-text">
            A plugin-ready Ralph loop: plan from a PRD, schedule work that
            fits the current context budget, run Codex on one bounded task,
            verify automatically, record evidence, and recover through retry,
            block, or resume.
          </p>
          <div className="hero-pills">
            <span>plugin-ready</span>
            <span>PRD-driven</span>
            <span>verification-gated</span>
            <span>recoverable</span>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="section">
          <div className="section-header">
            <span className="section-kicker">Flowchart</span>
            <h2>End-to-end Ralph loop</h2>
          </div>

          <div className="diagram-board">
            <div className="flow-row main-flow">
              <div className="flow-node">
                <span className="node-type">input</span>
                <h3>PRD + repo context</h3>
                <p>User intent enters Ralph through `.ralph/prd.md`.</p>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node">
                <span className="node-type">command</span>
                <h3>ralph init</h3>
                <p>Seed `.ralph/` working files from tracked templates.</p>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node">
                <span className="node-type">command</span>
                <h3>ralph plan</h3>
                <p>Generate tasks + context estimates + split hints.</p>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node emphasis-node">
                <span className="node-type">core</span>
                <h3>Scheduler</h3>
                <p>Pick the next runnable task that still fits the budget.</p>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node">
                <span className="node-type">command</span>
                <h3>ralph run</h3>
                <p>Launch Codex with one bounded task prompt.</p>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node">
                <span className="node-type">verification</span>
                <h3>Verify + evidence</h3>
                <p>Run checks, short-circuit on failure, store outputs.</p>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-node success-node">
                <span className="node-type">success</span>
                <h3>Done / next task</h3>
                <p>Mark task done and continue until the queue is empty.</p>
              </div>
            </div>

            <div className="branch-grid">
              <div className="branch-card">
                <span className="branch-label">Success path</span>
                <p>Verification passes → task becomes `done` → scheduler selects the next bounded task.</p>
              </div>
              <div className="branch-card warning-card">
                <span className="branch-label">Retry path</span>
                <p>Runner or verify fails with budget remaining → queue retry and loop back to `ralph run`.</p>
              </div>
              <div className="branch-card danger-card">
                <span className="branch-label">Blocked path</span>
                <p>Context too broad or retry budget exhausted → block the task and surface a next action.</p>
              </div>
            </div>

            <div className="loop-lane">
              <div className="loop-node">
                <h3>Split / relax policy</h3>
                <p>Edit `.ralph/prd.md` or `.ralph/config.yaml`, then re-run `ralph plan`.</p>
              </div>
              <div className="loop-arrow">↺</div>
              <div className="loop-node">
                <h3>ralph resume</h3>
                <p>Manual unblock path that re-queues interrupted or blocked work.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section two-column">
          <article className="info-card">
            <div className="section-header">
              <span className="section-kicker">Artifacts</span>
              <h2>What Ralph persists between turns</h2>
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
              <span className="section-kicker">Command surface</span>
              <h2>Current plugin-backed CLI</h2>
            </div>
            <ul className="command-list">
              {commands.map(([name, description]) => (
                <li key={name}>
                  <code>{name}</code>
                  <span>{description}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="section">
          <article className="info-card accent-card">
            <div className="section-header">
              <span className="section-kicker">Automation boundary</span>
              <h2>What “automatic” means right now</h2>
            </div>
            <p>
              Ralph already automates task selection, verification, evidence
              capture, retry transitions, and blocked-state handling once the
              workflow is invoked. It is plugin-ready and Codex-friendly, but
              it is not yet an always-on daemon that silently hijacks every
              task without an invocation surface.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
