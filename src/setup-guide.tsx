import { Button } from './ui/button.tsx';

export function SetupGuide({ needsInit = false, empty = true, embedded = false, command = 'npx designbench' }: {
  needsInit?: boolean; empty?: boolean; embedded?: boolean; command?: string;
}) {
  const steps = [
    ...(needsInit ? [['Create the catalog', `${command} init`, 'Create configuration and a working example.']] : []),
    ['Run the workbench', `${command} dev`, 'Keep this terminal running. Source edits refresh the previews.'],
    ['Find components', `${command} scan`, 'List component exports available to add.'],
    ['Add previews', `${command} add --all`, 'Generate draft fixtures, then check their props, providers, and styles.'],
  ];
  const content = <div className="dw-setup-card">
    {needsInit ? <h2>Set up your workbench</h2> : empty ? <h2>Bring your first component</h2> : <h2>A few commands to get going</h2>}
    <p>{needsInit ? 'Run init in another terminal, from your project folder. This preview server is already running.' : empty ? 'Your catalog is empty. Add a component to start exploring.' : 'Run these from your project folder.'}</p>
    <ol>{steps.map(([title, value, description]) => <li key={title}><h3>{title}</h3><pre><code>{value}</code></pre><p>{description}</p></li>)}</ol>
    <div className="dw-setup-usage"><h3>Explore and iterate</h3><p>Choose a component, adjust its properties or state, and compare design ideas. Edit preview files to try new directions; Share copies the current view.</p></div>
    <div className="dw-setup-usage"><h3>Design with your agent</h3><p>Ask your agent to read <code>.design-workbench/AGENT.md</code>. Each component has copyable instructions under <strong>Create a variant</strong>. Alternatives live in <code>.design-workbench/ideas/</code>; your app source stays unchanged until you explicitly promote one.</p><p>Use your coding environment’s browser annotation tools to point at a preview and describe a change. DesignBench supplies the previews and saved variants; your agent edits the code.</p></div>
    <p className="dw-setup-note">Embedded in an existing app? Add entries to its catalog instead of using the CLI.</p>
    {(empty || needsInit) && <Button variant="outline" onClick={() => window.location.reload()}>Check setup</Button>}
  </div>;
  return embedded ? <section className="dw-setup-content" aria-label="Setup guide">{content}</section>
    : <main className="dw-workbench dw-setup">{content}</main>;
}
