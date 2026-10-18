// Checks the translations: run with `node devtools/i18n_test.js` (also run by `go test ./web`).
// - every entry has a French and an English value with the same {placeholders};
// - every key used by app.js (literal tr('…') calls and the dynamic prefixes) and index.html exists;
// - the pure helpers render in both languages.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const WEB = path.join(__dirname, '..', 'web');
const I = require(path.join(WEB, 'i18n.js'));
const RT = require(path.join(WEB, 'app.js'));

const M = I.messages;
const problems = [];
const ph = (v) => (typeof v === 'string' ? (v.match(/\{\w+\}/g) || []).sort().join()
  : v && typeof v === 'object' && !Array.isArray(v) ? ph(v.one) + '|' + ph(v.other) : '');
for (const k of Object.keys(M)) {
  const e = M[k];
  if (!Array.isArray(e) || e.length !== I.LANGS.length || e.some((v) => v == null || v === '' && k !== '')) { problems.push('incomplete entry ' + k); continue; }
  if (ph(e[0]).replace(/\|/g, ',').split(',').filter(Boolean).sort().join() !== ph(e[1]).replace(/\|/g, ',').split(',').filter(Boolean).sort().join()) {
    problems.push('placeholders differ: ' + k);
  }
}

const app = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8') + fs.readFileSync(path.join(WEB, 'setup.html'), 'utf8');
const wizard = fs.readFileSync(path.join(WEB, 'setup.js'), 'utf8');
const used = new Set();
for (const m of app.matchAll(/tr\('([A-Za-z0-9_.]+)'/g)) used.add(m[1]);
for (const m of app.matchAll(/'((?:st|mp|tbl|kpi|goal|goals|hist|match|res|pl|lb|dev|onb|act|sit|mental|time|mech|perf|hits|feed|nav|toast|common|footer|badge|ui|set|day|prog|unit|fmt|pb|confirm|filters|settings|wf|field|fatigue|focus|trn|live)\.[A-Za-z0-9_.]+)'/g)) used.add(m[1]);
for (const m of wizard.matchAll(/'(wiz\.[A-Za-z0-9_.]+)'/g)) used.add(m[1]);
for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(';').forEach((p) => used.add(p.split(':')[1].trim()));
// Keys built at runtime.
['score', 'goals', 'assists', 'saves', 'shots', 'touches', 'demos'].forEach((k) => used.add('perf.' + k));
['win', 'loss', 'abandoned'].forEach((r) => { used.add('res.' + r); used.add('res.' + r + '.short'); });
RT.MECH_METRICS.forEach((m) => used.add('mech.' + m.key));
RT.PERF_STATS.concat(RT.MOVE_STATS, RT.HIT_STATS).forEach((s) => used.add(s.lk));
RT.TAGS.forEach((t) => used.add('tag.' + t));
RT.FOCUSES.forEach((f) => { used.add('focus.' + f); used.add('drill.' + f); });
RT.FACTORS.concat(RT.FATIGUE_STATS).forEach((f) => used.add(f.lk));
['match', 'game', 'day', 'player', 'goal', 'abandon', 'session'].forEach((u) => used.add('unit.' + u));
for (const k of used) if (!k.endsWith('.') && !I.has(k)) problems.push('missing key ' + k);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

// Rendering in both languages.
I.setLang('fr');
assert.strictEqual(RT.plural(1, 'match'), '1 match');
assert.strictEqual(RT.plural(3, 'match'), '3 matchs');
assert.strictEqual(RT.fmtPct(0.5), '50 %');
assert.strictEqual(RT.tagLabel('ranked'), 'Classé');
assert.strictEqual(RT.prettyArena('EuroStadium_Night_P'), 'Mannfield (Nuit)');
I.setLang('en');
assert.strictEqual(RT.plural(1, 'match'), '1 match');
assert.strictEqual(RT.plural(3, 'match'), '3 matches');
assert.strictEqual(RT.fmtNum(1234.5, 1), '1,234.5');
assert.strictEqual(RT.fmtPct(0.5), '50%');
assert.strictEqual(RT.tagLabel('ranked'), 'Ranked');
assert.strictEqual(RT.prettyArena('EuroStadium_Night_P'), 'Mannfield (Night)');
assert.strictEqual(I.t('goals.decided', { n: 2, v: '2' }), '2 decided matches');
assert.strictEqual(I.t('nope.missing'), 'nope.missing');
// Routes: English, and the French ones of older versions still work.
assert.deepStrictEqual(RT.parseRoute('#/historique'), { view: 'history', id: null, player: null });
assert.deepStrictEqual(RT.parseRoute('#/joueur/Bob/match/3'), { view: 'match', id: 3, player: 'bob' });
assert.strictEqual(RT.routeHash('bob', 'history'), '#/player/bob/history');
// Kickoff goals: within 3 s of the match start, the previous goal or the overtime start.
const G = (t, team, ot) => ({ t: t, team: team, overtime: !!ot });
const koReg = { result: 'loss', duration_s: 300, team_score: 1, opp_score: 3, goals: [G(2, 'them'), G(50, 'us'), G(53, 'them'), G(57, 'them')] };
const koOt = { result: 'win', overtime: true, duration_s: 320, overtime_s: 20, team_score: 2, opp_score: 1, goals: [G(100, 'them'), G(298, 'us'), G(302, 'us', true)] };
assert.deepStrictEqual(RT.kickoffGoals(koReg).map((k) => k.kickoff), [true, false, true, false]);
assert.deepStrictEqual(RT.kickoffGoals(koOt).map((k) => k.kickoff), [false, false, true]);
const ko = RT.computeSituations([koReg, koOt]).kickoff;
assert.deepStrictEqual([ko.kickoffs, ko.won, ko.lost, ko.conceded, ko.afterLost.n], [9, 1, 2, 4, 1]);
// Score at half-time: ahead / level / behind, leads lost, comebacks.
const sc = RT.computeScoreStates([koReg, koOt]);
assert.deepStrictEqual([sc.ahead.n, sc.level.n, sc.behind.n, sc.led, sc.trailed], [0, 0, 2, 1, 2]);
assert.strictEqual(sc.comebackShare, 0.5);
// Touches: thirds from my side, aerial touches, the map cells.
const P = (x, y, z, pre, post) => ({ x: x, y: y, z: z, pre: pre, post: post });
const tm = RT.computeTouches([{ result: 'win', hits: { points: [P(0, 4000, 93, 0, 3000), P(0, -4000, 600, 500, 900), P(0, 0, 93, 0, 1000)] } }]);
assert.deepStrictEqual([tm.n, tm.off, tm.def, tm.mid, tm.aerial, tm.powerful], [3, 1, 1, 1, 1, 1]);
assert.strictEqual(tm.cells.reduce((s, c) => s + c, 0), 3);
// Win factors: a stat that splits wins from losses is reported, with its direction.
const fm = [];
for (let i = 0; i < 40; i++) fm.push({ result: i % 2 ? 'win' : 'loss', duration_s: 300, me: {}, movement: { zero_boost_pct: i % 2 ? 5 + i / 100 : 15 + i / 100 } });
const wf = RT.computeWinFactors(fm);
const zb = wf.clear.find((r) => r.key === 'zero_boost');
assert.ok(zb && zb.better === 'less' && zb.lo.wr > 0.9 && zb.hi.wr === 0, JSON.stringify(zb));
assert.strictEqual(RT.computeFocusSuggestions(fm)[0].focus, 'boost');
// Warm-up plan: car control first, then the suggested mechanics, the minutes add up.
const plan = RT.buildWarmupPlan([{ focus: 'boost' }, { focus: 'freeplay' }, { focus: 'kickoff' }], 15);
assert.deepStrictEqual(plan.map((b) => b.focus), ['freeplay', 'boost', 'kickoff']);
assert.strictEqual(plan.reduce((s, b) => s + b.minutes, 0), 15);
assert.deepStrictEqual(RT.buildWarmupPlan([], 10).map((b) => b.focus), ['freeplay', 'shooting', 'aerials']);
// Warm-up effect: a training of 5+ min ended within an hour before a session's first match warms it up.
const H = 3600000, base = Date.UTC(2026, 9, 1, 18);
const wm = [];
for (let d = 0; d < 12; d++) {
  for (let i = 0; i < 3; i++) {
    const t = base + d * 24 * H + i * 8 * 60000;
    wm.push({ id: d * 10 + i, started_at: new Date(t).toISOString(), ended_at: new Date(t + 6 * 60000).toISOString(), duration_s: 300,
      result: d % 2 === 0 ? 'win' : 'loss', me: { touches: 30 } });
  }
}
const tr0 = (d, min, gap) => ({ started_at: new Date(base + d * 24 * H - gap - min * 60000).toISOString(), ended_at: new Date(base + d * 24 * H - gap).toISOString() });
const trainings = [0, 2, 4, 6, 8, 10].map((d) => tr0(d, 15, 5 * 60000)).concat([tr0(1, 3, 0), tr0(3, 20, 2 * H)]); // too short, too early
const eff = RT.computeWarmupEffect(RT.annotate(wm), trainings);
assert.deepStrictEqual([eff.warm.sessions, eff.cold.sessions, eff.warm.first.wr, eff.cold.first.wr, eff.enough], [6, 6, 1, 0, true]);
const ts = RT.computeTrainingSummary(trainings, RT.annotate(wm), base + 12 * 24 * H);
assert.strictEqual(ts.count, 8);
// Live: the same score at the same time in my matches of the mode; overtimes apart; the session going on.
const lm = [];
for (let i = 0; i < 10; i++) {
  // Even: 1–0 up at 2:00 then won; odd: 0–1 down at 2:00 then lost (the last one in overtime).
  const up = i % 2 === 0;
  lm.push({ id: i, mode: '2v2', online: true, result: up ? 'win' : 'loss', duration_s: i === 9 ? 360 : 300, overtime: i === 9, overtime_s: i === 9 ? 60 : 0,
    team_score: up ? 1 : 0, opp_score: up ? 0 : 1, goals: [{ t: 100, team: up ? 'us' : 'them' }],
    started_at: new Date(base + i * 7 * 60000).toISOString(), ended_at: new Date(base + i * 7 * 60000 + 300000).toISOString(), me: { score: 300 } });
}
const la = RT.annotate(lm);
assert.deepStrictEqual([RT.liveOdds(la, '2v2', 120, 1, false).n, RT.liveOdds(la, '2v2', 120, 1, false).wr], [5, 1]);
assert.deepStrictEqual([RT.liveOdds(la, '2v2', 120, -1, false).n, RT.liveOdds(la, '2v2', 120, -1, false).wr], [5, 0]);
assert.strictEqual(RT.liveOdds(la, '2v2', 60, 0, false).n, 10); // before the goal: all level
assert.strictEqual(RT.liveOdds(la, '1v1', 60, 0, false).n, 0);
assert.strictEqual(RT.liveOdds(la, '2v2', 330, 0, true).n, 1);
// A forfeit freezes the score: 0–2 at 3:00 then given up at 3:20 still counts as a loss at 0–2 later on.
// Down 2 at 1:30 left (210 s): 4 played to the end and lost, 2 comebacks (down 2 from 205 s), 6 forfeits.
const ffm = [];
const ffg = (goals, result, dur, extra) => {
  const us = goals.filter((g) => g[1] === 'us').length;
  ffm.push(Object.assign({ id: 100 + ffm.length, mode: '2v2', online: true, result, duration_s: dur, team_score: us, opp_score: goals.length - us,
    goals: goals.map((g) => ({ t: g[0], team: g[1] })), started_at: new Date(base + ffm.length * H).toISOString() }, extra || {}));
};
for (let i = 0; i < 4; i++) ffg([[100, 'them'], [180, 'them']], 'loss', 300);
for (let i = 0; i < 2; i++) ffg([[190, 'them'], [205, 'them'], [240, 'us'], [270, 'us'], [295, 'us']], 'win', 300);
for (let i = 0; i < 6; i++) ffg([[100, 'them'], [180, 'them']], 'loss', 200, { forfeit: true });
ffg([[100, 'them'], [180, 'them']], 'loss', 200); // ended early without a forfeit (left before the end): unknown later
const ffo = RT.liveOdds(RT.annotate(ffm), '2v2', 210, -2, false);
assert.deepStrictEqual([ffo.wins, ffo.n], [2, 12]);
assert.ok(ffo.ci.lo < ffo.wr && ffo.wr < ffo.ci.hi && ffo.ci.lo >= 0 && ffo.ci.hi <= 1);
// Wilson 90 %: 0 of 5 is still compatible with about 35 %, and an empty sample has no interval.
assert.ok(RT.wilson(0, 5).lo === 0 && RT.wilson(0, 5).hi > 0.3);
assert.ok(Math.abs(RT.wilson(10, 20).lo + RT.wilson(10, 20).hi - 1) < 1e-9);
assert.strictEqual(RT.wilson(0, 0), null);
const cs = RT.currentSession(la, base + 9 * 7 * 60000 + 320000, '2v2');
assert.deepStrictEqual([cs.n, cs.next, cs.record.wins, cs.streak.type], [10, 11, 5, 'loss']);
assert.strictEqual(RT.currentSession(la, base + 9 * 7 * 60000 + 300000 + 31 * 60000, '2v2'), null);
const lv = RT.liveAsMatch({ mode: '2v2', my_team: 1, team_score: 1, opp_score: 0, elapsed_s: 90, me: { name: 'Me', goals: 1 },
  players: [{ name: 'Opp', team: 0 }], goals: [{ t: 50, team: 1, scorer: 'Me', assister: '' }, { t: 60, team: -1, scorer: '' }] });
assert.deepStrictEqual([lv.players.length, lv.players[0].is_me, lv.goals[0].team, lv.goals[0].me_scored, lv.goals[1].team], [2, true, 'us', true, '']);
assert.strictEqual(RT.livePace(2, 150, false), 4);
assert.strictEqual(RT.livePace(2, 30, false), null);
// Status polling: data_rev first, the count without it (older server/agent); null (never/failed) reloads.
assert.strictEqual(RT.dataMarker({ data_rev: 7, match_count: 3 }, 'match_count'), 'rev:7');
assert.strictEqual(RT.dataMarker({ match_count: 3 }, 'match_count'), 3);
assert.strictEqual(RT.dataMarker({ match_count: 3 }, 'training_count'), null);
assert.strictEqual(RT.dataMarker(null, 'match_count'), null);
assert.strictEqual(RT.needsReload('rev:7', 'rev:7'), false);
assert.strictEqual(RT.needsReload('rev:8', 'rev:7'), true);
assert.strictEqual(RT.needsReload(3, null), true); // the last load failed: retried with no new match
assert.strictEqual(RT.needsReload(null, 3), false);
assert.deepStrictEqual(['v0.19.0', '0.19.0', '', undefined].map(RT.stripV), ['0.19.0', '0.19.0', '', '']);
console.log('i18n ok: ' + Object.keys(M).length + ' keys, ' + used.size + ' used');

// Live momentum: the last 90 s against the earlier part of the match, per team.
{
  const ev = (t, kind, team) => ({ t, kind, team });
  // Opponents: 6 shots and 2 goals over the first 150 s (2.4/min), then 1 shot, saved, in the last 90 s (3.6 expected).
  // My team: 1 shot before (missed), 4 in the last 90 s (0.6 expected), 2 of them scored.
  const events = [30, 50, 70, 90, 110, 140].map((t) => ev(t, 'shot', 'them')).concat([ev(100, 'shot', 'us'), ev(160, 'shot', 'them')],
    [170, 190, 210, 230].map((t) => ev(t, 'shot', 'us')), [ev(160, 'save', 'us'), ev(190, 'save', 'them')]);
  const goals = [{ t: 50, team: 'them' }, { t: 110, team: 'them' }, { t: 210, team: 'us' }, { t: 230, team: 'us' }];
  const mo = RT.computeMomentum({ events, goals }, 240);
  assert.deepStrictEqual([mo.them.recent.shots, mo.them.before.shots, mo.them.recent.goals, mo.us.recent.shots, mo.us.recent.goals], [1, 6, 0, 4, 2]);
  assert.ok(Math.abs(mo.them.expected - 3.6) < 1e-9 && Math.abs(mo.us.recent.shotsPerMin - 4 * 60 / 90) < 1e-9);
  assert.deepStrictEqual([mo.us.lastMin, mo.them.lastMin], [3, 0]); // shots after 180 s
  assert.deepStrictEqual([mo.them.recent.unconverted, mo.us.recent.unconverted], [0, 1]); // theirs saved; 4 of mine: 2 in, 1 saved, 1 neither
  assert.deepStrictEqual(mo.signals.map((s) => s.key).sort(), ['themFading', 'usRising', 'usSharper'].sort());
  // As many shots as before (4 against 3.6 expected) but no more goals: blunted, not fading.
  const blunt = events.concat([175, 200, 220].map((t) => ev(t, 'shot', 'them')));
  assert.deepStrictEqual(RT.computeMomentum({ events: blunt, goals }, 240).signals.filter((x) => x.key.startsWith('them')).map((x) => x.key), ['themBlunted']);
  // Before 3:00 of play the earlier part is shorter than the window: no change is stated yet.
  assert.deepStrictEqual(RT.computeMomentum({ events, goals }, 170).signals, []);
  // An agent without timed events, or the first minute: no momentum at all (missing, not zero).
  assert.strictEqual(RT.computeMomentum({ events: null, goals }, 240), null);
  assert.strictEqual(RT.computeMomentum({ events: [], goals: [] }, 40), null);
  const lvm = RT.liveAsMatch({ my_team: 1, elapsed_s: 100, events: [{ t: 10, kind: 'shot', team: 0 }, { t: 20, kind: 'save', team: 1, me: true }] });
  assert.deepStrictEqual(lvm.events, [{ t: 10, kind: 'shot', team: 'them', me: false }, { t: 20, kind: 'save', team: 'us', me: true }]);
  assert.strictEqual(RT.liveAsMatch({ my_team: 0 }).events, null);
}

// Honor Duels (3:00): own filter (left out of the stats by default, kept in the history), compared only with duels.
{
  const at = (i) => new Date(base + i * H).toISOString();
  const duel = (i, result, goalsT) => ({ id: 500 + i, mode: '1v1', online: true, result, regulation_s: 180, duration_s: 180, started_at: at(i),
    team_score: result === 'win' ? 1 : 0, opp_score: result === 'win' ? 0 : 1, goals: [{ t: goalsT, team: result === 'win' ? 'us' : 'them' }], me: { score: 100 } });
  const std = (i, result) => ({ id: 600 + i, mode: '1v1', online: true, result, regulation_s: 300, duration_s: 300, started_at: at(i),
    team_score: result === 'win' ? 1 : 0, opp_score: result === 'win' ? 0 : 1, goals: [{ t: 30, team: result === 'win' ? 'us' : 'them' }], me: { score: 500 } });
  const ms = RT.annotate([duel(0, 'win', 30), duel(1, 'win', 30), duel(2, 'win', 30), std(3, 'loss'), std(4, 'loss'), std(5, 'loss'), duel(6, 'loss', 30)]);
  const now = base + 10 * H;
  assert.ok(RT.isDuel(ms[0]) && !RT.isDuel(ms[3]) && !RT.isDuel({ duration_s: 180 })); // a 3:00 forfeit is not a duel
  assert.strictEqual(RT.regulationS(ms[0]), 180);
  const f = Object.assign({}, RT.DEFAULT_FILTERS, { period: 'all' });
  assert.strictEqual(RT.filterMatches(ms, f, now).length, 3);
  assert.strictEqual(RT.filterMatches(ms, Object.assign({}, f, { duel: 'only' }), now).length, 4);
  assert.strictEqual(RT.filterMatches(ms, Object.assign({}, f, { duel: 'include' }), now).length, 7);
  assert.strictEqual(RT.filterHistory(ms, {}, now).length, 7);
  assert.strictEqual(RT.filterHistory(ms, { duel: 'exclude' }, now).length, 3);
  const b = RT.matchBaseline(ms, 506, 50);
  assert.deepStrictEqual([b.n, b.duel, b.me.score.avg], [3, true, 100]);
  assert.deepStrictEqual([RT.matchBaseline(ms, 605, 50).n, RT.matchBaseline(ms, 605, 50).me.score.avg], [2, 500]);
  // 1–0 up at 1:00 in a duel: only the duels count.
  const od = RT.liveOdds(ms, '1v1', 60, 1, false, true), os = RT.liveOdds(ms, '1v1', 60, 1, false, false);
  assert.deepStrictEqual([od.n, od.wins, os.n], [3, 3, 0]);
}
