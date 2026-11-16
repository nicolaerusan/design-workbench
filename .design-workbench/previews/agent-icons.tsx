import { AgentIcon } from '../../src/agent-icons.tsx';
import { agents } from '../../src/agent-prompts.ts';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'agent-icons', name: 'Agent marks', group: 'Workbench parts', source: 'src/agent-icons.tsx',
  description: 'The marks that identify each coding agent in the Settings picker: Claude, ChatGPT, Cursor, and a generic one for the rest.',
  width: 420, variants: ['All agents', 'In the picker'],
  propControls: { size: { type: 'number', label: 'Size', defaultValue: 24, min: 12, max: 96 } },
  stateProps: { 'In the picker': { size: 16 } },
};

export function render(selection: Selection) {
  const size = Number(resolvePreviewProps(entry, selection).size);
  if (selection.state === 'In the picker') return <Frame>
    <div className="dw-agent-picker" style={{ margin: 0 }}>
      {agents.map((agent, index) => <button key={agent.id} type="button" className="dw-agent-choice" data-state={index === 0 ? 'on' : 'off'}><AgentIcon agent={agent.id} size={size} />{agent.label}</button>)}
    </div>
  </Frame>;
  return <Frame>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
      {agents.map(agent => <div key={agent.id} style={{ display: 'grid', justifyItems: 'center', gap: 8 }}><AgentIcon agent={agent.id} size={size} /><Caption>{agent.label}</Caption></div>)}
    </div>
  </Frame>;
}
