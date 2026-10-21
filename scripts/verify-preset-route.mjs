import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase environment is required');

const db = createClient(url, key);
const siteKey = `preset-check-${randomUUID()}`;
const visitor = `visitor-${randomUUID()}`;
const id = `question-${randomUUID()}`;
const base = process.env.PRESET_TEST_BASE ?? 'http://localhost:4178';
let siteId;

try {
  const { data: site, error } = await db.from('sites').insert({
    name: 'Preset route verification', site_key: siteKey,
    preset_messages: [{ question: 'Track my order?', answer: 'Use your tracking link.' }],
  }).select('id').single();
  if (error) throw error;
  siteId = site.id;

  const payload = { site: siteKey, visitor, id, body: 'Track my order?', presetQuestion: 'Track my order?' };
  const post = () => fetch(`${base}/api/widget/messages`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const response = await post();
  const responseBody = await response.text();
  assert.equal(response.status, 200, responseBody);
  const pair = JSON.parse(responseBody);
  assert.equal(pair.question.author, 'visitor');
  assert.equal(pair.question.body, payload.body);
  assert.equal(pair.answer.author, 'agent');
  assert.equal(pair.answer.body, 'Use your tracking link.');
  assert.equal(pair.answer.isAutomated, true);

  const replay = await post();
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), pair);

  const transcript = await fetch(`${base}/api/widget/messages?site=${siteKey}&visitor=${visitor}`);
  assert.equal(transcript.status, 200);
  const state = await transcript.json();
  assert.equal(state.messages.length, 2);
  assert.deepEqual(state.messages.map((message) => message.id), [id, `preset-${id}`]);

  const { data: conversation } = await db.from('conversations').select('unread_count, last_agent_id')
    .eq('site_id', siteId).eq('visitor_id', visitor).single();
  assert.equal(conversation.unread_count, 1);
  assert.equal(conversation.last_agent_id, null);
  console.log('Preset route persists the pair, replays safely, and keeps the visitor question unread.');
} finally {
  if (siteId) {
    const { data: conversations } = await db.from('conversations').select('id').eq('site_id', siteId);
    for (const conversation of conversations ?? []) {
      await db.from('messages').delete().eq('conversation_id', conversation.id);
    }
    await db.from('conversations').delete().eq('site_id', siteId);
    await db.from('sites').delete().eq('id', siteId);
  }
}
