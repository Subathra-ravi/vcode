
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
};

let mocks = store.get('probe.mocks', [
  {
    id: 1,
    method: 'GET',
    path: '/api/users',
    status: 200,
    delay: 120,
    on: true,
    body: '{"data":[{"id":1,"name":"Asha"},{"id":2,"name":"Ravi"}]}'
  },
  {
    id: 2,
    method: 'POST',
    path: '/api/login',
    status: 401,
    delay: 60,
    on: true,
    body: '{"error":"Invalid credentials"}'
  }
]);

let hist = store.get('probe.hist', []);
let stats = store.get('probe.stats', {
  req: 0,
  pass: 0,
  total: 0,
  ms: 0
});

let editing = null;
let params = [{ k: '', v: '' }];
let headers = [{ k: 'Content-Type', v: 'application/json' }];
let tests = [{ type: 'status', path: '', val: '200' }];

/* Navigation */

$$('.nav').forEach(b => {
  b.onclick = () => {
    $$('.nav').forEach(x =>
      x.classList.toggle('on', x === b)
    );

    ['tester', 'mocks', 'history'].forEach(v => {
      $('#v-' + v).classList.toggle(
        'hidden',
        v !== b.dataset.v
      );
    });

    render();
  };
});

$$('#rtabs button').forEach(b => {
  b.onclick = () => {
    $$('#rtabs button').forEach(x =>
      x.classList.toggle('on', x === b)
    );

    ['params', 'headers', 'body', 'tests'].forEach(t => {
      $('#t-' + t).classList.toggle(
        'hidden',
        t !== b.dataset.t
      );
    });
  };
});

/* Parameters and headers editor */

function kvEditor(el, arr) {
  el.innerHTML = '';

  arr.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'kv';

    d.innerHTML =
      '<input placeholder="key" class="mono">' +
      '<input placeholder="value" class="mono">' +
      '<button class="ghost" aria-label="Remove row">✕</button>';

    const [a, b, x] = d.children;

    a.value = r.k;
    b.value = r.v;

    a.oninput = () => r.k = a.value;
    b.oninput = () => r.v = b.value;

    x.onclick = () => {
      arr.splice(i, 1);

      if (!arr.length) {
        arr.push({ k: '', v: '' });
      }

      kvEditor(el, arr);
    };

    el.appendChild(d);
  });

  const add = document.createElement('button');
  add.textContent = 'Add row';

  add.onclick = () => {
    arr.push({ k: '', v: '' });
    kvEditor(el, arr);
  };

  el.appendChild(add);
}

/* Test checks editor */

function testEditor() {
  const el = $('#t-tests');

  el.innerHTML =
    '<div class="muted" style="margin-bottom:8px">' +
    'Pick a check. No scripting needed.</div>';

  tests.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'kv t';

    d.innerHTML =
      '<select>' +
      '<option value="status">Status equals</option>' +
      '<option value="time">Time under (ms)</option>' +
      '<option value="contains">Body contains</option>' +
      '<option value="json">JSON path equals</option>' +
      '</select>' +
      '<input class="mono" placeholder="path e.g. data.0.name">' +
      '<input class="mono" placeholder="value">' +
      '<button class="ghost" aria-label="Remove check">✕</button>';

    const [s, p, v, x] = d.children;

    s.value = t.type;
    p.value = t.path;
    v.value = t.val;

    const vis = () => {
      p.style.visibility =
        s.value === 'json' ? 'visible' : 'hidden';
    };

    vis();

    s.onchange = () => {
      t.type = s.value;
      vis();
    };

    p.oninput = () => t.path = p.value;
    v.oninput = () => t.val = v.value;

    x.onclick = () => {
      tests.splice(i, 1);
      testEditor();
    };

    el.appendChild(d);
  });

  const add = document.createElement('button');
  add.textContent = 'Add check';

  add.onclick = () => {
    tests.push({
      type: 'status',
      path: '',
      val: '200'
    });

    testEditor();
  };

  el.appendChild(add);
}

/* Find a matching mock response */

function findMock(method, url) {
  try {
    const u = new URL(url);

    return mocks.find(m =>
      m.on &&
      m.method === method &&
      m.path === u.pathname
    );
  } catch (e) {
    return null;
  }
}

/* Build request URL */

function buildUrl() {
  let u = $('#url').value.trim();

  const q = params
    .filter(p => p.k)
    .map(p =>
      encodeURIComponent(p.k) + '=' +
      encodeURIComponent(p.v)
    )
    .join('&');

  return q
    ? u + (u.includes('?') ? '&' : '?') + q
    : u;
}

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

/* Send API request */

$('#send').onclick = async () => {
  const method = $('#method').value;
  const url = buildUrl();
  const t0 = performance.now();

  let status = 0;
  let text = '';
  let note = '';

  $('#resMeta').innerHTML = '<span>Sending…</span>';

  const mk = findMock(method, url);

  if (mk) {
    await sleep(mk.delay || 0);
    status = mk.status;
    text = mk.body;
    note = 'Mocked response';
  } else {
    try {
      const h = {};

      headers
        .filter(x => x.k)
        .forEach(x => h[x.k] = x.v);

      const o = {
        method,
        headers: h
      };

      if (
        !['GET', 'DELETE'].includes(method) &&
        $('#body').value
      ) {
        o.body = $('#body').value;
      }

      const r = await fetch(url, o);

      status = r.status;
      text = await r.text();
    } catch (e) {
      text = JSON.stringify({
        error: 'Request failed',
        hint: 'The server blocked it (CORS) or this page cannot reach other sites. Add a mock for this path, or run this file locally.'
      }, null, 2);
    }
  }

  const ms = Math.round(performance.now() - t0);

  let pretty = text;
  let json = null;

  try {
    json = JSON.parse(text);
    pretty = JSON.stringify(json, null, 2);
  } catch (e) {}

  const cls =
    status >= 200 && status < 300
      ? 'ok'
      : status
        ? 'bad'
        : 'warn';

  $('#resMeta').innerHTML =
    `<span class="pill ${cls}">${status || 'No response'}</span>` +
    `<span>${ms} ms</span>` +
    `<span>${new Blob([text]).size} B</span>` +
    `${note ? '<span>' + note + '</span>' : ''}`;

  $('#resBody').textContent = pretty;

  /* Run configured checks */

  const results = tests.map(t => {
    let pass = false;
    let label = '';

    if (t.type === 'status') {
      pass = String(status) === t.val.trim();
      label = `Status equals ${t.val}`;
    } else if (t.type === 'time') {
      pass = ms < Number(t.val);
      label = `Time under ${t.val} ms`;
    } else if (t.type === 'contains') {
      pass = text.includes(t.val);
      label = `Body contains "${t.val}"`;
    } else {
      let cur = json;

      t.path
        .split('.')
        .filter(Boolean)
        .forEach(k => {
          cur = cur == null ? undefined : cur[k];
        });

      pass = String(cur) === t.val;
      label = `${t.path} equals ${t.val}`;
    }

    return { pass, label };
  });

  $('#resTests').innerHTML =
    results.length ? '<b>Checks</b>' : '';

  results.forEach(r => {
    const d = document.createElement('div');

    d.className = 'tr ' + (r.pass ? 'ok' : 'bad');
    d.textContent = (r.pass ? '✓ ' : '✕ ') + r.label;

    $('#resTests').appendChild(d);
  });

  /* Update statistics */

  stats.req++;
  stats.ms += ms;
  stats.total += results.length;
  stats.pass += results.filter(r => r.pass).length;

  store.set('probe.stats', stats);

  /* Save request history */

  hist.unshift({
    method,
    url: $('#url').value,
    body: $('#body').value,
    at: Date.now(),
    status
  });

  hist = hist.slice(0, 30);

  store.set('probe.hist', hist);
  renderStats();
};

/* Save request manually */

$('#saveReq').onclick = () => {
  hist.unshift({
    method: $('#method').value,
    url: $('#url').value,
    body: $('#body').value,
    at: Date.now(),
    status: 'saved'
  });

  store.set('probe.hist', hist);

  $('#saveReq').textContent = 'Saved';

  setTimeout(() => {
    $('#saveReq').textContent = 'Save to history';
  }, 1200);
};

/* Mock response management */

function renderMocks() {
  const l = $('#mockList');
  l.innerHTML = '';

  if (!mocks.length) {
    l.innerHTML =
      '<div class="muted">No mocks yet. Add one on the right.</div>';
  }

  mocks.forEach(m => {
    const d = document.createElement('div');
    d.className = 'item';

    d.innerHTML =
      `<span class="m ${m.method}">${m.method}</span>` +
      '<span class="mono" style="flex:1"></span>' +
      `<span class="muted">${m.status}</span>` +
      `<input type="checkbox" ${m.on ? 'checked' : ''} ` +
      'aria-label="Enable mock" style="width:auto">' +
      '<button class="ghost" aria-label="Delete mock">✕</button>';

    d.children[1].textContent = m.path;

    d.onclick = e => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON'
      ) return;

      editing = m.id;

      $('#mTitle').textContent = 'Edit mock';
      $('#mMethod').value = m.method;
      $('#mPath').value = m.path;
      $('#mStatus').value = m.status;
      $('#mDelay').value = m.delay;
      $('#mBody').value = m.body;
    };

    d.children[3].onchange = e => {
      m.on = e.target.checked;
      saveMocks();
    };

    d.children[4].onclick = () => {
      mocks = mocks.filter(x => x.id !== m.id);
      saveMocks();
      renderMocks();
    };

    l.appendChild(d);
  });
}

function saveMocks() {
  store.set('probe.mocks', mocks);
  renderStats();
}

$('#mSave').onclick = () => {
  const body = $('#mBody').value;

  try {
    JSON.parse(body);
  } catch (e) {
    $('#mErr').textContent =
      'Response body is not valid JSON.';
    return;
  }

  const p = $('#mPath').value.trim();

  if (!p.startsWith('/')) {
    $('#mErr').textContent = 'Path must start with /';
    return;
  }

  $('#mErr').textContent = '';

  const m = {
    id: editing || Date.now(),
    method: $('#mMethod').value,
    path: p,
    status: Number($('#mStatus').value) || 200,
    delay: Number($('#mDelay').value) || 0,
    on: true,
    body
  };

  const i = mocks.findIndex(x => x.id === m.id);

  if (i >= 0) {
    mocks[i] = m;
  } else {
    mocks.push(m);
  }

  saveMocks();
  $('#mReset').click();
  renderMocks();
};

$('#mReset').onclick = () => {
  editing = null;

  $('#mTitle').textContent = 'New mock';
  $('#mPath').value = '';
  $('#mStatus').value = 200;
  $('#mDelay').value = 0;
  $('#mBody').value = '{"ok":true}';
};

/* Request history */

function renderHist() {
  const l = $('#histList');
  l.innerHTML = '';

  if (!hist.length) {
    l.innerHTML =
      '<div class="muted">Nothing here yet. Send a request and it appears here.</div>';
  }

  hist.forEach(h => {
    const d = document.createElement('div');
    d.className = 'item';

    d.innerHTML =
      `<span class="m ${h.method}">${h.method}</span>` +
      '<span class="mono" style="flex:1;overflow:hidden;text-overflow:ellipsis"></span>' +
      `<span class="muted">${h.status}</span>`;

    d.children[1].textContent = h.url;

    d.onclick = () => {
      $('#method').value = h.method;
      $('#url').value = h.url;
      $('#body').value = h.body || '';

      document
        .querySelector('.nav[data-v="tester"]')
        .click();
    };

    l.appendChild(d);
  });
}

/* Dashboard statistics */

function renderStats() {
  $('#sReq').textContent = stats.req;

  $('#sPass').textContent = stats.total
    ? Math.round(stats.pass / stats.total * 100) + '%'
    : '–';

  $('#sAvg').textContent = stats.req
    ? Math.round(stats.ms / stats.req) + ' ms'
    : '–';

  $('#sMock').textContent =
    mocks.filter(m => m.on).length;
}

function render() {
  renderStats();
  renderMocks();
  renderHist();
}

/* Initialize editors */

kvEditor($('#t-params'), params);
kvEditor($('#t-headers'), headers);
testEditor();

/* Dashboard session and logout */

const currentUser = store.get('probe.user', null);

if (!currentUser) {
  window.location.replace('login.html');
} else {
  $('#uemail').textContent = currentUser;
}

$('#logout').onclick = () => {
  store.set('probe.user', null);
  window.location.replace('login.html');
};
