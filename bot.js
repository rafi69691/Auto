// ============================================================
// ZYRO AI PRO v5.0 — FULL AUTO ZERO-INPUT EDITION
// Complete auto trading bot with multi-layer data source
// ============================================================

(function () {
  'use strict';

  if (document.getElementById('zyro-algo-container')) {
    alert('⚡ ZYRO v5.0 already active!');
    return;
  }

  const VERSION = '5.0';

  // ============================================================
  // DIAGNOSTICS
  // ============================================================
  const Diag = {
    ws: { connected: false, messages: 0, ticks: 0, unknown: 0 },
    dom: { reads: 0, fails: 0, lastPrice: null, lastReadTime: 0 },
    errors: [],
    log(msg, t = 'info') {
      this.errors.push({ t: Date.now(), msg, type: t });
      if (this.errors.length > 100) this.errors.shift();
      console.log(`[ZYRO:${t}]`, msg);
    },
    report() {
      const data = {
        'WS Connected': this.ws.connected,
        'WS Messages': this.ws.messages,
        'WS Ticks Parsed': this.ws.ticks,
        'WS Unknown Format': this.ws.unknown,
        'DOM Reads OK': this.dom.reads,
        'DOM Reads Fail': this.dom.fails,
        'Last Price': this.dom.lastPrice,
        'Price Age (s)': this.dom.lastReadTime ? ((Date.now() - this.dom.lastReadTime) / 1000).toFixed(1) : 'never'
      };
      console.table(data);
      return data;
    }
  };

  // ============================================================
  // 1. WEBSOCKET INTERCEPTOR — Multi-format
  // ============================================================
  const wsState = {
    lastPrice: {}, ticks: [], candles: {}, currentCandle: {},
    lastTick: null, connected: false,
    stats: { messages: 0, ticks: 0, unknown: 0 }
  };

  function tryParseWS(raw) {
    if (typeof raw !== 'string') return null;
    if (raw.length < 5) return null;

    let obj = null;
    try { obj = JSON.parse(raw); } catch (e) {}
    if (!obj && raw.startsWith('42')) { try { obj = JSON.parse(raw.slice(2)); } catch (e) {} }
    if (!obj) {
      const m = raw.match(/^\d+(.+)$/s);
      if (m) { try { obj = JSON.parse(m[1]); } catch (e) {} }
    }
    if (!obj) return null;

    // Try every known tick format
    const candidates = [
      obj.type === 'tick' && obj.price ? { asset: obj.asset || obj.symbol, price: +obj.price, time: obj.time || Date.now() } : null,
      obj.t === 'q' && obj.p ? { asset: obj.s, price: +obj.p, time: obj.ts || Date.now() } : null,
      obj.t === 'tick' && obj.p ? { asset: obj.a || obj.s, price: +obj.p, time: obj.ts || Date.now() } : null,
      (obj.price != null && (obj.asset || obj.symbol)) ? { asset: obj.asset || obj.symbol, price: +obj.price, time: obj.time || Date.now() } : null,
      (obj.p != null && (obj.s || obj.a)) ? { asset: obj.s || obj.a, price: +obj.p, time: obj.ts || Date.now() } : null,
      (obj.value != null && (obj.asset || obj.symbol)) ? { asset: obj.asset || obj.symbol, price: +obj.value, time: Date.now() } : null,
    ];
    for (const c of candidates) {
      if (c && c.asset && c.price && !isNaN(c.price) && c.price > 0) return c;
    }

    // Array format: ["tick", {...}]
    if (Array.isArray(obj) && obj.length === 2 && typeof obj[0] === 'string') {
      if (obj[0] === 'tick' && obj[1]) return { asset: obj[1].asset || obj[1].symbol, price: +obj[1].price, time: Date.now() };
      if (obj[0] === 'quotes' && Array.isArray(obj[1])) {
        return obj[1].map(q => ({ asset: q.asset || q.symbol, price: +q.price, time: Date.now() })).filter(t => t.asset && t.price);
      }
    }

    if (wsState.stats.unknown < 3) {
      console.warn('[ZYRO] Unknown WS format:', raw.slice(0, 250));
    }
    wsState.stats.unknown++;
    Diag.ws.unknown++;
    return null;
  }

  function feedTick(tick) {
    if (!tick) return;
    if (Array.isArray(tick)) { tick.forEach(feedTick); return; }
    if (!tick.asset || !tick.price || isNaN(tick.price) || tick.price <= 0) return;

    wsState.lastPrice[tick.asset] = tick.price;
    wsState.lastTick = tick;
    wsState.stats.ticks++;
    Diag.ws.ticks++;
    Diag.dom.lastPrice = tick.price;
    Diag.dom.lastReadTime = Date.now();

    wsState.ticks.push(tick);
    if (wsState.ticks.length > 8000) wsState.ticks.shift();

    const bucket = Math.floor(tick.time / 60000) * 60000;
    let cur = wsState.currentCandle[tick.asset];
    if (!cur || cur.time !== bucket) {
      if (cur) {
        if (!wsState.candles[tick.asset]) wsState.candles[tick.asset] = [];
        wsState.candles[tick.asset].push(cur);
        if (wsState.candles[tick.asset].length > 300) wsState.candles[tick.asset].shift();
      }
      cur = { time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
      wsState.currentCandle[tick.asset] = cur;
    } else {
      cur.high = Math.max(cur.high, tick.price);
      cur.low = Math.min(cur.low, tick.price);
      cur.close = tick.price;
    }
  }

  const _WS = window.WebSocket;
  function ZyroWS(url, p) {
    const ws = p ? new _WS(url, p) : new _WS(url);
    wsState.connected = true;
    Diag.ws.connected = true;
    ws.addEventListener('message', (e) => {
      wsState.stats.messages++;
      Diag.ws.messages++;
      const t = tryParseWS(e.data);
      if (t) feedTick(t);
    });
    return ws;
  }
  ZyroWS.CONNECTING = _WS.CONNECTING;
  ZyroWS.OPEN = _WS.OPEN;
  ZyroWS.CLOSING = _WS.CLOSING;
  ZyroWS.CLOSED = _WS.CLOSED;
  ZyroWS.prototype = _WS.prototype;
  window.WebSocket = ZyroWS;

  // ============================================================
  // 2. MULTI-LAYER PRICE READER
  // ============================================================
  let lastPrice = null;
  let priceHistory = [];

  function readPrice() {
    // Layer 1: WebSocket
    const assets = Object.keys(wsState.lastPrice);
    if (assets.length && Date.now() - Diag.dom.lastReadTime < 10000) {
      const p = wsState.lastPrice[assets[0]];
      if (p && p > 0) { Diag.dom.reads++; return p; }
    }

    // Layer 2: DOM - specific selectors
    const sels = [
      '[class*="current-price"]', '[class*="price-value"]', '[class*="value__val"]',
      '[class*="deal-finish"]', '[class*="quote-price"]', '[class*="asset-price"]',
      '[class*="current-quote"]', '.live-price', '[class*="chart-price"]',
      '[class*="instrument-price"]', '[class*="price__"]', '[data-test*="price"]'
    ];
    for (const sel of sels) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const t = (el.textContent || '').trim();
        const m = t.match(/(\d{1,6}\.\d{3,6})/);
        if (m) {
          const v = +m[1];
          if (v > 0 && v < 1e6) {
            Diag.dom.reads++;
            Diag.dom.lastPrice = v;
            Diag.dom.lastReadTime = Date.now();
            return v;
          }
        }
      }
    }

    // Layer 3: DOM brute force
    const all = document.querySelectorAll('div, span, td, p');
    for (let i = Math.max(0, all.length - 800); i < all.length; i++) {
      const el = all[i];
      if (el.children.length > 1) continue;
      const t = (el.textContent || '').trim();
      if (/^\d{1,6}\.\d{3,6}$/.test(t)) {
        const v = +t;
        if (v > 0 && v < 1e6) {
          Diag.dom.reads++;
          Diag.dom.lastPrice = v;
          Diag.dom.lastReadTime = Date.now();
          return v;
        }
      }
    }

    // Layer 4: Title attributes
    const titled = document.querySelectorAll('[title]');
    for (const el of titled) {
      const t = el.getAttribute('title') || '';
      const m = t.match(/(\d{1,6}\.\d{3,6})/);
      if (m) {
        const v = +m[1];
        if (v > 0 && v < 1e6) {
          Diag.dom.reads++;
          Diag.dom.lastPrice = v;
          Diag.dom.lastReadTime = Date.now();
          return v;
        }
      }
    }

    // Layer 5: iframes
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const f of iframes) {
        try {
          const doc = f.contentDocument || f.contentWindow.document;
          const nodes = doc.querySelectorAll('[class*="price"], [class*="value"]');
          for (const el of nodes) {
            const t = (el.textContent || '').trim();
            const m = t.match(/(\d{1,6}\.\d{3,6})/);
            if (m) {
              const v = +m[1];
              if (v > 0) {
                Diag.dom.reads++;
                Diag.dom.lastPrice = v;
                Diag.dom.lastReadTime = Date.now();
                return v;
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    Diag.dom.fails++;
    // Fallback: last known (up to 30s old)
    if (Diag.dom.lastPrice && Date.now() - Diag.dom.lastReadTime < 30000) return Diag.dom.lastPrice;
    return null;
  }

  // Poll price every second
  setInterval(() => {
    const p = readPrice();
    if (p) {
      lastPrice = p;
      const bucket = Math.floor(Date.now() / 60000) * 60000;
      priceHistory.push({ price: p, time: Date.now(), bucket });
      if (priceHistory.length > 600) priceHistory.shift();
    }
  }, 1000);

  // Build candles from price history
  function getDynCandles() {
    if (!priceHistory.length) return [];
    const buckets = {};
    for (const t of priceHistory) {
      if (!buckets[t.bucket]) buckets[t.bucket] = { open: t.price, high: t.price, low: t.price, close: t.price, time: t.bucket };
      const b = buckets[t.bucket];
      b.high = Math.max(b.high, t.price);
      b.low = Math.min(b.low, t.price);
      b.close = t.price;
    }
    return Object.values(buckets).sort((a, b) => a.time - b.time).map(c => ({
      ...c,
      isGreen: c.close >= c.open,
      body: Math.abs(c.close - c.open),
      total: Math.max(c.high - c.low, 0.00001),
      upperWick: c.high - Math.max(c.open, c.close),
      lowerWick: Math.min(c.open, c.close) - c.low
    }));
  }

  function getCandles() {
    const assets = Object.keys(wsState.lastPrice);
    if (assets.length) {
      let best = null, max = 0;
      for (const a of assets) {
        const n = (wsState.candles[a] || []).length;
        if (n > max) { max = n; best = a; }
      }
      if (best && max >= 2) {
        return wsState.candles[best].map(c => ({
          ...c,
          isGreen: c.close >= c.open,
          body: Math.abs(c.close - c.open),
          total: Math.max(c.high - c.low, 0.00001),
          upperWick: c.high - Math.max(c.open, c.close),
          lowerWick: Math.min(c.open, c.close) - c.low
        }));
      }
    }
    return getDynCandles();
  }

  // ============================================================
  // 3. INDICATORS
  // ============================================================
  const Ind = {
    ema(d, p) {
      if (!d.length) return [];
      const k = 2 / (p + 1);
      const o = [d[0]];
      for (let i = 1; i < d.length; i++) o.push(d[i] * k + o[i - 1] * (1 - k));
      return o;
    },
    rsi(c, p = 14) {
      if (c.length < p + 1) return 50;
      let g = 0, l = 0;
      for (let i = 1; i <= p; i++) {
        const d = c[i] - c[i - 1];
        if (d > 0) g += d; else l -= d;
      }
      let ag = g / p, al = l / p;
      for (let i = p + 1; i < c.length; i++) {
        const d = c[i] - c[i - 1];
        ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
        al = (al * (p - 1) + (d < 0 ? -d : 0)) / p;
      }
      if (al === 0) return 100;
      return 100 - 100 / (1 + ag / al);
    },
    macd(c) {
      if (c.length < 26) return 0;
      const ef = Ind.ema(c, 12), es = Ind.ema(c, 26);
      const ml = ef.map((v, i) => v - es[i]);
      const sl = Ind.ema(ml.slice(25), 9);
      return ml[ml.length - 1] - sl[sl.length - 1];
    },
    bb(c, p = 20) {
      if (c.length < p) return { upper: 0, lower: 0 };
      const s = c.slice(-p);
      const m = s.reduce((a, b) => a + b, 0) / p;
      const v = s.reduce((a, b) => a + (b - m) ** 2, 0) / p;
      const std = Math.sqrt(v);
      return { upper: m + 2 * std, lower: m - 2 * std };
    }
  };

  // ============================================================
  // 4. SIGNAL ENGINE — Never returns null
  // ============================================================
  function detectPattern(c) {
    if (c.length < 2) return { dir: null, w: 0, n: 'NONE' };
    const p = c[c.length - 2], x = c[c.length - 1];
    if (p.body > 1e-5) {
      if (!p.isGreen && x.isGreen && x.body > p.body * 1.1 && x.close > p.high) return { dir: 'CALL', w: 25, n: 'ENGULF+' };
      if (p.isGreen && !x.isGreen && x.body > p.body * 1.1 && x.close < p.low) return { dir: 'PUT', w: 25, n: 'ENGULF-' };
    }
    if (x.lowerWick > x.body * 1.5 && x.upperWick < x.body * 0.7) return { dir: 'CALL', w: 20, n: 'HAMMER' };
    if (x.upperWick > x.body * 1.5 && x.lowerWick < x.body * 0.7) return { dir: 'PUT', w: 20, n: 'SHOOT' };
    if (c.length >= 3) {
      const c3 = c[c.length - 3];
      if (c3.isGreen && p.isGreen && x.isGreen) return { dir: 'CALL', w: 22, n: 'SOLDIERS' };
      if (!c3.isGreen && !p.isGreen && !x.isGreen) return { dir: 'PUT', w: 22, n: 'CROWS' };
    }
    return { dir: null, w: 0, n: 'NONE' };
  }

  function analyze(candles) {
    if (!candles || candles.length < 2) {
      const seed = Math.floor(Date.now() / 60000) % 2;
      const dir = seed === 0 ? 'CALL' : 'PUT';
      return { dir, conf: 51, pattern: 'TIME FALLBACK', signals: [{ name: 'TIME', dir }] };
    }

    const closes = candles.map(c => c.close);
    const last = candles[candles.length - 1];
    let call = 0, put = 0;
    const sigs = [];

    const pat = detectPattern(candles);
    if (pat.dir === 'CALL') { call += pat.w; sigs.push({ name: pat.n, dir: 'CALL' }); }
    else if (pat.dir === 'PUT') { put += pat.w; sigs.push({ name: pat.n, dir: 'PUT' }); }

    if (closes.length >= 15) {
      const r = Ind.rsi(closes);
      if (r < 32) { call += 14; sigs.push({ name: 'RSI-OS', dir: 'CALL' }); }
      else if (r > 68) { put += 14; sigs.push({ name: 'RSI-OB', dir: 'PUT' }); }
    }

    if (closes.length >= 20) {
      const e20 = Ind.ema(closes, 20).pop();
      const e50 = closes.length >= 50 ? Ind.ema(closes, 50).pop() : e20;
      if (e20 > e50) { call += 10; sigs.push({ name: 'EMA+', dir: 'CALL' }); }
      else { put += 10; sigs.push({ name: 'EMA-', dir: 'PUT' }); }
    }

    if (closes.length >= 26) {
      const m = Ind.macd(closes);
      if (m > 0) { call += 10; sigs.push({ name: 'MACD+', dir: 'CALL' }); }
      else { put += 10; sigs.push({ name: 'MACD-', dir: 'PUT' }); }
    }

    if (closes.length >= 20) {
      const b = Ind.bb(closes);
      if (b.lower > 0 && last.close < b.lower) { call += 8; sigs.push({ name: 'BB-LOW', dir: 'CALL' }); }
      if (b.upper > 0 && last.close > b.upper) { put += 8; sigs.push({ name: 'BB-HI', dir: 'PUT' }); }
    }

    if (candles.length >= 3) {
      const c3 = candles[candles.length - 3], c2 = candles[candles.length - 2];
      if (c3.close < c2.close && c2.close < last.close) { call += 10; sigs.push({ name: 'MOM+', dir: 'CALL' }); }
      else if (c3.close > c2.close && c2.close > last.close) { put += 10; sigs.push({ name: 'MOM-', dir: 'PUT' }); }
    }

    if (candles.length >= 10) {
      const r = candles.slice(-10);
      const ph = Math.max(...r.slice(0, 9).map(c => c.high));
      const pl = Math.min(...r.slice(0, 9).map(c => c.low));
      if (last.close > ph) { call += 12; sigs.push({ name: 'BRK+', dir: 'CALL' }); }
      else if (last.close < pl) { put += 12; sigs.push({ name: 'BRK-', dir: 'PUT' }); }
    }

    if (call === 0 && put === 0) {
      const dir = last.close >= last.open ? 'CALL' : 'PUT';
      if (dir === 'CALL') call += 50; else put += 50;
      sigs.push({ name: 'LAST', dir });
    }
    if (call === put) {
      const dir = last.close >= last.open ? 'CALL' : 'PUT';
      if (dir === 'CALL') call += 5; else put += 5;
    }

    const total = call + put;
    const winner = call > put ? 'CALL' : 'PUT';
    const conf = Math.max(51, Math.min(99, Math.round(Math.max(call, put) / total * 100)));

    return {
      dir: winner,
      conf,
      pattern: sigs[0]?.name || 'COMPOSITE',
      signals: sigs.filter(s => s.dir === winner).slice(0, 3)
    };
  }

  // ============================================================
  // 5. AUDIO
  // ============================================================
  const actx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq, dur, type = 'sine', vol = 0.25) {
    try {
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, actx.currentTime);
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }
  function soundWin() { beep(660, 0.15); setTimeout(() => beep(880, 0.2), 150); }
  function soundLoss() { beep(280, 0.3, 'sawtooth'); }
  function soundTrade() { beep(1000, 0.1); }

  let soundOn = true;
  function speak(t) {
    if (!soundOn) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.rate = 1.15;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ============================================================
  // 6. TRADE LOG
  // ============================================================
  const Log = {
    t: [],
    load() { try { this.t = JSON.parse(localStorage.getItem('zyro5_trades') || '[]'); } catch (e) {} },
    add(x) {
      this.t.push({ ...x, ts: Date.now() });
      if (this.t.length > 1000) this.t.shift();
      try { localStorage.setItem('zyro5_trades', JSON.stringify(this.t)); } catch (e) {}
    },
    stats() {
      const n = this.t.length, w = this.t.filter(t => t.result === 'WIN').length;
      return {
        total: n, wins: w, losses: n - w,
        winRate: n ? ((w / n) * 100).toFixed(1) : '0',
        profit: this.t.reduce((a, t) => a + (t.profit || 0), 0)
      };
    },
    csv() {
      const h = 'time,asset,dir,amt,entry,exit,result,profit\n';
      const r = this.t.map(t => `${new Date(t.ts).toISOString()},${t.asset},${t.direction},${t.amount},${t.entry},${t.exit},${t.result},${t.profit}`).join('\n');
      const b = new Blob([h + r], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `zyro_${Date.now()}.csv`;
      a.click();
    }
  };
  Log.load();

  // ============================================================
  // 7. STYLES
  // ============================================================
  const st = document.createElement('style');
  st.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
    #zyro-algo-container{position:fixed;top:50px;right:10px;width:260px;
      background:radial-gradient(circle at top,rgba(15,23,42,0.98),rgba(3,7,18,0.99));
      border:1.5px solid #00f2fe;border-radius:16px;box-shadow:0 15px 35px rgba(0,0,0,0.9),0 0 25px rgba(0,242,254,0.35);
      color:#fff;font-family:'Orbitron',monospace;z-index:99999999;padding:10px;user-select:none;
      max-height:95vh;overflow-y:auto;transition:transform .15s}
    #zyro-algo-container.min{width:54px!important;height:54px!important;border-radius:50%!important;padding:0!important;
      display:flex;align-items:center;justify-content:center;animation:zp 2s infinite}
    @keyframes zp{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
    .zh{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,242,254,0.2);padding-bottom:5px;margin-bottom:6px;cursor:grab}
    .zb{font-size:10px;font-weight:900}.zb span{color:#00f2fe}
    .zc{display:flex;gap:8px;font-size:13px;color:#64748b;cursor:pointer}.zc span:hover{color:#00f2fe}
    .mi{display:none;color:#00f2fe;font-weight:900}.min .mi{display:block!important}.min .zb2,.min .zh{display:none!important}
    .pill{background:rgba(0,242,254,0.12);border:1px solid #00f2fe;border-radius:6px;padding:4px 6px;
      font-size:10px;font-weight:800;color:#00f2fe;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
    .badge{font-size:8px;padding:2px 5px;border-radius:4px;font-weight:900}
    .ok{background:#065f46;color:#6ee7b7}.bad{background:#7f1d1d;color:#fca5a5}.warn{background:#78350f;color:#fbbf24}
    .card{text-align:center;padding:8px 4px;border-radius:8px;background:rgba(0,242,254,0.05);
      border:1px dashed rgba(0,242,254,0.4);margin-bottom:6px;min-height:60px;display:flex;flex-direction:column;justify-content:center;align-items:center}
    .conf-lbl{font-size:8px;color:#94a3b8;font-weight:700}
    .dir{font-size:12px;font-weight:900}
    .sig{font-size:7px;color:#64748b;margin-top:3px}
    .cbar{width:90%;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:4px;overflow:hidden}
    .cfill{height:100%;background:linear-gradient(90deg,#ef4444,#f59e0b,#00e676)}
    .stats{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.06);
      border-radius:8px;padding:5px;margin-bottom:6px;font-size:9px}
    .stat{display:flex;justify-content:space-between;color:#94a3b8}
    .stat b{color:#e2e8f0}
    .btn{width:100%;padding:8px;border-radius:8px;border:none;font-family:'Orbitron',monospace;font-weight:900;
      font-size:11px;cursor:pointer;text-transform:uppercase;margin-bottom:4px}
    .btn-go{background:linear-gradient(135deg,#00f2fe,#0284c7);color:#fff;box-shadow:0 0 15px rgba(0,242,254,0.5)}
    .btn-stop{background:linear-gradient(135deg,#ef4444,#991b1b);color:#fff}
    .btn-mini{padding:4px;font-size:8px;background:rgba(0,242,254,0.15);color:#00f2fe;border:1px solid rgba(0,242,254,0.3)}
    #zyro-popup{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) scale(0.3);
      padding:16px 24px;border-radius:14px;z-index:2147483647;font-family:'Orbitron',monospace;
      font-size:12.5px;font-weight:900;text-align:center;opacity:0;pointer-events:none;
      transition:all .35s cubic-bezier(.175,.885,.32,1.275);color:#fff}
    #zyro-popup.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
    .win{background:linear-gradient(135deg,#059669,#047857);border:2px solid #00e676;box-shadow:0 0 35px rgba(0,230,118,0.8)}
    .loss{background:linear-gradient(135deg,#dc2626,#7f1d1d);border:2px solid #f87171;box-shadow:0 0 35px rgba(239,68,68,0.8)}
  `;
  document.head.appendChild(st);

  const popup = document.createElement('div');
  popup.id = 'zyro-popup';
  document.body.appendChild(popup);

  // ============================================================
  // 8. UI HTML
  // ============================================================
  const c = document.createElement('div');
  c.id = 'zyro-algo-container';
  c.innerHTML = `
    <div class="zh" id="drag">
      <div class="zb">⚡ <span>ZYRO</span> v${VERSION}</div>
      <div class="zc"><span id="snd">🔊</span><span id="mn">—</span><span id="cl">✕</span></div>
    </div>
    <div class="zb2">
      <div class="pill">
        <span id="asset">AUTO</span>
        <span style="display:flex;gap:4px;align-items:center;">
          <span class="badge bad" id="badge">WAIT</span>
          <span id="payout" style="color:#00e676">85%</span>
        </span>
      </div>
      <div class="card">
        <div class="conf-lbl" id="confl">ANALYZING</div>
        <div class="dir" id="dir">--</div>
        <div class="sig" id="sig"></div>
        <div class="cbar"><div class="cfill" id="cfill" style="width:0%"></div></div>
      </div>
      <div class="stats">
        <div class="stat"><span>WR:</span><b id="acc" style="color:#00e676">--</b></div>
        <div class="stat"><span>Clock:</span><b id="clk">--:--</b></div>
        <div class="stat"><span>W/L:</span><b id="wl">0/0</b></div>
        <div class="stat"><span>MTG:</span><b id="mtg" style="color:#f59e0b">0</b></div>
        <div class="stat"><span>P/L:</span><b id="pnl" style="color:#00e676">$0</b></div>
        <div class="stat"><span>Ticks:</span><b id="tks" style="color:#38bdf8">0</b></div>
      </div>
      <button class="btn btn-go" id="start">▶ START AUTO (FULL)</button>
      <button class="btn btn-mini" id="statsBtn">📊 STATS</button>
      <button class="btn btn-mini" id="diagBtn">🔧 DIAG</button>
      <button class="btn btn-mini" id="csvBtn">📁 CSV</button>
    </div>
    <div class="mi">ZY</div>
  `;
  document.body.appendChild(c);

  const $ = id => document.getElementById(id);
  const assetEl = $('asset'), badgeEl = $('badge'), payoutEl = $('payout');
  const conflEl = $('confl'), dirEl = $('dir'), sigEl = $('sig'), cfillEl = $('cfill');
  const accEl = $('acc'), clkEl = $('clk'), wlEl = $('wl'), mtgEl = $('mtg'), pnlEl = $('pnl'), tksEl = $('tks');
  const startBtn = $('start');

  // ============================================================
  // 9. DRAG
  // ============================================================
  let dragging = false, cx, cy, ix, iy, ox = 0, oy = 0;
  $('drag').addEventListener('mousedown', e => {
    if (e.target.tagName === 'SPAN') return;
    dragging = true;
    ix = e.clientX - ox;
    iy = e.clientY - oy;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    cx = e.clientX - ix; cy = e.clientY - iy;
    ox = cx; oy = cy;
    c.style.transform = `translate3d(${cx}px,${cy}px,0)`;
  });
  document.addEventListener('mouseup', () => dragging = false);

  c.addEventListener('touchstart', e => {
    if (!['INPUT', 'BUTTON', 'SELECT'].includes(e.target.tagName)) {
      ix = e.touches[0].clientX - ox;
      iy = e.touches[0].clientY - oy;
      dragging = true;
    }
  }, { passive: true });
  c.addEventListener('touchmove', e => {
    if (dragging) {
      cx = e.touches[0].clientX - ix;
      cy = e.touches[0].clientY - iy;
      ox = cx; oy = cy;
      c.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    }
  }, { passive: true });
  c.addEventListener('touchend', () => dragging = false);

  $('mn').onclick = e => { e.stopPropagation(); c.classList.add('min'); };
  c.onclick = () => { if (c.classList.contains('min')) c.classList.remove('min'); };
  $('cl').onclick = e => { e.stopPropagation(); c.remove(); popup.remove(); };
  $('snd').onclick = e => {
    e.stopPropagation();
    soundOn = !soundOn;
    $('snd').innerText = soundOn ? '🔊' : '🔇';
  };
  $('statsBtn').onclick = () => {
    const s = Log.stats();
    alert(`📊 STATS\n\nTotal: ${s.total}\nWins: ${s.wins}\nLosses: ${s.losses}\nWin Rate: ${s.winRate}%\nP/L: $${s.profit.toFixed(2)}`);
  };
  $('diagBtn').onclick = () => {
    const d = Diag.report();
    alert(`🔧 DIAGNOSTICS\n\nWS Connected: ${d['WS Connected']}\nWS Messages: ${d['WS Messages']}\nWS Ticks: ${d['WS Ticks Parsed']}\nWS Unknown: ${d['WS Unknown Format']}\nDOM Reads OK: ${d['DOM Reads OK']}\nDOM Reads Fail: ${d['DOM Reads Fail']}\nLast Price: ${d['Last Price']}\nPrice Age: ${d['Price Age (s)']}s`);
  };
  $('csvBtn').onclick = () => Log.csv();

  // ============================================================
  // 10. TRADE EXECUTION
  // ============================================================
  let running = false;
  let baseAmt = 1, curAmt = 1, mtgMult = 2.2, step = 0;
  let wins = 0, losses = 0, pnl = 0;
  let waitResult = false, lastMinute = -1, lastDir = null;
  let stopLoss = 15, takeProfit = 30;

  function setAmount(a) {
    const ins = document.querySelectorAll("input[type='text'],input[type='number']");
    for (const i of ins) {
      if (i.name === 'amount' || i.placeholder === 'Investment' || i.getAttribute('autocomplete') === 'off') {
        i.value = a;
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }

  function getButtons() {
    let up = null, dn = null;
    document.querySelectorAll('button').forEach(b => {
      if (b.querySelector('.icon-arrow-up-circle') || b.classList.contains('call-btn') || /^up$/i.test(b.innerText.trim())) up = b;
      if (b.querySelector('.icon-arrow-down-circle') || b.classList.contains('put-btn') || /^down$/i.test(b.innerText.trim())) dn = b;
    });
    return { up, dn };
  }

  async function waitResult() {
    const sel = '[class*="history"] [class*="item"],[class*="trades-list"] [class*="item"],[class*="positions"] [class*="item"]';
    const before = document.querySelectorAll(sel).length;
    const t0 = Date.now();
    return new Promise(res => {
      const iv = setInterval(() => {
        const items = document.querySelectorAll(sel);
        if (items.length > before) {
          const x = items[0];
          const h = x.innerHTML.toLowerCase(), cls = x.className.toLowerCase();
          clearInterval(iv);
          if (h.includes('win') || cls.includes('win') || x.querySelector('[class*="win"]')) res('WIN');
          else if (h.includes('loss') || cls.includes('loss') || x.querySelector('[class*="loss"]')) res('LOSS');
          else res('UNKNOWN');
          return;
        }
        if (Date.now() - t0 > 70000) { clearInterval(iv); res('UNKNOWN'); }
      }, 400);
    });
  }

  function popupShow(win, txt) {
    popup.className = (win ? 'win' : 'loss') + ' show';
    popup.innerHTML = win
      ? `🎉 PROFIT!<br><span style="font-size:9px">${txt}</span>`
      : `⚠️ LOSS<br><span style="font-size:9px">${txt}</span>`;
    win ? soundWin() : soundLoss();
    setTimeout(() => { popup.className = popup.className.replace(' show', ''); }, 2400);
  }

  async function doTrade(dir, pattern) {
    const { up, dn } = getButtons();
    if (!up && !dn) { Diag.log('Buttons not found', 'error'); return; }

    setAmount(curAmt);
    const entry = readPrice() || Diag.dom.lastPrice;
    lastDir = dir;
    waitResult = true;

    if (dir === 'CALL' && up) { up.click(); soundTrade(); }
    else if (dir === 'PUT' && dn) { dn.click(); soundTrade(); }
    else { waitResult = false; return; }

    const result = await waitResult();
    const exit = readPrice() || Diag.dom.lastPrice;
    const payout = 85;
    const gain = curAmt * (payout / 100);
    const delta = `${entry || '?'} → ${exit || '?'}`;

    if (result === 'WIN') {
      wins++; pnl += gain; step = 0; curAmt = baseAmt;
      popupShow(true, delta);
      speak('Win');
    } else if (result === 'LOSS') {
      losses++; pnl -= curAmt; step++;
      if (step <= 2) curAmt = +(curAmt * mtgMult).toFixed(2);
      else { step = 0; curAmt = baseAmt; }
      popupShow(false, delta);
      speak('Loss recovery');
    }

    Log.add({
      asset: assetEl.innerText, direction: dir, amount: curAmt,
      entry, exit, result, profit: result === 'WIN' ? gain : -curAmt
    });
    updateUI();
    waitResult = false;

    // SL / TP
    if (pnl <= -stopLoss) {
      alert(`⚠️ STOP LOSS HIT (-$${stopLoss})`);
      if (running) startBtn.click();
    } else if (pnl >= takeProfit) {
      alert(`🎉 TAKE PROFIT (+$${takeProfit})!`);
      if (running) startBtn.click();
    }
  }

  function updateUI() {
    const t = wins + losses;
    accEl.innerText = t ? ((wins / t) * 100).toFixed(0) + '%' : '--';
    wlEl.innerText = `${wins}/${losses}`;
    mtgEl.innerText = step;
    pnlEl.innerText = `$${pnl.toFixed(2)}`;
    pnlEl.style.color = pnl >= 0 ? '#00e676' : '#ef4444';
    accEl.style.color = (t && wins / t >= 0.55) ? '#00e676' : '#f59e0b';
  }

  // ============================================================
  // 11. START / STOP
  // ============================================================
  startBtn.onclick = () => {
    running = !running;
    if (running) {
      baseAmt = 1;
      curAmt = baseAmt;
      step = 0;
      startBtn.className = 'btn btn-stop';
      startBtn.innerText = '⏸ STOP AUTO';
      speak('Auto trading started');
      soundTrade();
    } else {
      startBtn.className = 'btn btn-go';
      startBtn.innerText = '▶ START AUTO (FULL)';
      dirEl.innerText = 'PAUSED';
    }
  };

  // ============================================================
  // 12. MAIN LOOP
  // ============================================================
  setInterval(() => {
    const p = readPrice();
    if (p) lastPrice = p;

    // Badge
    if (wsState.connected && wsState.stats.ticks > 0) {
      badgeEl.className = 'badge ok';
      badgeEl.innerText = 'WS';
    } else if (p) {
      badgeEl.className = 'badge warn';
      badgeEl.innerText = 'DOM';
    } else {
      badgeEl.className = 'badge bad';
      badgeEl.innerText = 'NO';
    }

    tksEl.innerText = wsState.stats.ticks;

    const d = new Date();
    const m = d.getMinutes(), s = d.getSeconds();
    clkEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (!running || waitResult) return;

    const candles = getCandles();
    const sig = analyze(candles);

    conflEl.innerText = `[${sig.pattern}] ${sig.conf}%`;
    dirEl.innerText = sig.dir === 'CALL' ? `▲ ${sig.dir}` : `▼ ${sig.dir}`;
    dirEl.style.color = sig.dir === 'CALL' ? '#00e676' : '#ef4444';
    cfillEl.style.width = sig.conf + '%';
    sigEl.innerText = sig.signals.map(x => x.name).join(' • ');

    // Execute at :58
    if (s === 58 && lastMinute !== m) {
      lastMinute = m;
      let dir = sig.dir, pat = sig.pattern;
      if (step > 0 && lastDir) { dir = lastDir; pat = `MTG ${step}`; }
      dirEl.innerText = dir === 'CALL' ? `▲ FIRE CALL` : `▼ FIRE PUT`;
      doTrade(dir, pat);
    }
  }, 1000);

  // ============================================================
  // INIT
  // ============================================================
  Diag.log('ZYRO v' + VERSION + ' loaded. Auto price detection active.', 'info');
  speak('Zyro version five ready');

  window.ZYRO = {
    diag: () => Diag.report(),
    price: () => lastPrice,
    analyze: () => analyze(getCandles()),
    start: () => { if (!running) startBtn.click(); },
    stop: () => { if (running) startBtn.click(); },
    stats: () => Log.stats(),
    assets: () => Object.keys(wsState.lastPrice)
  };
  window.ZYRO_WS = {
    getStats: () => ({ ...wsState.stats, connected: wsState.connected }),
    getAssets: () => Object.keys(wsState.lastPrice),
    getPrice: (a) => a ? wsState.lastPrice[a] : lastPrice,
    dump: () => Diag.report()
  };

  console.log('%c⚡ ZYRO v' + VERSION + ' FULL AUTO READY', 'color:#00f2fe;font-size:14px;font-weight:bold');
  console.log('Commands: ZYRO.start() | ZYRO.stop() | ZYRO.diag() | ZYRO.price() | ZYRO.analyze() | ZYRO_WS.getAssets()');

})();
