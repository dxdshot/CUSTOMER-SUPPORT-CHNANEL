import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path) {
  return ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}

let profile = { id: 'server', name: 'You', avatarUrl: '', awayMessage: 'Away' };
let hookIndex = 0;
const states = [];
let siteSaved;
const jsx = (type, props) => ({ type, props });
const settings = { exports: {} };
vm.runInNewContext(compile('src/app/dashboard/settings/page.tsx'), {
  exports: settings.exports,
  require(name) {
    if (name === 'react') return {
      useRef: () => ({ current: null }),
      useEffect: () => {},
      useState(initial) {
        const index = hookIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
      },
    };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name.endsWith('agent-profile')) return {
      useAgentProfile: () => profile,
      saveAgentProfile: async (draft) => { profile = { ...profile, ...draft }; return true; },
    };
    if (name.endsWith('/supabase')) return {
      getSupabase: () => ({ from: () => ({ update: (row) => ({ eq: () => ({ select: () => ({ maybeSingle: async () => { siteSaved = row; return { data: { id: 'site-1' }, error: null }; } }) }) }) }) }),
    };
    if (name.endsWith('/tags')) return {
      useTags: () => ({ tags: [], refresh: async () => {} }),
      createTag: async (site, tag) => ({ ok: true, name: tag, created: true }),
      TAG_NAME_MAX: 40,
    };
    if (name.endsWith('/utils')) return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (name.endsWith('/widget-copy')) return { DEFAULT_WELCOME: 'Hi! How can we help?', presetMessages: (value) => value.filter(Boolean) };
    return new Proxy({}, { get: (_, key) => key });
  },
});
const render = () => { hookIndex = 0; return settings.exports.default(); };
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
render();
states[5] = false;
profile = { id: 'agent-1', name: 'Ada', avatarUrl: 'https://example.com/ada.png', awayMessage: 'Back soon' };
let tree = nodes(render());
assert.equal(tree.find((node) => node.type === 'img').props.src, profile.avatarUrl);
let nameInput = tree.find((node) => node.type === 'input' && node.props.maxLength === 60);
assert.equal(nameInput.props.value, 'Ada');
nameInput.props.onChange({ target: { value: 'Grace' } });
profile = { ...profile, avatarUrl: 'https://example.com/new.png' };
tree = nodes(render());
assert.equal(tree.find((node) => node.type === 'input' && node.props.maxLength === 60).props.value, 'Grace');
assert.equal(tree.find((node) => node.type === 'img').props.src, profile.avatarUrl);
tree.find((node) => node.type === 'textarea' && node.props.value === 'Hi! How can we help?').props.onChange({ target: { value: 'Welcome to support' } });
tree.find((node) => typeof node.props?.onClick === 'function' && [node.props?.children].flat(Infinity).includes('Add preset reply')).props.onClick();
tree = nodes(render());
tree.find((node) => node.type === 'input' && node.props['aria-label'] === 'Question 1').props.onChange({ target: { value: 'Track my order' } });
tree = nodes(render());
tree.find((node) => node.type === 'textarea' && node.props['aria-label'] === 'Answer 1').props.onChange({ target: { value: 'Use the tracking page.' } });
tree = nodes(render());
tree.find((node) => node.type === 'DashboardButton' && node.props.children === 'Save settings').props.onClick();
await new Promise(setImmediate);
assert.equal(profile.name, 'Grace');
assert.equal(profile.avatarUrl, 'https://example.com/new.png');
assert.equal(siteSaved.welcome_message, 'Welcome to support');
assert.deepEqual(Array.from(siteSaved.preset_messages, (item) => ({ ...item })), [{ question: 'Track my order', answer: 'Use the tracking page.' }]);

const timers = new Map();
const events = new Map();
let timerId = 0;
let transport;
let requests = 0;
let resolveRequest;
let requestSignal;
let requestOptions;
let bootstrapRequests = 0;
const document = {
  currentScript: { src: 'https://example.com/widget/embed.js', dataset: { site: 'test' } },
  body: {},
  visibilityState: 'visible',
  addEventListener: (name, callback) => events.set(name, callback),
  removeEventListener: (name) => events.delete(name),
  querySelectorAll: () => [],
};
const storage = { getItem: () => null, setItem() {} };
vm.runInNewContext(compile('src/widget/embed.ts'), {
  URL, URLSearchParams, AbortController, AbortSignal, DOMException, console, document,
  window: {
    localStorage: storage, sessionStorage: storage,
    navigator: { userAgent: '', platform: '' }, screen: { width: 1200 }, innerWidth: 1200,
    location: { pathname: '/', search: '' },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: () => 0,
    clearInterval() {},
  },
  fetch: (url, options = {}) => {
    if (url.includes('/presence')) return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    if (url.includes('meta=1')) {
      bootstrapRequests++;
      return Promise.resolve({ ok: true, json: async () => ({ meta: { widgetSize: 'md' } }) });
    }
    requests++;
    requestSignal = options.signal;
    requestOptions = options;
    return new Promise((resolve) => { resolveRequest = resolve; });
  },
  require: () => ({ mountChatWidget: (options) => { transport = options.transport; } }),
});
await new Promise(setImmediate);
assert.ok(transport);
assert.equal(bootstrapRequests, 1, 'saved widget size is loaded before mount');
const delivered = [];
const metas = [];
const stop = transport.subscribe((message) => delivered.push(message), (meta) => metas.push(meta));
assert.equal([...timers.values()][0].delay, 5000);
assert.equal(requests, 0, 'mount does not eagerly load messages or history');
transport.setOpen(true);
transport.pollNow();
assert.equal(requests, 1, 'concurrent poll requests are coalesced');
assert.equal([...timers.values()][0].delay, 1000);
resolveRequest({ ok: true, json: async () => ({ messages: [], meta: { conversationId: 'c1' } }) });
await new Promise(setImmediate);
document.visibilityState = 'hidden';
events.get('visibilitychange')();
transport.pollNow();
assert.equal(requests, 2, 'hidden tabs keep polling so replies still notify');
assert.equal(timers.size, 1);
resolveRequest({ ok: true, json: async () => ({ messages: [], meta: { conversationId: 'c1' } }) });
await new Promise(setImmediate);
document.visibilityState = 'visible';
events.get('visibilitychange')();
assert.equal(requests, 3, 'returning to the tab refreshes immediately');
resolveRequest({ ok: true, json: async () => ({ messages: [{ id: 'reply', author: 'agent', body: 'Hello', createdAt: '2026-10-20T00:00:00Z' }], meta: { conversationId: 'c1' } }) });
await new Promise(setImmediate);
assert.equal(delivered.length, 1);
transport.pollNow();
transport.setConversation('c2');
resolveRequest({ ok: true, json: async () => ({ messages: [{ id: 'stale', author: 'agent', body: 'Old', createdAt: '2026-10-20T00:00:01Z' }], meta: { conversationId: 'c1' } }) });
await new Promise(setImmediate);
assert.equal(delivered.length, 1, 'old conversation poll cannot deliver after switching');
assert.equal(metas.at(-1).conversationId, 'c1', 'old conversation poll cannot replace new metadata');
transport.pollNow();
assert.equal(requests, 5);
resolveRequest({ ok: true, json: async () => ({ messages: [], meta: { conversationId: 'c2' } }) });
await new Promise(setImmediate);
assert.equal(metas.at(-1).conversationId, 'c2');
const started = transport.startConversation();
resolveRequest({ ok: true, json: async () => ({ conversationId: 'c3' }) });
assert.equal(await started, 'c3', 'new conversation uses server id');
const paired = transport.sendPreset('Track my order', 'q1', new AbortController().signal);
assert.equal(JSON.parse(requestOptions.body).presetQuestion, 'Track my order');
resolveRequest({ ok: true, json: async () => ({
  question: { id: 'q1', author: 'visitor', body: 'Track my order' },
  answer: { id: 'preset-q1', author: 'agent', body: 'Use your tracking link.', isAutomated: true },
}) });
const [sentQuestion, sentAnswer] = await paired;
assert.equal(sentQuestion.author, 'visitor');
assert.equal(sentAnswer.isAutomated, true);
transport.pollNow();
stop();
assert.equal(requestSignal.aborted, true);
assert.equal(timers.size, 0);
assert.equal(events.size, 0);
console.log('Profile hydration, unsaved edits, and widget polling regressions passed.');

let persisted;
let updatePatch;
let stored = JSON.stringify({ id: 'agent-1', name: 'Ada', avatarUrl: 'photo.png', awayMessage: 'Away' });
const sharedRow = { name: 'Shared', avatar_url: 'shared.png', away_message: 'Shared away' };
const profileSupabase = {
  from: () => ({
    select: () => {
      const query = {
        eq: () => query,
        neq: () => query,
        not: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: sharedRow }),
      };
      return query;
    },
    upsert: async (row) => { persisted = row; return { error: null }; },
    update: (patch) => {
      updatePatch = patch;
      return {
        eq: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: { id: 'agent-site_demo_001' } }),
          }),
        }),
      };
    },
  }),
};
const profileModule = { exports: {} };
vm.runInNewContext(compile('src/lib/agent-profile.ts'), {
  exports: profileModule.exports,
  window: { localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } } },
  require(name) {
    if (name === 'react') return {};
    if (name === './conversations') return { DEMO_SITE_KEY: 'site_demo_001' };
    return { getSupabase: () => profileSupabase };
  },
});
const hydrated = await profileModule.exports.hydrateAgentProfile();
assert.equal(hydrated.id, 'agent-site_demo_001', 'every browser uses the workspace agent id');
assert.equal(hydrated.name, 'Shared', 'the database profile wins over the local cache');
assert.equal(hydrated.avatarUrl, 'shared.png', 'a photo saved on another device is adopted');
await profileModule.exports.saveAgentProfile({ name: 'Grace' });
assert.equal(persisted.id, 'agent-site_demo_001', 'saving writes the shared row, not a per-browser id');
assert.equal(persisted.name, 'Grace', 'saving must execute the Supabase request');
assert.equal(persisted.avatar_url, 'shared.png');
assert.equal(JSON.parse(stored).name, 'Grace');
profileModule.exports.heartbeatAgent(profileModule.exports.getAgentProfile());
await new Promise(setImmediate);
assert.ok(updatePatch.last_seen_at, 'heartbeat refreshes presence');
assert.equal(updatePatch.name, undefined, 'heartbeat cannot clobber a name saved elsewhere');
assert.equal(updatePatch.avatar_url, undefined, 'heartbeat cannot clobber a photo saved elsewhere');
console.log('Workspace agent identity hydrates, saves, and heartbeats as one shared row.');
