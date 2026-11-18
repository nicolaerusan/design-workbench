import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, type LucideIcon } from 'lucide-react';
import { Kbd, KbdGroup } from '../../src/ui/kbd.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

/** Arrow characters are drawn as icons, which a key sizes to fit. */
const arrows: Partial<Record<string, { Icon: LucideIcon; name: string }>> = {
  '←': { Icon: ArrowLeft, name: 'Left arrow' },
  '→': { Icon: ArrowRight, name: 'Right arrow' },
  '↑': { Icon: ArrowUp, name: 'Up arrow' },
  '↓': { Icon: ArrowDown, name: 'Down arrow' },
};

export const entry: WorkbenchEntry = {
  id: 'kbd', name: 'Keyboard key', group: 'Navigation & layout', source: 'src/ui/kbd.tsx',
  description: 'A small label for a key or a shortcut, used for the ⌘K hint in the sidebar search.',
  width: 320, variants: ['Shortcut', 'Single key', 'Arrow keys'],
  propControls: {
    keys: { type: 'text', label: 'Keys', defaultValue: '⌘ K', description: 'One or more keys, separated by spaces. The arrows ← → ↑ ↓ are drawn as icons.' },
    label: { type: 'text', label: 'Label', defaultValue: 'Search components', description: 'What the keys do.' },
  },
  stateProps: {
    'Single key': { keys: 'Esc', label: 'Close the component list' },
    'Arrow keys': { keys: '← →', label: 'Resize the sidebar' },
  },
};

export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  const keys = String(props.keys).split(/\s+/).filter(Boolean).map((key, index) => {
    const arrow = arrows[key];
    return <Kbd key={index}>{arrow ? <arrow.Icon aria-label={arrow.name} /> : key}</Kbd>;
  });
  return <Frame>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <span>{String(props.label)}</span>
      {keys.length > 1 ? <KbdGroup>{keys}</KbdGroup> : keys}
    </div>
  </Frame>;
}
