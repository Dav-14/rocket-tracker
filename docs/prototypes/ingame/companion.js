'use strict';

// Isolated design fixtures: this prototype never reads or writes player data.
const copy = {
  loading: ['Chargement du statut', 'Loading status'],
  pending: ['Résultat en attente', 'Result pending'],
  offline: ['Agent hors ligne', 'Agent offline'],
  'scenario-loading': ['Chargement du statut', 'Loading status'],
  'scenario-pending': ['Résultat en attente', 'Result pending'],
  'scenario-offline': ['Agent hors ligne', 'Agent offline'],
  loadingHeading: ['Le compagnon se prépare', 'Getting the companion ready'],
  loadingCopy: ['Le statut du jeu n’a pas encore été reçu. Le contexte de session fictif reste affiché séparément.', 'Game status has not arrived yet. The fictional session context remains visible separately.'],
  pendingNotice: ['Partie quittée, résultat pas encore reçu. Le bilan reste inchangé ; le dernier score observé n’est pas un résultat final.', 'Match left, result not received yet. The record is unchanged; the last observed score is not a final result.'],
  offlineNotice: ['L’agent ne répond plus. Le dernier instantané reste affiché, horloge figée. Vérifiez Rocket Tracker sur le PC de jeu ; la coupure ne prouve pas la fin du match.', 'The agent is not responding. The last snapshot remains visible with a frozen clock. Check Rocket Tracker on the gaming PC; this does not prove the match ended.'],
  lastClock: ['Temps au dernier état', 'Time at last snapshot'],
  observedPersonal: ['Vos derniers compteurs reçus', 'Your last received totals'],
  prototype: ['Maquette interactive', 'Interactive mock-up'],
  fiction: ['Données fictives · aucune connexion au jeu', 'Fictional data · no game connection'],
  language: ['Langue', 'Language'], companion: ['Compagnon de match', 'Match companion'],
  focus: ['Vue concentrée', 'Focus view'], fullscreen: ['Plein écran', 'Full screen'],
  exitFullscreen: ['Quitter le plein écran', 'Exit full screen'],
  fullscreenError: ['Le navigateur ne permet pas le plein écran ici. La maquette reste utilisable.', 'Full screen is unavailable here. You can still use the mock-up.'],
  device: ['PC de jeu', 'Gaming PC'],
  snapshot: ['Instantané de démonstration', 'Demo snapshot'],
  delayed: ['Dernier instantané · il y a 18 s (simulé)', 'Last snapshot · 18 s ago (simulated)'],
  match: ['Match en cours', 'Match in progress'], overtime: ['Prolongation', 'Overtime'],
  finished: ['Victoire · match terminé', 'Victory · match finished'],
  waiting: ['Entre deux matchs', 'Between matches'], training: ['Entraînement en cours', 'Training in progress'],
  unidentified: ['Profil à identifier', 'Identify your profile'],
  stale: ['Dernier état reçu', 'Last received state'],
  our: ['Votre équipe', 'Your team'], their: ['Adversaires', 'Opponents'],
  remaining: ['Temps restant', 'Time remaining'], extra: ['Temps additionnel', 'Extra time'],
  final: ['Score final', 'Final score'], last: ['Dernier match terminé', 'Last finished match'],
  matchNumber: ['Match 6 de la session', 'Match 6 this session'],
  personal: ['Vous, dans ce match', 'You, this match'],
  lastPersonal: ['Vous, au dernier match', 'You, last match'],
  goals: ['Buts', 'Goals'], assists: ['Passes', 'Assists'], shots: ['Tirs', 'Shots'], saves: ['Arrêts', 'Saves'],
  timeline: ['Les buts du match', 'Match goals'], elapsed: ['Temps écoulé', 'Elapsed time'],
  scoreboard: ['Tableau des joueurs', 'Player scoreboard'], player: ['Joueur', 'Player'], score: ['Score', 'Score'],
  you: ['vous', 'you'], session: ['Votre session', 'Your session'], 'session-time': ['Depuis 20:10', 'Since 20:10'],
  wins: ['Victoires', 'Wins'], losses: ['Défaites', 'Losses'],
  sessionFive: ['5 matchs terminés · 2v2', '5 finished matches · 2v2'],
  sessionSix: ['6 matchs terminés · 2v2', '6 finished matches · 2v2'],
  sessionStrip: ['Résultats de la session, du plus ancien au plus récent', 'Session results, oldest to newest'],
  winLetter: ['V', 'W'], lossLetter: ['D', 'L'], currentLetter: ['…', '…'],
  currentMatch: ['Match en cours', 'Match in progress'],
  uncertainMatch: ['État du match inconnu', 'Match state unknown'],
  matchScore: ['Score du match', 'Match score'], win: ['Victoire', 'Win'], loss: ['Défaite', 'Loss'],
  next: ['Un match à la fois', 'One match at a time'],
  tip: ['Le bilan se met à jour à la fin du match. Rien à faire pendant que vous jouez.', 'The record updates after the match. Nothing to do while you play.'],
  doneTip: ['Le dernier match reste visible jusqu’au suivant. Prenez le temps de souffler.', 'The last match stays visible until the next one. Take a moment to reset.'],
  daily: ['Objectif du jour', 'Daily goal'], 'daily-detail': ['Tous modes · objectif personnel', 'All modes · personal goal'],
  scope: ['Ce compagnon suit le profil Équinoxe sur le PC de jeu.', 'This companion follows profile Équinoxe on the gaming PC.'],
  unverifiedScope: ['L’identité du joueur de cette partie n’est pas confirmée. Le contexte de session précédent reste affiché.', 'The player in this match is not confirmed. The previous session context is still shown.'],
  quiet: ['Second écran. Le jeu garde toute votre attention.', 'Second screen. Keep your attention on the game.'],
  fixed: ['Instantané fixe · horloge non animée', 'Fixed snapshot · clock is not animated'],
  explore: ['Explorer la proposition', 'Explore the proposal'],
  'explore-copy': ['Changez de scénario pour voir les états du compagnon.', 'Switch scenarios to explore the companion states.'],
  scenario: ['Scénario', 'Scenario'],
  'scenario-match': ['Match en cours', 'Match in progress'],
  'scenario-overtime': ['Prolongation', 'Overtime'],
  'scenario-finished': ['Fin de match', 'Match finished'],
  'scenario-waiting': ['Entre deux matchs', 'Between matches'],
  'scenario-training': ['Entraînement', 'Training'],
  'scenario-partial': ['Match rejoint en cours', 'Joined mid-match'],
  'scenario-unidentified': ['Profil non identifié', 'Unidentified profile'],
  'scenario-stale': ['Données interrompues', 'Interrupted data'],
  partialNotice: ['Capture commencée en cours de match. Les cumuls individuels et la chronologie sont masqués : leur couverture est incomplète.', 'Capture started mid-match. Individual totals and the timeline are hidden because coverage is incomplete.'],
  staleNotice: ['Données interrompues. Le score et l’horloge sont figés au dernier état reçu ; le match n’est pas déclaré terminé. La reprise serait automatique avec un nouvel état valide.', 'Data interrupted. Score and clock are frozen at the last received state; this does not mark the match finished. A new valid state would resume the display automatically.'],
  waitingHeading: ['Prêt pour le prochain match', 'Ready for the next match'],
  trainingHeading: ['Place à l’entraînement', 'Time to train'],
  trainingCopy: ['Aucun match compétitif en cours. Votre session reste à portée de regard.', 'No competitive match in progress. Your session stays within a glance.'],
  unidentifiedHeading: ['Qui joue cette partie ?', 'Who is playing this match?'],
  unidentifiedCopy: ['L’équipe et les statistiques personnelles restent masquées tant que le profil n’est pas identifié. Vérifiez le profil dans le tableau de bord.', 'Team perspective and personal stats stay hidden until the profile is identified. Check the profile in the dashboard.'],
};

let language = 'fr';
const byID = id => document.getElementById(id);
const t = key => {
  if (!copy[key]) throw new Error(`Unknown design translation: ${key}`);
  return copy[key][language === 'fr' ? 0 : 1];
};
const set = (id, text) => { byID(id).textContent = text; };
const show = (id, visible) => { byID(id).hidden = !visible; };
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

const goals = [
  { time: '0:44', name: 'Équinoxe', score: '1–0', team: 'blue' },
  { time: '2:21', name: 'Cobalt', score: '1–1', team: 'orange' },
  { time: '3:02', name: 'Nova', score: '2–1', team: 'blue' },
];
const players = [
  { name: 'Équinoxe', team: 'blue', me: true, score: 460, goals: 1, assists: 1, shots: 3, saves: 2 },
  { name: 'Nova', team: 'blue', score: 320, goals: 1, assists: 1, shots: 2, saves: 0 },
  { name: 'Cobalt', team: 'orange', score: 380, goals: 1, assists: 0, shots: 4, saves: 1 },
  { name: 'Silex', team: 'orange', score: 250, goals: 0, assists: 1, shots: 1, saves: 2 },
];

function render() {
  const scenario = byID('scenario').value;
  const completed = scenario === 'finished' || scenario === 'waiting';
  const overtime = scenario === 'overtime';
  const unavailable = ['unidentified', 'training', 'loading'].includes(scenario);
  const pending = scenario === 'pending';
  const offline = scenario === 'offline';
  const partial = scenario === 'partial';
  const stale = scenario === 'stale' || offline;
  document.documentElement.lang = language;
  document.title = `Rocket Tracker — ${t('companion')}`;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  const stateTitle = completed ? (scenario === 'waiting' ? 'waiting' : 'finished')
    : ['training', 'unidentified', 'stale', 'overtime', 'pending', 'offline', 'loading'].includes(scenario) ? scenario : 'match';
  const ownGoals = completed ? 3 : 2;
  const opponentGoals = overtime ? 2 : 1;
  byID('companion').dataset.state = scenario;
  byID('companion').classList.toggle('is-stale', stale);
  document.body.classList.toggle('is-focus', byID('focus').checked);
  set('match-heading', t(stateTitle));
  set('arena', unavailable ? '—' : 'Mannfield');
  set('context-mode', scenario === 'training' ? t('training') : '2v2 · Standard');
  set('freshness', t(stale ? 'delayed' : pending ? 'pending' : 'snapshot'));
  byID('score-panel').setAttribute('aria-label', t('matchScore'));
  set('our-label', t('our')); set('their-label', t('their'));
  set('our-score', ownGoals); set('their-score', opponentGoals);
  set('clock-label', t(completed ? 'final' : pending || stale ? 'lastClock' : overtime ? 'extra' : 'remaining'));
  set('clock', completed ? '0:00' : overtime ? '+0:24' : '1:42');
  set('match-badge', t(scenario === 'waiting' ? 'last' : pending ? 'pending' : 'matchNumber'));
  set('personal-heading', t(scenario === 'waiting' ? 'lastPersonal' : pending || stale ? 'observedPersonal' : 'personal'));
  set('timeline-heading', t('timeline')); set('scoreboard-heading', t('scoreboard'));
  set('session-heading', t('session')); set('session-caption', t(completed ? 'sessionSix' : 'sessionFive'));
  set('wins', completed ? '4' : '3');
  set('session-tip', t(completed ? 'doneTip' : 'tip'));
  set('daily-value', completed ? '6 / 10' : '5 / 10');
  byID('daily-progress').value = completed ? 6 : 5;
  byID('daily-progress').setAttribute('aria-label', t('daily'));
  set('view-hint', t('fixed'));
  const privacy = document.querySelector('.privacy-note');
  privacy.textContent = t(scenario === 'unidentified' ? 'unverifiedScope' : 'scope');
  show('score-panel', !unavailable);
  show('empty-state', unavailable);
  show('personal', !unavailable && !partial);
  show('timeline-section', !unavailable && !partial);
  show('scoreboard-section', !unavailable && !partial);
  show('notice', partial || stale || pending);
  set('notice', partial ? t('partialNotice') : offline ? t('offlineNotice') : stale ? t('staleNotice') : pending ? t('pendingNotice') : '');
  set('empty-heading', t(scenario === 'training' ? 'trainingHeading' : scenario === 'loading' ? 'loadingHeading' : 'unidentifiedHeading'));
  set('empty-copy', t(scenario === 'training' ? 'trainingCopy' : scenario === 'loading' ? 'loadingCopy' : 'unidentifiedCopy'));

  const rows = players.map(player => ({ ...player }));
  if (completed) Object.assign(rows[0], { score: 650, goals: 2, shots: 4 });
  if (overtime) Object.assign(rows[2], { score: 480, goals: 2, shots: 5 });
  byID('personal-stats').replaceChildren(...['goals', 'assists', 'shots', 'saves'].map(key => {
    const group = el('div');
    group.append(el('dt', t(key)), el('dd', rows[0][key]));
    return group;
  }));
  byID('scoreboard').replaceChildren(...rows.map(player => {
    const row = el('tr', null, `${player.team}${player.me ? ' me' : ''}`);
    const name = el('td', player.name);
    if (player.me) name.append(el('small', t('you')));
    row.append(name, ...['score', 'goals', 'assists', 'shots', 'saves'].map(key => el('td', player[key])));
    return row;
  }));
  const timeline = [...goals];
  if (completed) timeline.push({ time: '4:56', name: 'Équinoxe', score: '3–1', team: 'blue' });
  if (overtime) timeline.push({ time: '4:49', name: 'Cobalt', score: '2–2', team: 'orange' });
  byID('timeline').replaceChildren(...timeline.map(goal => {
    const item = el('li', null, goal.team);
    const name = el('strong', goal.name);
    name.append(el('span', goal.score, 'goal-score'));
    item.append(el('time', goal.time), name);
    return item;
  }));
  const record = ['win', 'loss', 'win', 'loss', 'win'];
  if (completed) record.push('win');
  else if (!unavailable && !pending) record.push(stale ? 'uncertainMatch' : 'currentMatch');
  byID('session-strip').setAttribute('aria-label', t('sessionStrip'));
  byID('session-strip').replaceChildren(...record.map(result => {
    const node = el('span', t(result === 'win' ? 'winLetter' : result === 'loss' ? 'lossLetter' : 'currentLetter'),
      result === 'loss' ? 'lost' : ['currentMatch', 'uncertainMatch'].includes(result) ? 'ongoing' : 'won');
    node.setAttribute('aria-label', t(result));
    return node;
  }));
  updateFullscreenLabel();
}

function updateFullscreenLabel() {
  set('fullscreen', t(document.fullscreenElement ? 'exitFullscreen' : 'fullscreen'));
  byID('fullscreen').setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
}
byID('language').addEventListener('change', event => { language = event.target.value; render(); });
byID('scenario').addEventListener('change', render);
byID('focus').addEventListener('change', render);
byID('fullscreen').addEventListener('click', async () => {
  try {
    if (!document.fullscreenEnabled || typeof document.documentElement.requestFullscreen !== 'function') {
      throw new Error('Full screen is not available');
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    show('notice', true); set('notice', t('fullscreenError'));
  }
});
document.addEventListener('fullscreenchange', updateFullscreenLabel);
render();
