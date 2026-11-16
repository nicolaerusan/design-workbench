'use client';
import { useEffect, useState, type ReactNode } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { Button } from './ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible.tsx';
import { agents, mcpSetup, memoryLine, populatePrompt, refreshPrompt, type AgentId } from './agent-prompts.ts';
import type { AgentConnection } from './agent-view.ts';
import { AgentIcon } from './agent-icons.tsx';
import type { CoverageItem } from './model.ts';

const agentKey = 'design-workbench:agent';
const connectKey = 'design-workbench:connect';
type Connect = 'prompts' | 'mcp';

/** Copies text for pasting into an agent; if the clipboard is unavailable, shows the text to select instead. */
export function CopyButton({ text, label, primary = false }: { text: string; label: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(timer); } }, [copied]);
  return <>
    <Button variant={primary ? 'default' : 'outline'} size="sm" className="dw-copy-button" aria-live="polite"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setFailed(false); } catch { setFailed(true); } }}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Copied' : label}
    </Button>
    {failed && <textarea className="dw-agent-prompt dw-copy-fallback" readOnly rows={6} value={text} aria-label={`${label}: select and copy`} onFocus={event => event.currentTarget.select()} />}
  </>;
}

/** A task to hand to an agent: what it does, a copy button, and the full prompt on request. */
function PromptCard({ title, children, text, label = 'Copy prompt', primary, reveal = 'Show prompt' }: {
  title: string; children: ReactNode; text: string; label?: string; primary?: boolean; reveal?: string;
}) {
  return <section className="dw-prompt-card" aria-label={title}>
    <div className="dw-prompt-card-head">
      <div><h3>{title}</h3>{children}</div>
      <CopyButton text={text} label={label} primary={primary} />
    </div>
    <Collapsible>
      <CollapsibleTrigger className="dw-prompt-reveal"><ChevronRight size={13} aria-hidden="true" />{reveal}</CollapsibleTrigger>
      <CollapsibleContent><pre className="dw-prompt-text"><code>{text}</code></pre></CollapsibleContent>
    </Collapsible>
  </section>;
}

export function SetupGuide({ needsInit = false, empty = true, embedded = false, command = 'npx designbench', coverage = [], drafts = 0, onShowCoverage, connection, defaultConnect }: {
  needsInit?: boolean; empty?: boolean; embedded?: boolean; command?: string;
  /**
   * Set when agents can connect to this workbench over MCP, which the CLI supports: the agent that last called in,
   * or null before any has. Undefined leaves the MCP option out.
   */
  connection?: AgentConnection | null;
  /** Which way of working with an agent to show. Otherwise the reader's last choice is used. */
  defaultConnect?: Connect;
  /** Component files found in the project and whether each has a preview. */
  coverage?: CoverageItem[];
  /** Previews an agent generated but has not finished. */
  drafts?: number;
  onShowCoverage?: () => void;
}) {
  const [agentId, setAgentId] = useState<AgentId>('claude');
  useEffect(() => { try { const saved = localStorage.getItem(agentKey); if (agents.some(agent => agent.id === saved)) setAgentId(saved as AgentId); } catch {} }, []);
  const agent = agents.find(item => item.id === agentId)!;
  const [chosen, setChosen] = useState<Connect>(defaultConnect ?? 'prompts');
  useEffect(() => { if (defaultConnect) return; try { if (localStorage.getItem(connectKey) === 'mcp') setChosen('mcp'); } catch {} }, [defaultConnect]);
  const connect: Connect = connection === undefined ? 'prompts' : chosen;
  const setup = mcpSetup(agentId, command);
  const sentenceName = agent.name[0].toUpperCase() + agent.name.slice(1);
  const configured = !needsInit && !empty;
  const previewed = coverage.filter(item => item.status === 'previewed').length;
  const missing = coverage.filter(item => item.status === 'missing').length;
  const steps = [
    ...(needsInit ? [['Create the catalog', `${command} init`, 'Create configuration and a working example.']] : []),
    ['Run the workbench', `${command} dev`, 'Keep this terminal running. Source edits refresh the previews.'],
    ['Find components', `${command} scan`, 'List component exports available to add.'],
    ['Add previews', `${command} add --all`, 'Generate draft fixtures, then check their props, providers, and styles.'],
  ];
  const commands = <ol>{steps.map(([title, value, description]) => <li key={title}><h3>{title}</h3><pre><code>{value}</code></pre><p>{description}</p></li>)}</ol>;
  const draftNote = !!drafts && <>{drafts} {drafts === 1 ? 'preview is still a draft' : 'previews are still drafts'}.</>;
  const coverageSummary = coverage.length ? <p className="dw-coverage-summary">
    {missing ? <><strong>{previewed} of {coverage.length}</strong> component files have a preview, <strong>{missing}</strong> to go.</>
      : <>{coverage.length === 1 ? 'The one component file found has a preview.' : <>All <strong>{coverage.length}</strong> component files have a preview.</>}</>}
    {draftNote && <> {draftNote}</>}
    {!!missing && onShowCoverage && <> <button type="button" className="dw-inline-link" onClick={onShowCoverage}>See what’s missing</button></>}
  </p> : draftNote ? <p className="dw-coverage-summary">{draftNote}</p> : null;
  const content = <div className="dw-setup-card">
    <h2>{needsInit ? 'Set up your workbench' : empty ? 'Bring your first component' : 'Use DesignBench with your agent'}</h2>
    <p>{needsInit ? 'This project has no workbench yet. Hand the setup to your coding agent, or run the commands below yourself. This preview server is already running.'
      : empty ? 'Your catalog is empty. Hand it to your coding agent, or add a component with the commands below.'
      : `DesignBench shows your components; your coding agent builds and changes them. Choose the agent you use, then copy a prompt${connection === undefined ? '' : ' or connect it over MCP'}.`}</p>
    <div className="dw-agent-bar">
      <ToggleGroup.Root type="single" className="dw-agent-picker" aria-label="Your agent" value={agentId}
        onValueChange={value => { if (!value) return; setAgentId(value as AgentId); try { localStorage.setItem(agentKey, value); } catch {} }}>
        {agents.map(item => <ToggleGroup.Item key={item.id} value={item.id} className="dw-agent-choice"><AgentIcon agent={item.id} />{item.label}</ToggleGroup.Item>)}
      </ToggleGroup.Root>
      {connection !== undefined && <ToggleGroup.Root type="single" className="dw-connect-picker" aria-label="How your agent works with DesignBench" value={connect}
        onValueChange={value => { if (!value) return; setChosen(value as Connect); try { localStorage.setItem(connectKey, value); } catch {} }}>
        <ToggleGroup.Item value="prompts" className="dw-connect-choice">Prompts</ToggleGroup.Item>
        <ToggleGroup.Item value="mcp" className="dw-connect-choice">MCP{!!connection && <span className="dw-mcp-dot" data-connected="true" aria-label="connected" />}</ToggleGroup.Item>
      </ToggleGroup.Root>}
    </div>
    <p className="dw-agent-where">{connect === 'mcp' ? `Connect ${agent.name} once. After that it can see what you have open here, so you can say “this one” instead of describing it.` : agent.where}</p>
    {connect === 'mcp' ? <>
      <section className="dw-prompt-card dw-mcp-card" aria-label="Connect with MCP">
        <div className="dw-prompt-card-head">
          <div>
            <h3>Connect {agent.name} to this workbench</h3>
            <p>{sentenceName} can then see which component, variant, and state you have open, show you a view, and check which components still need a preview. The connection never edits files; your agent changes code the way it always does.</p>
          </div>
          <CopyButton text={setup.text} label={setup.kind === 'command' ? 'Copy command' : 'Copy config'} primary />
        </div>
        <p className="dw-mcp-how">{setup.how}</p>
        <pre className="dw-mcp-code"><code>{setup.text}</code></pre>
        <p className="dw-mcp-status" role="status">
          <span className="dw-mcp-dot" data-connected={connection ? 'true' : undefined} aria-hidden="true" />
          {connection
            ? <span><strong>{connection.client} is connected.</strong> It last called at {new Date(connection.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</span>
            : <span>{setup.then} This line turns green when it connects.</span>}
        </p>
      </section>
      <section className="dw-prompt-card dw-ask-card" aria-label="Then just ask">
        <h3>Then just ask</h3>
        <ul className="dw-ask-list">
          <li>“What am I looking at in DesignBench?”</li>
          <li>“Make the variant I have open more compact.”</li>
          <li>“Show me the button’s disabled state.”</li>
          <li>“Which components still need a preview?”</li>
        </ul>
        {coverageSummary}
        <p>Populating the workbench, keeping it up to date, and creating variants come with the connection as ready-made prompts. {agentId === 'claude'
          ? <>In Claude Code, type <code>/mcp__designbench__populate</code>, <code>/mcp__designbench__refresh</code>, or <code>/mcp__designbench__variants</code>.</>
          : <>Agents that list MCP prompts show them as commands named populate, refresh, and variants. Otherwise ask for them in your own words, or copy them from Prompts.</>}</p>
      </section>
    </> : <>
      <PromptCard title={needsInit ? 'Set up and populate the workbench' : 'Populate the workbench'} text={populatePrompt(command, needsInit)} primary>
        <p>Finds every component in your project and builds a working preview for each, with sample content, states, and editable properties.</p>
        {coverageSummary}
      </PromptCard>
      {configured && <PromptCard title="Keep it up to date" text={refreshPrompt(command)}>
        <p>After you add or rename components: rescans the project, fills the gaps, and finishes any drafts.</p>
      </PromptCard>}
    </>}
    <PromptCard title="Tell your agent about the workbench" text={memoryLine(command)} label="Copy line" reveal="Show line">
      <p>Add this line to <code>{agent.memory}</code> so every session knows to keep previews current.</p>
    </PromptCard>
    {configured ? <>
      <div className="dw-setup-usage"><h3>Design with it</h3><p>Open a component, switch its state or edit its properties, then use <strong>Variants → Create a variant</strong> to copy instructions for a new direction. Variants are saved in <code>.design-workbench/ideas/</code> and compared side by side; your app only changes when you choose <strong>Use in my app</strong>.</p><p>In an agent app with a built-in browser, open this workbench there and point at what you want changed. DesignBench supplies the previews; your agent edits the code.</p></div>
      <Collapsible className="dw-setup-commands">
        <CollapsibleTrigger className="dw-create-variant-trigger"><ChevronRight size={14} aria-hidden="true" />Commands</CollapsibleTrigger>
        <CollapsibleContent><p>Run these from your project folder. Your agent runs the same ones.</p>{commands}</CollapsibleContent>
      </Collapsible>
    </> : <div className="dw-setup-usage"><h3>Or run the commands yourself</h3><p>From your project folder:</p>{commands}</div>}
    <p className="dw-setup-note">Embedded in an existing app? Add entries to its catalog instead of using the CLI.</p>
    {(empty || needsInit) && <Button variant="outline" onClick={() => window.location.reload()}>Check setup</Button>}
  </div>;
  return embedded ? <section className="dw-setup-content" aria-label="Setup guide">{content}</section>
    : <main className="dw-workbench dw-setup">{content}</main>;
}
