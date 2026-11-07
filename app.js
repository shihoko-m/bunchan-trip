(() => {
  'use strict';

  /* ========= 設定 ========= */
  // ID:PASS の SHA-256（平文はソースに置かない）
  const CRED_HASH = '80a3afdf6b32121ab4670672b3ef73cf156d4264486bf905fbee3c3433caed41';
  const STORE_KEY = 'bunchan-trip-auth';
  const DEPART = new Date('2026-11-28T06:25:00+09:00');

  const MEMBERS = [
    { name: 'オオニシタク', color: '#E63B2E' },
    { name: 'マリナ', color: '#FF8FB1' },
    { name: 'ハタイ', color: '#26357A' },
    { name: 'ユウコ', color: '#FFC93C' },
    { name: 'ノブ', color: '#1F5E4A' },
    { name: 'マユミ', color: '#9B6BFF' },
    { name: 'アツシ', color: '#2BB3A3' },
    { name: 'シホコ', color: '#FF7A3D' },
  ];

  const CHECKS = [
    '新幹線のきっぷ / スマホ', '財布・現金', '身分証', 'スマホ充電器・モバイルバッテリー',
    '着替え（1泊分）', 'タオル・温泉セット', '常備薬', '開店祝い🎁',
    'エコバッグ（お土産用）', '防寒着（11月の九州は朝晩冷えるで）', '胃袋の空き容量🍚',
  ];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  async function sha256(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return sha256Fallback(text);
  }

  /* ========= ローディング → ログイン ========= */
  window.addEventListener('load', async () => {
    const saved = store.get(STORE_KEY);
    let auto = false;
    if (saved) {
      try {
        const { id, pw } = JSON.parse(saved);
        $('#uid').value = id; $('#pw').value = pw;
        auto = (await sha256(`${id}:${pw}`)) === CRED_HASH;
      } catch {}
    }
    setTimeout(() => {
      $('#loader').classList.add('done');
      setTimeout(() => $('#loader').remove(), 800);
      if (auto) enter(true);
    }, 1100);
  });

  $('#login').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#uid').value.trim();
    const pw = $('#pw').value;
    if ((await sha256(`${id}:${pw}`)) === CRED_HASH) {
      if ($('#remember').checked) store.set(STORE_KEY, JSON.stringify({ id, pw }));
      else store.del(STORE_KEY);
      enter(false);
    } else {
      const card = $('#login');
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      const msgs = ['お客さん、合言葉ちがうで！', 'もういっぺん！', 'ほんまにメンバー？🤔'];
      $('#gate-msg').textContent = msgs[Math.floor(Math.random() * msgs.length)];
    }
  });

  $('#logout').addEventListener('click', () => {
    if (!confirm('ログアウトして保存したID/PASSを消しますか？')) return;
    store.del(STORE_KEY);
    location.reload();
  });

  let started = false;
  function enter(quick) {
    if (started) return; started = true;
    const gate = $('#gate');
    gate.classList.add('open');
    $('#app').hidden = false;
    document.body.classList.remove('locked');
    setTimeout(() => {
      gate.classList.add('gone');
      $('#top').classList.add('ready');
      burst(window.innerWidth / 2, window.innerHeight * 0.35, 160);
    }, quick ? 500 : 900);
    initApp();
  }

  /* ========= 本編 ========= */
  function initApp() {
    buildMembers();
    buildChecklist();
    countdown(); setInterval(countdown, 1000);
    observeReveal();
    initTabs();
    initTrain();
    initMini();
    $('#cracker').addEventListener('click', e => burst(e.clientX, e.clientY, 120));
    $('.hero-logo').addEventListener('click', e => {
      const el = e.currentTarget;
      el.classList.remove('spin'); void el.offsetWidth; el.classList.add('spin');
      burst(e.clientX, e.clientY, 60);
    });
    $('#ittekimasu').addEventListener('click', e => {
      burst(e.clientX, e.clientY, 150);
      const mini = $('#mini');
      mini.classList.remove('flip');
      mini.classList.add('driveoff', 'moving');
      mini.style.transform = `translateX(${window.innerWidth + 100}px)`;
      setTimeout(() => {
        mini.classList.remove('driveoff');
        mini.style.transform = 'translateX(-100px)';
        requestAnimationFrame(() => setTimeout(updateMini, 50));
      }, 1600);
    });
  }

  function buildMembers() {
    const wrap = $('#member-list');
    MEMBERS.forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'member reveal';
      b.style.transitionDelay = `${i * 60}ms`;
      b.setAttribute('aria-label', `${m.name}のカード`);
      b.innerHTML = `
        <div class="member-inner">
          <div class="member-face">
            <div class="avatar" style="background:${m.color}">${m.img ? `<img src="${m.img}" alt="">` : m.name[0]}</div>
            <div class="member-no">MEMBER ${String(i + 1).padStart(2, '0')}</div>
            <div class="member-name">${m.name}</div>
          </div>
          <div class="member-face member-back">
            <div class="role">${m.role || 'ひとこと'}</div>
            <p>${m.comment || 'ぶんちゃん開店<br>おめでとう！🎉'}</p>
          </div>
        </div>`;
      b.addEventListener('click', () => b.classList.toggle('flipped'));
      wrap.appendChild(b);
    });
  }

  function buildChecklist() {
    const KEY = 'bunchan-trip-check';
    let state = {};
    try { state = JSON.parse(store.get(KEY) || '{}'); } catch {}
    const ul = $('#checklist');
    let celebrated = false;
    const update = () => {
      const n = CHECKS.filter((_, i) => state[i]).length;
      $('#check-bar').style.width = `${(n / CHECKS.length) * 100}%`;
      $('#check-count').textContent = `${n} / ${CHECKS.length}${n === CHECKS.length ? ' 準備バッチリ！🎉' : ''}`;
      return n === CHECKS.length;
    };
    CHECKS.forEach((t, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = `<span class="cb"></span><span class="t">${t}</span>`;
      if (state[i]) b.classList.add('on');
      b.addEventListener('click', e => {
        state[i] = !state[i];
        b.classList.toggle('on', state[i]);
        store.set(KEY, JSON.stringify(state));
        if (state[i]) burst(e.clientX, e.clientY, 14);
        if (update() && !celebrated) { celebrated = true; burst(window.innerWidth / 2, window.innerHeight / 2, 220); }
        if (!state[i]) celebrated = false;
      });
      li.appendChild(b); ul.appendChild(li);
    });
    update();
  }

  function countdown() {
    const diff = DEPART - Date.now();
    const el = $('#countdown');
    if (diff <= 0) {
      el.classList.add('started');
      $('.cd-label', el).textContent = '🚄 旅、はじまってます！';
      $('.cd-row', el).hidden = true;
      return;
    }
    const s = Math.floor(diff / 1000);
    $('#cd-d').textContent = Math.floor(s / 86400);
    $('#cd-h').textContent = String(Math.floor(s % 86400 / 3600)).padStart(2, '0');
    $('#cd-m').textContent = String(Math.floor(s % 3600 / 60)).padStart(2, '0');
    $('#cd-s').textContent = String(s % 60).padStart(2, '0');
  }

  function observeReveal() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    $$('.reveal, .tl-item').forEach(el => io.observe(el));
    window.addEventListener('scroll', fillTimeline, { passive: true });
    fillTimeline();
  }

  function fillTimeline() {
    const tl = $('.timeline.is-active');
    if (!tl) return;
    const r = tl.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (window.innerHeight * 0.7 - r.top) / r.height));
    $('.tl-fill', tl).style.height = `${p * 100}%`;
  }

  function initTabs() {
    $$('.tab').forEach(tab => tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.toggle('is-active', t === tab));
      $$('.timeline').forEach(t => t.classList.toggle('is-active', t.dataset.day === tab.dataset.day));
      fillTimeline();
    }));
  }

  function initTrain() {
    const train = $('#train');
    const run = () => {
      train.classList.remove('run'); void train.offsetWidth; train.classList.add('run');
      const petals = $('#petals');
      for (let i = 0; i < 24; i++) {
        setTimeout(() => {
          const p = document.createElement('span');
          p.className = 'petal';
          p.style.left = `${Math.random() * 100}%`;
          p.style.top = '-10px';
          p.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
          p.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
          petals.appendChild(p);
          setTimeout(() => p.remove(), 3200);
        }, i * 90);
      }
    };
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) run(); }), { threshold: 0.5 });
    io.observe($('.rail'));
    train.style.pointerEvents = 'auto';
    train.style.cursor = 'pointer';
    train.addEventListener('click', run);
  }

  /* スクロール量に合わせて下の道路をミニが走る */
  let lastY = 0, stopTimer;
  function updateMini() {
    const mini = $('#mini');
    if (mini.classList.contains('driveoff')) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    const x = p * (window.innerWidth - 80);
    mini.classList.toggle('flip', window.scrollY < lastY);
    mini.classList.add('moving');
    lastY = window.scrollY;
    mini.style.transform = `translateX(${x}px)`;
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => mini.classList.remove('moving'), 200);
  }
  function initMini() {
    window.addEventListener('scroll', updateMini, { passive: true });
    window.addEventListener('resize', updateMini);
    updateMini();
  }

  /* ========= 紙吹雪 ========= */
  const cv = $('#confetti');
  const ctx = cv.getContext('2d');
  let parts = [], raf = null;
  const COLORS = ['#E63B2E', '#FFC93C', '#26357A', '#FF8FB1', '#1F5E4A', '#ffffff', '#7FA3FF'];
  function resize() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
  addEventListener('resize', resize); resize();
  function burst(x, y, n) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 8,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[i % COLORS.length], life: 0, round: Math.random() < 0.3,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    const d = devicePixelRatio;
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life < 160 && p.y < innerHeight + 40);
    for (const p of parts) {
      p.life++; p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x * d, p.y * d); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - p.life / 160);
      ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w * d / 2, 0, 7); ctx.fill(); }
      else ctx.fillRect(-p.w * d / 2, -p.h * d / 2, p.w * d, p.h * d * Math.abs(Math.cos(p.life / 6)));
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : (ctx.clearRect(0, 0, cv.width, cv.height), null);
  }

  /* crypto.subtle が使えない環境用（http:// で開いた場合など） */
  function sha256Fallback(ascii) {
    const bytes = new TextEncoder().encode(ascii);
    const K = [], H = [];
    let n = 2, c = 0;
    const isP = x => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; };
    const frac = x => ((x - Math.floor(x)) * 4294967296) | 0;
    while (c < 64) { if (isP(n)) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c++] = frac(Math.pow(n, 1 / 3)); } n++; }
    const l = bytes.length, words = [];
    const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    padded.set(bytes); padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, l * 8);
    for (let i = 0; i < padded.length; i += 4) words.push(dv.getUint32(i));
    const rot = (x, s) => (x >>> s) | (x << (32 - s));
    for (let j = 0; j < words.length; j += 16) {
      const w = words.slice(j, j + 16);
      let [a, b, cc, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        if (i >= 16) {
          const w15 = w[i - 15], w2 = w[i - 2];
          w[i] = (w[i - 16] + (rot(w15, 7) ^ rot(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rot(w2, 17) ^ rot(w2, 19) ^ (w2 >>> 10))) | 0;
        }
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
})();
