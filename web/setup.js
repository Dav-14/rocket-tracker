/* Rocket Tracker — installation wizard (setup.html): Stats API, server, autostart.
 * Served by the local tracker only; the steps call /api/setup/*.
 */
(function () {
  'use strict';

  var I = window.RT_I18N;
  var tr = I.t;
  var $ = function (sel) { return document.querySelector(sel); };
  var state = { setup: null, busy: false };

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || r.statusText);
        return data;
      });
    });
  }

  function showError(id, err) {
    var el = $(id);
    el.textContent = err ? String(err.message || err) : '';
    el.hidden = !err;
  }

  function busy(btn, on, labelKey) {
    state.busy = on;
    btn.disabled = on;
    btn.textContent = tr(on ? 'wiz.working' : labelKey);
  }

  function where() {
    var r = document.querySelector('input[name="where"]:checked');
    return r ? r.value : '';
  }

  /* ---------- step 1: Stats API ---------- */
  function renderApi() {
    var s = state.setup, st = $('#api-status'), step = $('#step-api');
    var ok = s.ini && s.ini.ok;
    step.classList.toggle('done', !!ok);
    $('#api-dir-field').hidden = !!s.install_dir;
    if (ok) {
      st.className = 'wiz-status ok';
      st.textContent = tr('wiz.apiOk', { path: s.ini.path, rate: s.ini.packet_send_rate });
    } else if (s.install_dir) {
      st.className = 'wiz-status';
      st.textContent = tr('wiz.apiFound', { dir: s.install_dir });
    } else {
      st.className = 'wiz-status warn';
      st.textContent = tr('wiz.apiMissing');
    }
    $('#api-enable').textContent = tr(ok ? 'wiz.apiAgain' : 'wiz.apiEnable');
    $('#api-enable').classList.toggle('btn-primary', !ok);
  }

  function enableApi() {
    var btn = $('#api-enable');
    showError('#api-error', null);
    busy(btn, true);
    api('POST', '/api/setup/statsapi', { rl_dir: $('#api-dir').value.trim() })
      .then(function () { return load(); })
      .catch(function (e) { showError('#api-error', e); })
      .then(function () { busy(btn, false, 'wiz.apiEnable'); renderApi(); });
  }

  /* ---------- step 2: server ---------- */
  function renderServer() {
    var s = state.setup, srv = s.server, st = $('#server-status'), w = where();
    $('#server-form').hidden = w !== 'server';
    $('#step-server').classList.toggle('done', w === 'local' || (w === 'server' && !!srv));
    if (w === 'server' && srv) {
      st.className = 'wiz-status ' + (srv.reachable ? 'ok' : 'warn');
      st.textContent = srv.user
        ? tr('wiz.serverOk', { url: srv.url, user: srv.user, device: srv.device || '—' })
        : tr(srv.reachable ? 'wiz.serverSaved' : 'wiz.serverDown', { url: srv.url });
    } else {
      st.className = 'wiz-status';
      st.textContent = '';
    }
    renderFinish();
  }

  function connect() {
    var btn = $('#server-connect');
    showError('#server-error', null);
    busy(btn, true);
    api('POST', '/api/setup/server', { server: $('#server-url').value.trim(), token: $('#server-token').value.trim() })
      .then(function (r) { state.setup.server = r.server; $('#server-token').value = ''; })
      .catch(function (e) { showError('#server-error', e); })
      .then(function () { busy(btn, false, 'wiz.serverConnect'); renderServer(); });
  }

  /* ---------- step 3: finish ---------- */
  function canFinish() {
    var w = where();
    return w === 'local' || (w === 'server' && !!state.setup.server);
  }

  function renderFinish() {
    $('#finish').disabled = state.busy || !canFinish();
    $('#finish-hint').hidden = canFinish();
  }

  function finish() {
    var btn = $('#finish');
    showError('#finish-error', null);
    busy(btn, true);
    // "Local only" forgets a server set before.
    var first = where() === 'local' && state.setup.server ? api('POST', '/api/setup/server', { server: '' }) : Promise.resolve();
    first
      .then(function () { return api('POST', '/api/setup/finish', { autostart: $('#autostart').checked }); })
      .then(function (r) { window.location.href = r.url || '/'; })
      .catch(function (e) {
        showError('#finish-error', e);
        busy(btn, false, 'wiz.finish');
        renderFinish();
      });
  }

  /* ---------- page ---------- */
  function load() {
    return api('GET', '/api/setup').then(function (s) { state.setup = s; });
  }

  function render() {
    renderApi();
    renderServer();
  }

  function setupLang() {
    var sel = $('#wiz-lang');
    sel.innerHTML = I.LANGS.map(function (l) {
      return '<option value="' + l + '">' + I.messages['lang.name'][I.LANGS.indexOf(l)] + '</option>';
    }).join('');
    sel.value = I.getLang();
    sel.addEventListener('change', function () {
      I.setLang(sel.value);
      I.save(sel.value);
      I.apply();
      document.title = tr('wiz.pageTitle');
      if (state.setup) render();
    });
  }

  I.setLang(I.detect());
  I.apply();
  document.title = tr('wiz.pageTitle');
  setupLang();
  $('#api-enable').addEventListener('click', enableApi);
  $('#server-connect').addEventListener('click', connect);
  $('#finish').addEventListener('click', finish);
  Array.prototype.forEach.call(document.querySelectorAll('input[name="where"]'), function (r) {
    r.addEventListener('change', renderServer);
  });

  load().then(function () {
    var s = state.setup;
    var radio = document.querySelector('input[name="where"][value="' + (s.server ? 'server' : 'local') + '"]');
    radio.checked = true;
    if (s.server) $('#server-url').value = s.server.url;
    $('#autostart').checked = s.autostart || !s.done;
    render();
  }).catch(function (e) {
    showError('#api-error', e);
  });
})();
