// Checks pure analytics and state helpers: node web/tests/analytics.test.js (also run by go test ./web).
'use strict';
const assert = require('assert');
const I = require('../i18n.js');
const RT = require('../app.js');

I.setLang('en');
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
// M01: ties must belong to the same median group in recent form and in the comparison.
const medianGames = Array.from({ length: 40 }, (_, i) => ({
  result: i < 20 ? 'win' : 'loss', duration_s: 300, mode: '2v2',
  movement: { air_pct: i < 20 ? 20 : 80 }
}));
const airFactor = RT.computeWinFactors(medianGames).rows.find((r) => r.key === 'air');
assert.deepStrictEqual([airFactor.threshold, airFactor.inclusive, airFactor.hi.n, airFactor.lo.n], [80, true, 20, 20]);
assert.strictEqual(airFactor.recentBadShare, 1);
assert.ok(RT.computeFocusSuggestions(medianGames).some((s) => s.focus === 'aerials'));
const reversedAir = medianGames.map((m) => ({ ...m, result: m.result === 'win' ? 'loss' : 'win' }));
assert.strictEqual(RT.computeWinFactors(reversedAir).rows.find((r) => r.key === 'air').recentBadShare, 0);
const strictMedian = Array.from({ length: 40 }, (_, i) => ({
  result: i < 20 ? 'win' : 'loss', duration_s: 300, movement: { air_pct: i }
}));
const strictAir = RT.computeWinFactors(strictMedian).rows.find((r) => r.key === 'air');
assert.deepStrictEqual([strictAir.inclusive, strictAir.hi.n, strictAir.recentBadShare], [false, 19, 19 / 20]);
// M02: air time remains descriptive, with no universal good/bad direction.
const airMetric = RT.computeMechanics(medianGames).metrics.find((m) => m.key === 'air_pct');
assert.strictEqual(airMetric.trend, 60);
assert.strictEqual(airMetric.higherBetter, null);
assert.strictEqual(RT.computeMechanics(medianGames).metrics.find((m) => m.key === 'zero_boost_pct').higherBetter, false);
// M05: uncertain timelines cannot describe a historical live score, but results remain usable.
const timeline = {
  result: 'win', mode: '2v2', online: true, duration_s: 300, team_score: 1, opp_score: 0,
  goals: [{ t: 100, team: 'us' }]
};
const unknownGoal = { ...timeline, goals: [{ t: 100, team: '' }] };
assert.strictEqual(RT.liveOdds([unknownGoal], '2v2', 120, 0, false).n, 0);
const invalidTimelines = [
  unknownGoal,
  ...[undefined, null, '100', NaN, Infinity, -1, 301].map((t) => ({ ...timeline, goals: [{ t, team: 'us' }] })),
  { ...timeline, goals: [null] },
  { ...timeline, goals: [] },
  { ...timeline, goals: [{ t: 100, team: 'them' }] },
  { ...timeline, goals: [{ t: 100, team: 'us' }, { t: 110, team: 'us' }] },
  { ...timeline, partial: true },
  { ...timeline, duration_s: undefined },
  { ...timeline, team_score: -1 },
  { ...timeline, team_score: 0.5 },
  { ...timeline, opp_score: undefined }
];
for (const m of invalidTimelines) {
  assert.strictEqual(RT.liveOdds([m], '2v2', 60, 0, false).n, 0);
  assert.deepStrictEqual([RT.computeKpis([m]).n, RT.computeKpis([m]).wins], [1, 1]);
}
assert.strictEqual(RT.liveOdds([timeline], '2v2', 60, 0, false).n, 1);
assert.strictEqual(RT.liveOdds([timeline], '2v2', 120, 1, false).n, 1);
assert.strictEqual(RT.liveOdds([timeline], '2v2', 120, 0, false).n, 0);
const scoreless = { ...timeline, result: 'loss', team_score: 0, goals: [] };
assert.strictEqual(RT.liveOdds([scoreless], '2v2', 120, 0, false).n, 1);
assert.strictEqual(RT.liveOdds([{ ...timeline, goals: [{ t: 0, team: 'us' }] }], '2v2', 0, 1, false).n, 1);
const qualifiedOt = { ...koOt, mode: '2v2', online: true };
assert.strictEqual(RT.liveOdds([qualifiedOt], '2v2', 310, 0, true).n, 1);
assert.strictEqual(RT.liveOdds([{ ...qualifiedOt, goals: [{ t: 100, team: '' }] }], '2v2', 310, 0, true).n, 0);
// M07: no estimated restart after a terminal regulation goal; OT still starts once.
const terminalGoal = { ...timeline, goals: [{ t: 300, team: 'us' }] };
assert.strictEqual(RT.computeSituations([terminalGoal]).kickoff.kickoffs, 1);
assert.strictEqual(RT.computeSituations([timeline]).kickoff.kickoffs, 2);
assert.strictEqual(RT.computeSituations([{ ...terminalGoal, duration_s: 200, goals: [{ t: 200, team: 'us' }] }]).kickoff.kickoffs, 1);
assert.strictEqual(RT.computeSituations([qualifiedOt]).kickoff.kickoffs, 4);
const tiedAtEnd = { ...qualifiedOt, goals: [{ t: 100, team: 'them' }, { t: 300, team: 'us' }, { t: 320, team: 'us', overtime: true }] };
assert.strictEqual(RT.computeSituations([tiedAtEnd]).kickoff.kickoffs, 3);
// M10: enough sessions does not imply enough eligible first-three matches.
const sparseGames = wm.filter((m) => m.id % 10 === 0).slice(0, 10);
const sparseEffect = RT.computeWarmupEffect(RT.annotate(sparseGames), trainings);
assert.deepStrictEqual([
  sparseEffect.warm.sessions, sparseEffect.cold.sessions, sparseEffect.warm.first.n, sparseEffect.cold.first.n,
  sparseEffect.enough, sparseEffect.delta
], [5, 5, 5, 5, false, null]);
I.setLang('fr');
assert.strictEqual(RT.warmupEffectMessage(sparseEffect), 'Pour comparer, chaque groupe doit atteindre 5 sessions et 10 matchs exploitables parmi les 3 premiers : avec échauffement 5/5 sessions, 5/10 matchs ; sans échauffement 5/5 sessions, 5/10 matchs.');
I.setLang('en');
assert.strictEqual(RT.warmupEffectMessage(sparseEffect), 'To compare, each group needs 5 sessions and 10 eligible matches among the first 3: with a warm-up 5/5 sessions, 5/10 matches; without a warm-up 5/5 sessions, 5/10 matches.');
assert.strictEqual(RT.warmupEffectMessage(eff), I.t('trn.effectGood', { v: '100' }));
assert.strictEqual(RT.warmupEffectMessage({ ...eff, delta: -0.1 }), I.t('trn.effectBad', { v: '10' }));
assert.strictEqual(RT.warmupEffectMessage({ ...eff, delta: 0 }), I.t('trn.effectFlat'));
const noWarmup = RT.computeWarmupEffect(RT.annotate(sparseGames), []);
assert.ok(RT.warmupEffectMessage(noWarmup).startsWith(I.t('trn.effectNone')));
assert.ok(RT.warmupEffectMessage(noWarmup).includes('with a warm-up 0/5 sessions, 0/10 matches'));
// Ten first-three matches per side are necessary, and five distinct sessions remain necessary too.
const tenEach = wm.filter((m) => m.id % 10 < 2).slice(0, 20);
const atThreshold = RT.computeWarmupEffect(RT.annotate(tenEach), trainings);
assert.deepStrictEqual([atThreshold.warm.sessions, atThreshold.cold.sessions, atThreshold.warm.first.n, atThreshold.cold.first.n, atThreshold.enough], [5, 5, 10, 10, true]);
const nineWarm = RT.computeWarmupEffect(RT.annotate(tenEach.filter((m) => m.id !== 1)), trainings);
assert.deepStrictEqual([nineWarm.warm.sessions, nineWarm.warm.first.n, nineWarm.enough], [5, 9, false]);
assert.ok(RT.warmupEffectMessage(nineWarm).includes('with a warm-up 5/5 sessions, 9/10 matches'));
const fourSessions = RT.computeWarmupEffect(RT.annotate(wm.filter((m) => m.id < 80)), trainings);
assert.deepStrictEqual([fourSessions.warm.sessions, fourSessions.cold.sessions, fourSessions.warm.first.n, fourSessions.cold.first.n, fourSessions.enough], [4, 4, 12, 12, false]);
I.setLang('fr');
assert.ok(RT.warmupEffectMessage(fourSessions).includes('avec échauffement 4/5 sessions, 12/10 matchs'));
assert.ok(RT.warmupEffectMessage(noWarmup).startsWith(I.t('trn.effectNone')));
I.setLang('en');
// M06: averages give each observed match one vote, not each second of telemetry.
const unequalCoverage = [
  { movement: { sample_s: 300, air_pct: 10 } },
  { movement: { sample_s: 1, air_pct: 90 } }
];
assert.strictEqual(RT.computeMechanics(unequalCoverage).metrics.find((m) => m.key === 'air_pct').avg, 50);
I.setLang('fr');
assert.ok(I.t('mech.sub', { v: '2 matchs' }).includes('Moyennes par match'));
assert.ok(I.t('mech.sub', { v: '2 matchs' }).includes('non pondérées'));
assert.strictEqual(I.t('mp.average'), 'Moyenne par match');
I.setLang('en');
assert.ok(I.t('mech.sub', { v: '2 matches' }).includes('Per-match averages'));
assert.ok(I.t('mech.sub', { v: '2 matches' }).includes('not weighted'));
assert.strictEqual(I.t('mp.average'), 'Per-match average');
// M04: no magnitude-based unit guess, including either side of the old 300 boundary.
const rawSpeeds = RT.computeMechanics([{ movement: { avg_speed: 1450 }, hits: { avg_speed: 3000, max_speed: 4300 } }]);
assert.strictEqual(rawSpeeds.metrics.find((m) => m.key === 'avg_speed').avg, 1450);
assert.strictEqual(rawSpeeds.metrics.find((m) => m.key === 'hits_avg').avg, 3000);
assert.strictEqual(rawSpeeds.maxHitRaw, 4300);
for (const defs of [RT.MECH_METRICS, RT.MOVE_STATS, RT.HIT_STATS, RT.FACTORS, RT.FATIGUE_STATS]) {
  assert.ok(defs.every((d) => d.unit !== 'km/h'), 'unknown telemetry carries no physical unit');
}
assert.strictEqual(RT.statValue({ movement: { avg_speed: 95 } }, 'movement', RT.MOVE_STATS[0]), 95);
assert.strictEqual(RT.FACTORS.find((f) => f.key === 'speed').value({ movement: { avg_speed: 95 } }), 95);
assert.strictEqual(RT.FATIGUE_STATS.find((f) => f.key === 'hit_power').value({ hits: { avg_speed: 95 } }), 95);
for (const lang of ['fr', 'en']) {
  I.setLang(lang);
  for (const value of [0, 95, 299, 300, 3120.4]) {
    assert.strictEqual(RT.formatRawSpeed(value), RT.fmtNum(value, 1) + ' ' + I.t('unit.rawSpeed'));
  }
  for (const missing of [null, undefined, NaN, Infinity, '95']) assert.strictEqual(RT.formatRawSpeed(missing), '—');
}
I.setLang('en');
// Declared source units are labels, never guessed or converted; incompatible units do not aggregate.
assert.strictEqual(RT.formatRawSpeed(95, 'km/h'), RT.fmtNum(95, 1) + ' km/h');
assert.strictEqual(RT.formatRawSpeed(1450, 'uu/s'), RT.fmtNum(1450, 1) + ' uu/s');
assert.strictEqual(RT.formatRawSpeed(95, 'unknown'), RT.formatRawSpeed(95));
const typed = (speed_unit) => ({ result: 'win', speed_unit, movement: { avg_speed: 95, air_pct: 20 }, hits: { avg_speed: 100, max_speed: 110 } });
const typedMech = RT.computeMechanics([typed('uu/s')]);
assert.strictEqual(typedMech.metrics[0].avg, 95);
assert.strictEqual(typedMech.metrics[0].unit, 'uu/s');
const mixedUnits = [typed('km/h'), typed('uu/s'), typed('unknown')];
const mixedMech = RT.computeMechanics(mixedUnits);
assert.strictEqual(mixedMech.metrics[0].avg, null);
assert.strictEqual(mixedMech.metrics.find((m) => m.key === 'air_pct').avg, 20);
assert.strictEqual(mixedMech.maxHitRaw, null);
assert.strictEqual(RT.computeWinFactors(mixedUnits).rows.find((r) => r.key === 'speed').enough, false);
assert.ok(RT.computeSessionFatigue(mixedUnits).rows.find((r) => r.key === 'speed').cells.every((c) => c.n === 0));
assert.strictEqual(RT.liveAsMatch({ speed_unit: 'uu/s', players: [] }).speed_unit, 'uu/s');
const mixedHistory = RT.annotate(mixedUnits.concat([typed('uu/s')]).map((m, i) => Object.assign({}, m, {
  id: i + 1, mode: '2v2', started_at: new Date(Date.UTC(2026, 9, 18, i)).toISOString(), duration_s: 300
})));
const mixedBase = RT.matchBaseline(mixedHistory, 4);
assert.strictEqual(mixedBase.movement.avg_speed.n, 0);
assert.strictEqual(mixedBase.movement.avg_speed.unit, null);
assert.strictEqual(mixedBase.movement.air_pct.avg, 20);
console.log('analytics ok');
