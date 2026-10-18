// Native VM checks of the original rank UI functions with a minimal form/DOM and captured fetch.
// No browser layout, Chart rendering, socket or server is exercised.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const I = require('../i18n.js');

async function run() {
  I.setLang('en');
  const nodes = new Map();
  function element() {
    let value = '', html = '';
    return {
      get value() { return value; }, set value(v) { value = String(v); },
      get innerHTML() { return html; }, set innerHTML(v) {
        html = v;
        const selected = v.match(/<option value="([^"]+)" selected/);
        if (selected) value = selected[1];
      },
      textContent: '', hidden: false, style: {}, classList: { toggle() {} },
      querySelector() { return node('pill-label'); },
      setAttribute() {}, removeAttribute() {}, addEventListener() {},
      showModal() {}, close() {},
      parentElement: { querySelector() { return null; }, appendChild() {} }
    };
  }
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  }
  node('rank-form').elements = { playlist: element(), mmr: element() };
  const requests = [], chartConfigs = [];
  let fetchReply = async (url, opts) => {
    const body = JSON.parse(opts.body);
    return { ok: true, status: 201, headers: { get() { return 'application/json'; } }, json: async () => ({ ...body, id: 99, at: '2026-10-18T18:00:00Z' }) };
  };
  const now = Date.parse('2026-10-18T18:00:00Z');
  class Clock extends Date { static now() { return now; } }
  const scope = {
    RT_I18N: Object.assign({}, I, { detect() { return 'en'; } }), URLSearchParams, Date: Clock, console,
    location: { search: '', hash: '#/', pathname: '/' },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: {
      readyState: 'loading', addEventListener() {},
      querySelector(sel) { return node(sel.slice(1)); }, getElementById: node,
      createElement: element
    },
    fetch(url, opts) { requests.push({ url, opts }); return fetchReply(url, opts); },
    setTimeout() {}, clearTimeout() {},
    window: { Chart: class { constructor(canvas, config) { chartConfigs.push(config); } destroy() {} } }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const marker = '})(typeof globalThis';
  assert.strictEqual(source.split(marker).length, 2, 'one app closure expected');
  // Expose original closure functions only in this VM. Production has no test hook.
  const exposed = `
    root.ui = { state: state, rankSummary: rankSummary, annotateRanks: annotateRanks,
      openRankDialog: openRankDialog, prefillRank: prefillRank, saveRank: saveRank,
      formTier: formTier, profileRanks: profileRanks, endedSession: endedSession,
      renderRanks: renderRanks, renderRankPrompt: renderRankPrompt, goalItems: goalItems, mpGoals: mpGoals, renderStatus: renderStatus };
    Object.assign(T, { us: '#123456', series: ['#123456', '#abcdef', '#654321'] });
  `;
  vm.runInNewContext(source.replace(marker, exposed + marker), scope, { filename: 'app.js' });
  const ui = scope.ui, s = ui.state;
  // Both actual history and match-page renderers must show raw values at either side of 300.
  for (const lang of ['fr', 'en']) {
    I.setLang(lang);
    const goals = [95, 299, 300, 3120.4].map((speed, i) => ({ t: 30 + i * 30, team: 'us', speed }));
    const m = { result: 'win', duration_s: 300, team_score: 4, opp_score: 0, goals };
    for (const html of [ui.goalItems(m, goals), ui.mpGoals(m)]) {
      assert.ok(!html.includes('km/h'));
      goals.forEach((g) => assert.ok(html.includes(scope.RT.formatRawSpeed(g.speed))));
    }
  }
  I.setLang('en');
  const a = 'epic|a|0', b = 'steam|b|0';
  s.profiles = [{ key: a, name: 'A', n: 2 }, { key: b, name: 'B', n: 1 }];
  s.config = { player_ids: ['Epic|A|0'] };
  s.profile = 'all'; s.loaded = true;
  s.ranks = ui.annotateRanks([
    { id: 1, at: '2026-10-17T18:00:00Z', profile: a, playlist: '2v2', mmr: 1200, tier: 15, division: 2 },
    { id: 2, at: '2026-10-17T19:00:00Z', profile: b, playlist: '2v2', mmr: 700, tier: 9, division: 1 },
    { id: 3, at: '2026-10-17T20:00:00Z', profile: '', playlist: '2v2', mmr: 300, tier: 3, division: 1 }
  ]);
  // M08: neither a summary nor a curve may connect different accounts, including legacy unknowns.
  const summary = ui.rankSummary(s.ranks);
  assert.strictEqual(summary.length, 3);
  assert.ok(summary.every((r) => r.prevMmr === null));
  ui.renderRanks();
  assert.ok(node('rank-cards').innerHTML.includes('Account unspecified'));
  assert.ok(node('rank-cards').innerHTML.includes('A'));
  assert.ok(node('rank-cards').innerHTML.includes('B'));
  assert.ok(!node('rank-cards').innerHTML.includes('−500'));
  // One point in each of three datasets, never a single artificial progression.
  const config = chartConfigs[chartConfigs.length - 1];
  assert.strictEqual(config.data.datasets.length, 3);
  assert.deepStrictEqual(Array.from(config.data.datasets, (d) => d.data.length), [1, 1, 1]);
  const ownDelta = ui.rankSummary(ui.annotateRanks(s.ranks.concat([
    { id: 8, at: '2026-10-18T16:00:00Z', profile: a, playlist: '2v2', mmr: 1250 },
    { id: 9, at: '2026-10-18T17:00:00Z', profile: a, playlist: '1v1', mmr: 900 }
  ])));
  const a2 = ownDelta.find((r) => r.profile === a && r.playlist === '2v2');
  assert.strictEqual(a2.mmr - a2.prevMmr, 50);
  assert.ok(ownDelta.filter((r) => r !== a2).every((r) => r.prevMmr === null));
  ui.openRankDialog('2v2');
  assert.strictEqual(node('rank-form').elements.mmr.value, '1200');
  assert.strictEqual(ui.formTier(), 15);
  assert.ok(node('rank-account').textContent.includes('A'));
  // A subsequent profile selection must not redirect the open form's A values into B.
  s.profile = b;
  await ui.saveRank({ preventDefault() {} });
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].url, '/api/ranks');
  assert.deepStrictEqual(JSON.parse(requests[0].opts.body), { playlist: '2v2', profile: a, tier: 15, division: 2, mmr: 1200 });
  ui.openRankDialog('2v2');
  assert.strictEqual(node('rank-form').elements.mmr.value, '700');
  assert.strictEqual(ui.formTier(), 9);
  await ui.saveRank({ preventDefault() {} });
  assert.strictEqual(JSON.parse(requests[1].opts.body).profile, b);
  assert.strictEqual(JSON.parse(requests[1].opts.body).mmr, 700);
  s.profile = a;
  assert.ok(ui.profileRanks().every((r) => r.profile === a), 'unknown ranks do not silently become A');
  ui.openRankDialog('2v2');
  s.gen++; s.route = { player: 'bob', view: 'history' }; s.dataFor = 'bob';
  await ui.saveRank({ preventDefault() {} });
  assert.strictEqual(requests.length, 2, 'another player route cannot submit the old dialog');
  assert.strictEqual(node('rank-msg').textContent, I.t('rank.contextChanged'));
  s.route = { player: null, view: 'history' }; s.dataFor = ''; s.profile = a;
  // A pending response must not enter another player's state or close a newer dialog.
  let finish;
  fetchReply = () => new Promise((resolve) => { finish = resolve; });
  ui.openRankDialog('2v2');
  const pending = ui.saveRank({ preventDefault() {} });
  s.gen++; s.route = { player: 'bob', view: 'history' }; s.dataFor = 'bob'; s.ranks = [];
  finish({ ok: true, status: 201, headers: { get() { return 'application/json'; } }, json: async () => ({ id: 100, profile: a, playlist: '2v2', mmr: 1200, at: '2026-10-18T18:00:00Z' }) });
  await pending;
  assert.strictEqual(s.ranks.length, 0);
  s.route = { player: null, view: 'history' }; s.dataFor = ''; s.profile = a;
  // M09: casual and abandoned games extend the profile's session before ranked playlists are selected.
  const match = (id, start, end, tag, profile = a, result = 'win') => ({
    id, started_at: new Date(now + start * 60000).toISOString(), ended_at: new Date(now + end * 60000).toISOString(),
    duration_s: (end - start) * 60, tag, mode: '2v2', online: true, result, me: { primary_id: profile }
  });
  s.allRaw = [match(1, -75, -70, 'ranked'), match(2, -50, -45, 'casual'), match(3, -15, -5, 'casual')];
  s.all = scope.RT.annotate(s.allRaw); s.ranks = [];
  assert.strictEqual(ui.endedSession(), null);
  // Exactly 30 minutes of inactivity counts as over; 30-minute inter-match gaps stay in one session.
  s.allRaw = [match(1, -110, -100, 'ranked'), match(2, -80, -70, 'casual'), match(3, -40, -30, 'casual')];
  s.all = scope.RT.annotate(s.allRaw);
  let ended = ui.endedSession();
  assert.ok(ended);
  assert.deepStrictEqual(Array.from(ended.todo), ['2v2']);
  assert.strictEqual(ended.count['2v2'], 1);
  assert.strictEqual(ended.start, Date.parse(s.allRaw[0].started_at));
  s.ranks = ui.annotateRanks([{ id: 4, profile: b, playlist: '2v2', mmr: 900, at: new Date(now).toISOString() }]);
  assert.ok(ui.endedSession(), 'B noting a rank cannot satisfy A');
  s.ranks[0].profile = a;
  assert.strictEqual(ui.endedSession(), null);
  s.ranks = [];
  s.allRaw.push(match(4, -10, -5, 'casual', a, 'abandoned')); s.all = scope.RT.annotate(s.allRaw);
  assert.strictEqual(ui.endedSession(), null);
  s.allRaw = [match(1, -70, -60, 'ranked'), match(2, -10, -5, 'casual', b)];
  s.profile = 'all'; s.all = scope.RT.annotate(s.allRaw);
  assert.ok(ui.endedSession(), 'B activity does not extend A session when all accounts are shown');
  s.profile = b;
  assert.strictEqual(ui.endedSession(), null);
  s.profile = a;
  s.allRaw = [match(1, -70, -60, 'ranked'), match(2, -25, -20, 'casual')]; s.all = scope.RT.annotate(s.allRaw);
  assert.strictEqual(ui.endedSession(), null, 'a later casual-only session has no ranked playlist to note');
  // Local persistence is independent of delivery; hosted/other-player status never shows this queue.
  const callsBeforeStatus = requests.length;
  s.mode = 'local'; s.route = { player: null, view: 'history' }; s.dataFor = '';
  s.statusError = false;
  const delivery = { pending: 2, held: 3, rejected: 1, legacy_held: 4 };
  s.status = { connected: true, delivery };
  for (const lang of ['fr', 'en']) {
    I.setLang(lang);
    ui.renderStatus();
    const html = node('warnings').innerHTML;
    assert.ok(html.includes(I.t('st.deliveryTitle')));
    assert.ok(html.includes(I.t('st.deliveryCounts', delivery)));
    assert.ok(html.includes(I.t('st.deliveryHeld')));
    assert.ok(html.includes(I.t('st.deliveryRejected')));
    assert.ok(!html.includes('<button'), 'delivery notice is informational, never a send/rebind action');
  }
  I.setLang('en');
  s.mode = 'server'; ui.renderStatus();
  assert.ok(!node('warnings').innerHTML.includes(I.t('st.deliveryTitle')));
  s.mode = 'local'; s.dataFor = 'bob'; ui.renderStatus();
  assert.ok(!node('warnings').innerHTML.includes(I.t('st.deliveryTitle')));
  s.dataFor = ''; s.statusError = true; ui.renderStatus();
  assert.ok(!node('warnings').innerHTML.includes(I.t('st.deliveryTitle')), 'stale queue is not current status');
  s.statusError = false;
  for (const absent of [undefined, { pending: 1 }, { ...delivery, pending: -1 }, { ...delivery, held: '<script>' }]) {
    s.status.delivery = absent; ui.renderStatus();
    assert.ok(!node('warnings').innerHTML.includes(I.t('st.deliveryTitle')));
  }
  s.status.delivery = { pending: 0, held: 0, rejected: 0, legacy_held: 0 }; ui.renderStatus();
  assert.ok(node('warnings').innerHTML.includes(I.t('st.deliveryCounts', s.status.delivery)));
  assert.ok(!node('warnings').innerHTML.includes(I.t('st.deliveryHeld')));
  assert.strictEqual(requests.length, callsBeforeStatus, 'rendering status triggers no transport');
  console.log('profiles/session/delivery UI contracts ok (minimal DOM, captured HTTP only)');
}

module.exports = run;
if (require.main === module) run().catch((err) => { console.error(err); process.exitCode = 1; });
