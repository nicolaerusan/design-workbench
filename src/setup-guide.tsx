export function SetupGuide({ needsInit = false, command = 'npx design-workbench' }: { needsInit?: boolean; command?: string }) {
  const steps = needsInit ? [
    ['Create your workbench', `${command} init`, 'Create the catalog and a working example. Existing application code stays in place.'],
    ['Discover your components', `${command} scan`, 'See which component exports can become previews.'],
    ['Add draft previews', `${command} add --all`, 'Review generated props and providers before opening your components.'],
  ] : [
    ['Discover your components', `${command} scan`, 'List component exports in your project.'],
    ['Add draft previews', `${command} add --all`, 'Create editable fixtures, then supply their required props and providers.'],
  ];
  return <main className="dw-workbench dw-setup"><div className="dw-setup-card">
    <div className="dw-eyebrow">DesignBench · Getting started</div>
    <h1>{needsInit ? 'Set up your workbench' : 'Bring your first component'}</h1>
    <p>{needsInit ? 'The preview server is running. Run these commands in another terminal to create your project’s catalog.' : 'Your catalog is empty. Add a component to start exploring designs, properties, and states.'}</p>
    <ol>{steps.map(([title, value, description]) => <li key={title}><h2>{title}</h2><p>{description}</p><pre><code>{value}</code></pre></li>)}</ol>
    <p>Using an embedded workbench? Add entries to the manifest supplied by your application instead.</p>
    <button onClick={() => window.location.reload()}>Check setup</button>
    <details><summary>Starting again later</summary><p>From a terminal in your project, start the local preview server:</p><pre><code>{command} dev</code></pre><p>Keep that terminal running while you use the workbench. The browser cannot start a stopped server.</p></details>
  </div></main>;
}
