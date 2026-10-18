// Original loaders under controlled fetch promises; presentation is stubbed, not browser-tested.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const I = require('../i18n.js');

function harness(reply) {
  const requests = [], waiters = [], renders = [], snapshots = [];
  function response(data) {
    return { ok: true, status: 200, headers: { get() { return 'application/json'; } }, json: async () => data };
  }
  const scope = {
    RT_I18N: Object.assign({}, I, { detect() { return 'en'; } }), URLSearchParams,
    console: { warn() {} }, location: { search: '', hash: '#/', pathname: '/' },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { readyState: 'loading', addEventListener() {} },
    fetch(url) {
      if (reply) { requests.push({ url }); return reply(url).then(response); }
      return new Promise((resolve, reject) => {
        const request = { url, respond(data) { resolve(response(data)); }, reject, taken: false };
        requests.push(request);
        const index = waiters.findIndex((w) => w.url === url);
        if (index >= 0) { request.taken = true; waiters.splice(index, 1)[0].resolve(request); }
      });
    },
    setTimeout() {}, clearTimeout() {}, window: {}, record(view) {
      renders.push(view);
      snapshots.push({ view, manualGames: scope.pollUI.state.manual.map((m) => m.games) });
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const marker = '})(typeof globalThis';
  assert.strictEqual(source.split(marker).length, 2);
  const exposed = `
    renderAll = function () { root.record('all'); };
    renderRanks = function () { root.record('ranks'); };
    renderStatus = renderTraining = renderProfileSwitch = autoOpenLive = function () {};
    renderPlayers = function () { root.record('players'); };
    syncNav = function () { root.record('nav'); };
    root.pollUI = { state: state, loadAll: loadAll, loadMatches: loadMatches,
      loadRanks: loadRanks, loadManual: loadManual, loadTrainings: loadTrainings,
      pollStatus: pollStatus, loadPlayers: loadPlayers, selectProfile: selectProfile };
  `;
  vm.runInNewContext(source.replace(marker, exposed + marker), scope, { filename: 'app.js' });
  const ui = scope.pollUI;
  Object.assign(ui.state, { mode: 'server', loaded: true, route: { player: null, view: 'history' } });
  return { ui, requests, renders, snapshots,
    next(url) {
      const request = requests.find((r) => r.url === url && !r.taken);
      if (request) { request.taken = true; return Promise.resolve(request); }
      return new Promise((resolve) => waiters.push({ url, resolve }));
    }
  };
}

async function rankRetry(revision = true) {
  let attempts = 0;
  const status = { ...(revision ? { data_rev: 7 } : {}), match_count: 1, training_count: 0 };
  const h = harness(async (url) => {
    if (url.endsWith('/status')) return status;
    if (url.endsWith('/ranks')) {
      if (++attempts === 1) throw new Error('synthetic rank failure');
      return [{ id: 7, at: '2026-10-18T12:00:00Z', profile: 'epic|a|0', playlist: '2v2', mmr: 1200 }];
    }
    return [];
  });
  const s = h.ui.state;
  s.status = status;
  s.lastTrainings = revision ? 'rev:7' : 0;
  s.ranks = [{ mmr: 1000 }];
  await h.ui.loadMatches();
  assert.strictEqual(s.ranks[0].mmr, 1000, 'rank failure preserves last successful entries');
  await h.ui.pollStatus();
  assert.strictEqual(attempts, 2, 'unchanged match revision must retry a failed rank request');
  assert.strictEqual(s.ranks[0].mmr, 1200);
  await h.ui.pollStatus();
  assert.strictEqual(attempts, 2, 'successful ranks are not fetched on every unchanged poll');
  assert.strictEqual(h.requests.filter((r) => r.url.endsWith('/matches')).length, 1,
    'rank retry does not refetch successful match data');
}

async function manualRevision() {
  let revision = 7, games = 1, attempts = 0, fail = false;
  const h = harness(async (url) => {
    if (url.endsWith('/status')) return { data_rev: revision, match_count: 1, training_count: 0 };
    if (url.endsWith('/manual')) {
      attempts++;
      if (fail) { fail = false; throw new Error('synthetic manual failure'); }
      return [{ day: '2026-10-18', mode: '2v2', games, wins: 0 }];
    }
    return [];
  });
  const s = h.ui.state;
  s.status = { data_rev: revision }; s.lastTrainings = 'rev:7';
  await h.ui.loadManual(); await h.ui.loadMatches();
  games = 2; revision = 8;
  await h.ui.pollStatus();
  assert.strictEqual(s.manual[0].games, 2, 'data_rev change invalidates manual entries too');
  assert.strictEqual(attempts, 2);
  assert.deepStrictEqual(Array.from(h.snapshots.at(-1).manualGames), [2],
    'updated manual values reach the rendering boundary, not only the cache');
  revision = 9; fail = true;
  await h.ui.pollStatus();
  assert.strictEqual(s.manual[0].games, 2, 'transient failure preserves last successful entries');
  await h.ui.pollStatus();
  assert.strictEqual(attempts, 4, 'manual failure retries at unchanged revision');
  await h.ui.pollStatus();
  assert.strictEqual(attempts, 4);
}

async function lateLeaderboard() {
  const h = harness(), s = h.ui.state;
  s.route.view = 'players'; s.lb.mode = '1v1';
  const old = h.ui.loadPlayers();
  const oldPlayers = await h.next('/api/players');
  const oldBoard = await h.next('/api/leaderboard?mode=1v1&tag=all&days=30');
  s.lb.mode = '2v2'; s.lb.tag = 'ranked'; s.lb.period = '7';
  const current = h.ui.loadPlayers();
  (await h.next('/api/players')).respond([{ handle: 'current' }]);
  (await h.next('/api/leaderboard?mode=2v2&tag=ranked&days=7')).respond([{ handle: 'current', games: 8 }]);
  await current;
  oldPlayers.respond([{ handle: 'old' }]); oldBoard.respond([{ handle: 'old', games: 99 }]);
  await old;
  assert.strictEqual(s.players[0].handle, 'current');
  assert.strictEqual(s.leaders[0].games, 8);
  assert.deepStrictEqual(h.renders, ['players'], 'late leaderboard filter response does not render');
}

const match = (id, profile) => ({ id, me: { primary_id: profile }, result: 'win',
  mode: '2v2', started_at: '2026-10-18T12:00:00Z', duration_s: 300 });

async function lateProfile() {
  const h = harness(), s = h.ui.state;
  const a = 'epic|a|0', b = 'steam|b|0';
  s.allRaw = [match(1, a), match(2, b)]; s.profiles = [{ key: a }, { key: b }];
  s.profileFor = ''; s.profile = a;
  const pending = h.ui.loadMatches();
  const ranks = await h.next('/api/ranks'), matches = await h.next('/api/matches');
  const shared = await h.next('/api/shared');
  h.ui.selectProfile(b);
  ranks.respond([]); shared.respond([]); matches.respond([match(1, a), match(2, b), match(3, b)]);
  await pending;
  assert.strictEqual(s.profile, b, 'late data refresh keeps the selected in-game account');
  assert.deepStrictEqual(Array.from(s.all, (m) => m.id), [2, 3]);
}

async function latePlayerRoute() {
  const h = harness(), s = h.ui.state;
  const oldManual = h.ui.loadManual(), oldRanks = h.ui.loadRanks(), oldMatches = h.ui.loadMatches();
  const oldTraining = h.ui.loadTrainings(), oldStatus = h.ui.pollStatus();
  const captured = {};
  // loadMatches can start an additional rank fetch on the unfixed code: answer every old request below.
  for (const r of h.requests) captured[r.url] = true;
  s.route = { player: 'bob', view: 'history' };
  const fresh = h.ui.loadAll();
  (await h.next('/api/players/bob/status')).respond({ data_rev: 8, match_count: 1, training_count: 0 });
  (await h.next('/api/players/bob/config')).respond({ player_ids: ['Epic|Bob|0'] });
  (await h.next('/api/players/bob/manual')).respond([{ games: 2 }]);
  (await h.next('/api/players/bob/trainings')).respond([{ id: 22 }]);
  (await h.next('/api/players/bob/ranks')).respond([{ id: 23, at: '2026-10-18T12:00:00Z', mmr: 900 }]);
  (await h.next('/api/players/bob/shared')).respond([]);
  (await h.next('/api/players/bob/matches')).respond([match(24, 'epic|bob|0')]);
  await fresh;
  const before = h.renders.length;
  for (const r of h.requests.filter((r) => captured[r.url])) {
    r.respond(r.url.endsWith('/status') ? { data_rev: 1, match_count: 99, training_count: 99 }
      : [{ id: 99, games: 99, mmr: 9999, at: '2026-10-18T12:00:00Z' }]);
  }
  await Promise.all([oldManual, oldRanks, oldMatches, oldTraining, oldStatus]);
  assert.strictEqual(s.dataFor, 'bob');
  assert.strictEqual(s.allRaw[0].id, 24);
  assert.strictEqual(s.manual[0].games, 2);
  assert.strictEqual(s.ranks[0].mmr, 900);
  assert.strictEqual(s.trainings[0].id, 22);
  assert.strictEqual(s.status.data_rev, 8);
  assert.strictEqual(h.renders.length, before, 'old player responses cannot render the new route');
  assert.strictEqual(s.matchesBusy, 0); assert.strictEqual(s.trainingsBusy, 0);
  assert.strictEqual(s.manualBusy, 0); assert.strictEqual(s.ranksBusy, 0);
}

async function lateInitialRoute() {
  const h = harness(), s = h.ui.state;
  const old = h.ui.loadAll();
  const oldRequests = h.requests.slice();
  s.route = { player: 'bob', view: 'history' };
  const current = h.ui.loadAll();
  (await h.next('/api/players/bob/status')).respond({ data_rev: 8, match_count: 1, training_count: 0 });
  (await h.next('/api/players/bob/config')).respond({ player_ids: ['Epic|Bob|0'] });
  (await h.next('/api/players/bob/manual')).respond([{ games: 2 }]);
  (await h.next('/api/players/bob/trainings')).respond([]);
  (await h.next('/api/players/bob/ranks')).respond([]);
  (await h.next('/api/players/bob/shared')).respond([]);
  (await h.next('/api/players/bob/matches')).respond([match(8, 'epic|bob|0')]);
  await current;
  const count = h.requests.length, renders = h.renders.length;
  oldRequests.forEach((r) => r.respond(r.url.endsWith('/status') ? { data_rev: 1 } : []));
  await old;
  assert.strictEqual(h.requests.length, count, 'stale initial config/manual completion must not start requests in the new route');
  assert.strictEqual(h.renders.length, renders);
  assert.strictEqual(s.allRaw[0].id, 8);
}

async function pendingRevision() {
  const h = harness(), s = h.ui.state;
  Object.assign(s, { status: { data_rev: 7 }, lastCount: 'rev:7', lastTrainings: 'rev:7',
    lastRanks: 'rev:6', lastManual: 'rev:6' });
  const first = h.ui.pollStatus();
  (await h.next('/api/status')).respond({ data_rev: 7 });
  const ranks = await h.next('/api/ranks'), manual = await h.next('/api/manual');
  const second = h.ui.pollStatus();
  (await h.next('/api/status')).respond({ data_rev: 8 });
  (await h.next('/api/shared')).respond([]);
  (await h.next('/api/matches')).respond([]);
  (await h.next('/api/trainings')).respond([]);
  await second;
  assert.strictEqual(h.requests.filter((r) => r.url === '/api/ranks').length, 1, 'no overlapping poll rank requests');
  assert.strictEqual(h.requests.filter((r) => r.url === '/api/manual').length, 1, 'no overlapping poll manual requests');
  ranks.respond([]); manual.respond([{ games: 1 }]);
  await first;
  assert.strictEqual(s.lastRanks, 'rev:7'); assert.strictEqual(s.lastManual, 'rev:7');
  const third = h.ui.pollStatus();
  (await h.next('/api/status')).respond({ data_rev: 8 });
  (await h.next('/api/ranks')).respond([]);
  (await h.next('/api/manual')).respond([{ games: 2 }]);
  await third;
  assert.strictEqual(s.lastRanks, 'rev:8'); assert.strictEqual(s.lastManual, 'rev:8');
  assert.strictEqual(s.manual[0].games, 2, 'a request only acknowledges the revision observed when it started');
}

async function run() {
  let guard;
  try {
    // A timeout only fails a deadlocked test; successful ordering uses controlled promises.
    const results = await Promise.race([
      Promise.allSettled([rankRetry(), rankRetry(false), manualRevision(), pendingRevision(),
        lateLeaderboard(), lateProfile(), latePlayerRoute(), lateInitialRoute()]),
      new Promise((resolve, reject) => { guard = setTimeout(() => reject(new Error('controlled request test deadlocked')), 5000); })
    ]);
    for (const result of results) if (result.status === 'rejected') console.error(result.reason);
    assert.ok(results.every((r) => r.status === 'fulfilled'), 'polling/late-response contracts');
    console.log('polling retry/revision and controlled late leaderboard/profile/player responses ok (8 scenarios)');
  } finally { clearTimeout(guard); }
}
module.exports = run;
if (require.main === module) run().catch((err) => { console.error(err); process.exitCode = 1; });
