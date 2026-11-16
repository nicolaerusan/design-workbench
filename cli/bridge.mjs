import { randomBytes, timingSafeEqual } from 'node:crypto';

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const viewports = ['fit', '375', '768', '1280'];
/** A request the agent can correct, as opposed to a failure of the workbench. */
const problem = message => Object.assign(new Error(message), { code: 'BAD_TARGET' });

/**
 * Turns "Button, the Ink variant, disabled" into a workbench URL query.
 * Accepts ids or display names. Anything left out stays as it is when the component is already open,
 * including properties the user edited.
 */
export function resolveTarget(catalog, current, { page, component, variant, state, viewport } = {}) {
  if (page === 'overview') return { search: '', label: 'the component overview' };
  if (page === 'settings') return { search: '?view=setup', label: 'Settings' };
  if (page) throw problem('page must be "overview" or "settings". Leave it out to open a component.');
  if (viewport !== undefined && !viewports.includes(String(viewport))) throw problem(`viewport must be one of: ${viewports.join(', ')}.`);
  const open = current?.page === 'component' ? current : undefined;
  if (!component && !open) throw problem('Name a component to open. list_components shows the ones in this workbench.');
  if (!catalog) {
    // No workbench tab has loaded yet, so there is nothing to check names against. The page falls back to defaults for unknown values.
    const query = new URLSearchParams({ component: String(component ?? open.component?.id) });
    if (variant) query.set('design', String(variant));
    if (state) query.set('state', String(state));
    if (viewport) query.set('viewport', String(viewport));
    return { search: `?${query}`, label: query.get('component'), unchecked: true };
  }
  const entry = component
    ? catalog.components.find(item => item.id === component) ?? catalog.components.find(item => same(item.name, component) || same(item.id, component) || item.source === component)
    : catalog.components.find(item => item.id === open.component?.id);
  if (!entry) throw problem(`No component matches "${component}". Components: ${catalog.components.map(item => item.id).join(', ') || 'none yet'}.`);
  const kept = open?.component?.id === entry.id ? open : undefined;
  let design = kept?.variant?.id;
  if (variant !== undefined) {
    const wanted = ['source', 'current', 'app', 'source component'].some(word => same(word, variant))
      ? entry.variants.find(item => item.kind === 'source')
      : entry.variants.find(item => item.id === variant) ?? entry.variants.find(item => same(item.name, variant) || same(item.id, variant));
    if (!wanted) throw problem(`${entry.name} has no variant "${variant}". Variants: ${entry.variants.map(item => item.kind === 'source' ? `source (${item.name})` : item.id).join(', ')}.`);
    design = wanted.id;
  }
  let shown = kept?.state;
  if (state !== undefined) {
    shown = entry.states.find(item => item === state) ?? entry.states.find(item => same(item, state));
    if (!shown) throw problem(`${entry.name} has no state "${state}". States: ${entry.states.join(', ')}.`);
  }
  const query = new URLSearchParams({ component: entry.id });
  if (design) query.set('design', design);
  if (shown) query.set('state', shown);
  const width = viewport ?? kept?.viewport;
  if (width && width !== 'fit') query.set('viewport', String(width));
  // As in the workbench itself, the user's property edits survive a change of variant or width.
  // A different state starts from that state's own properties.
  if (kept?.editedProperties && shown === kept.state) query.set('props', JSON.stringify(kept.editedProperties));
  const picked = entry.variants.find(item => item.id === design);
  return { search: `?${query}`, label: [entry.name, picked && picked.kind !== 'source' ? `variant ${picked.name}` : '', shown ? `state ${shown}` : ''].filter(Boolean).join(', ') };
}

/**
 * The dev server's record of what the workbench page is showing, for `designbench mcp`.
 * The page reports its view; an agent reads it and can ask the page to open another one. Nothing here touches files.
 */
export function createBridge({ root, send, confirmWithin = 1500, reloadWithin = 3000 }) {
  const token = randomBytes(24).toString('hex');
  const tabs = new Map();     // open workbench tabs and the view each last reported
  const waiting = new Map();  // open requests waiting for a tab to confirm
  let last = null;            // the most recent view, kept after its tab closes
  let catalog = null;         // components and coverage, as the page last reported them
  let agent = null;           // the agent that last called in
  let origin = '';
  let changedAt = 0;          // when a project file last changed
  // Tabs are kept in the order they last reported, so the final one is the tab the user used most recently.
  const current = () => { const newest = [...tabs].at(-1); return newest ? { tab: newest[0], ...newest[1] } : null; };

  /**
   * Saving a file reloads the page: its tab leaves a moment before the reloaded one reports.
   * An agent that edits and then asks straight away waits for that tab instead of hearing that nothing is open.
   */
  const reloaded = async () => {
    while (last && !tabs.size && Date.now() - changedAt < reloadWithin) await new Promise(resolve => setTimeout(resolve, 40));
  };
  /** Asks one tab to open a view. Resolves to whether it confirmed. */
  const deliver = (tab, search) => new Promise(resolve => {
    const id = randomBytes(8).toString('hex');
    const timer = setTimeout(() => { waiting.delete(id); tabs.delete(tab); resolve(false); }, confirmWithin);
    waiting.set(id, () => { clearTimeout(timer); waiting.delete(id); resolve(true); });
    send('designbench:open', { id, tab, search });
  });

  return {
    token,
    setOrigin(value) { origin = value; },
    fileChanged() { changedAt = Date.now(); },
    /** Agents present the token from the runtime file. A browser cannot: it always sends an Origin, and cannot read the file. */
    authorized(req) {
      const given = Buffer.from(req.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${token}`);
      return !req.headers.origin && given.length === expected.length && timingSafeEqual(given, expected);
    },
    /** Called by the workbench page whenever its view changes, and once when it closes. */
    report(body) {
      const tab = typeof body?.tab === 'string' ? body.tab.slice(0, 64) : '';
      if (!tab) throw problem('Missing tab.');
      if (body.closed) tabs.delete(tab);
      else if (body.view && typeof body.view === 'object') {
        last = { view: body.view, at: Date.now() };
        tabs.delete(tab); tabs.set(tab, last);
        if (tabs.size > 32) tabs.delete(tabs.keys().next().value);
      }
      if (body.catalog && typeof body.catalog === 'object' && Array.isArray(body.catalog.components)) catalog = body.catalog;
      if (typeof body.ack === 'string') waiting.get(body.ack)?.();
      return { agent, needsCatalog: !catalog };
    },
    /** Records that an agent called, so Settings can show the connection. */
    contact(req) {
      const client = String(req.headers['x-designbench-client'] ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 60) || 'An agent';
      agent = { client, at: Date.now() };
      send('designbench:agent', agent);
    },
    async state() {
      await reloaded();
      const shown = current() ?? last;
      return {
        root, url: shown?.view?.url ? new URL(shown.view.url).origin + '/' : origin + '/',
        tabOpen: tabs.size > 0, view: shown?.view ?? null, viewAt: shown?.at ?? null,
        project: catalog?.project ?? null, components: catalog?.components ?? null, coverage: catalog?.coverage ?? null,
      };
    },
    /** Opens a view in the tab the user last used, and reports whether a tab confirmed it. */
    async open(request) {
      await reloaded();
      let tab = current();
      const target = resolveTarget(catalog, (tab ?? last)?.view, request);
      const base = tab?.view?.url ? new URL(tab.view.url).origin : origin;
      const result = { url: `${base}/${target.search}`, label: target.label, unchecked: !!target.unchecked, opened: false };
      // A tab that does not confirm has gone. If the page reloaded meanwhile, its new tab gets the request.
      for (let attempt = 0; tab && attempt < 2 && !result.opened; attempt++) {
        result.opened = await deliver(tab.tab, target.search);
        tab = result.opened ? tab : current();
      }
      return result;
    },
  };
}
