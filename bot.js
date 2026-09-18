// ============================================================
// ZYRO AI PRO v6.0 — FULL MARKET SCANNER + AUTO PAIR SWITCH
// Fixes: WS fail, DOM stale price, asset isolation, payout filter
// ============================================================

(function () {
  'use strict';

  if (document.getElementById('zyro-algo-container')) {
    alert('⚡ ZYRO v6.0 already active!');
    return;
  }

  const VERSION = '6.0';

  // ============================================================
  // SETTINGS
  // ============================================================
  const CFG = {
    minPayout: 85,          // Minimum payout % to consider
    maxMtgSteps: 2,         // Martingale limit
    mtgMult: 2.2,
    baseAmount: 1,
    scanInterval: 30000,    // Rescan market every 30s
    priceMaxAge: 8000,      // Reject price older than 8s
    autoSwitch: true,       // Auto-switch to best pair
    minConf: 60
  };

  // ============================================================
  // DIAGNOSTICS
  // ============================================================
  const Diag = {
    ws: { connected: false, messages: 0, ticks: 0, unknown: 0 },
    dom: { reads: 0, fails: 0, rejected: 0 },
    errors: [],
    log(msg, t = 'info') {
      this.errors.push({ t: Date.now(), msg, type: t });
      if (this.errors.length > 100) this.errors.shift();
      console.log(`[ZYRO:${t}]`, msg);
    }
  };

  // ============================================================
  // PER-ASSET STATE — সমস্ত data pair আলাদা রাখা হবে
  // ============================================================
  const Assets = {};  // { pairName: { ticks:[], candles:[], current:null, payout: 0, lastPrice: 0, lastTime: 0 } }

  function getAsset(name) {
    if (!Assets[name]) {
      Assets[name] = { ticks: [], candles: [], current: null, payout: 0, lastPrice: 0, lastTime: 0 };
    }
    return Assets[name];
  }

  // ============================================================
  // 1. WEBSOCKET INTERCEPTOR
  // ============================================================
  const wsState = { messages: 0, ticks: 0, unknown: 0, connected: false };

  function tryParseWS(raw) {
    if (typeof raw !== 'string' || raw.length < 5) return null;
    let obj = null;
    try { obj = JSON.parse(raw); } catch (e) {}
    if (!obj && raw.startsWith('42')) { try { obj = JSON.parse(raw.slice(2)); } catch (e) {} }
    if (!obj) {
      const m = raw.match(/^\d+(.+)$/s);
      if (m) { try { obj = JSON.parse(m[1]); } catch (e) {} }
    }
    if (!obj) return null;

    const tries = [
      obj.type === 'tick' && obj.price ? { asset: obj.asset || obj.symbol, price: +obj.price, time: obj.time || Date.now() } : null,
      obj.t === 'q' && obj.p ? { asset: obj.s, price: +obj.p, time: obj.ts || Date.now() } : null,
      (obj.price != null && (obj.asset || obj.symbol)) ? { asset: obj.asset || obj.symbol, price: +obj.price, time: obj.time || Date.now() } : null,
      (obj.p != null && (obj.s || obj.a)) ? { asset: obj.s || obj.a, price: +obj.p, time: obj.ts || Date.now() } : null,
    ];
    for (const t of tries) {
      if (t && t.asset && t.price && !isNaN(t.price) && t.price > 0) return t;
    }

    if (Array.isArray(obj) && obj.length === 2 && typeof obj[0] === 'string') {
      if (obj[0] === 'tick' && obj[1]) return { asset: obj[1].asset || obj[1].symbol, price: +obj[1].price, time: Date.now() };
    }
    return null;
  }

  function feedTick(tick) {
    if (!tick || !tick.asset || !tick.price || isNaN(tick.price) || tick.price <= 0) return;
    const a = getAsset(tick.asset);
    a.lastPrice = tick.price;
    a.lastTime = Date.now();
    a.ticks.push(tick);
    if (a.ticks.length > 2000) a.ticks.shift();

    const bucket = Math.floor(tick.time / 60000) * 60000;
    let cur = a.current;
    if (!cur || cur.time !== bucket) {
      if (cur) {
        a.candles.push(cur);
        if (a.candles.length > 300) a.candles.shift();
      }
      cur = { time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
      a.current = cur;
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
      wsState.messages++;
      Diag.ws.messages++;
      const t = tryParseWS(e.data);
      if (t) {
        wsState.ticks++;
        Diag.ws.ticks++;
        feedTick(t);
      } else {
        wsState.unknown++;
        Diag.ws.unknown++;
      }
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
  // 2. DOM PRICE READER — Current pair only, with sanity
  // ============================================================
  function getActivePair() {
    // Try to find currently selected pair name in Quotex UI
    const sels = [
      '#mobile-asset-btn', '[class*="asset-name"]', '[class*="current-symbol"]',
      '[class*="asset__name"]', '[class*="instrument-name"]',
      '[class*="asset-select"] [class*="value"]'
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) {
        const t = (el.textContent || '').trim();
        const m = t.match(/([A-Z]{3}[\/\-]?[A-Z]{3}[^\s]*)/i);
        if (m) return m[1].trim();
      }
    }
    // Fallback
    const price = document.querySelector('[class*="current-price"], .price');
    if (price) {
      const label = price.closest('[class*="asset"], [class*="instrument"], [class*="pair"]');
      if (label) {
        const m = (label.textContent || '').match(/([A-Z]{3}[\/\-]?[A-Z]{3})/i);
        if (m) return m[1];
      }
    }
    return null;
  }

  function getActivePayout() {
    // Look for the % badge near the current pair
    const sels = ['[class*="payout"]', '[class*="percent"]', '.payout-value'];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) {
        const m = (el.textContent || '').match(/(\d{1,3})%/);
        if (m) return parseInt(m[1]);
      }
    }
    return 0;
  }

  function readDOMPrice() {
    // Specific selectors first
    const sels = [
      '[class*="current-price"]', '[class*="price-value"]', '[class*="value__val"]',
      '[class*="deal-finish"]', '[class*="quote-price"]', '[class*="asset-price"]',
      '[class*="current-quote"]', '.live-price', '[class*="chart-price"]',
      '[class*="instrument-price"]'
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
            return v;
          }
        }
      }
    }

    // Brute force (last 500 elements)
    const all = document.querySelectorAll('div, span, td, p');
    for (let i = Math.max(0, all.length - 500); i < all.length; i++) {
      const el = all[i];
      if (el.children.length > 1) continue;
      const t = (el.textContent || '').trim();
      // Must be 1.xxxxx or 0.xxxxx or 100.xxx style (forex/metals pattern)
      if (/^\d{1,6}\.\d{3,6}$/.test(t)) {
        const v = +t;
        // Sanity: forex prices typically 0.1 - 200
        if (v > 0.01 && v < 10000) {
          Diag.dom.reads++;
          return v;
        }
      }
    }

    Diag.dom.fails++;
    return null;
  }

  // ============================================================
  // 3. PRICE POLLING — Per current pair
  // ============================================================
  let currentPair = null;

  setInterval(() => {
    const pair = getActivePair();
    if (pair && pair !== currentPair) {
      Diag.log(`Pair changed: ${currentPair} → ${pair}`, 'info');
      currentPair = pair;
      const a = getAsset(pair);
      a.payout = getActivePayout();
      // DO NOT clear old pair data — it stays per-pair
    }

    if (!currentPair) return;

    const price = readDOMPrice();
    if (price) {
      const a = getAsset(currentPair);
      // Sanity: reject price if it deviates > 20% from last known (prevents garbage)
      if (a.lastPrice > 0) {
        const deviation = Math.abs(price - a.lastPrice) / a.lastPrice;
        if (deviation > 0.2) {
          Diag.dom.rejected++;
          return;
        }
      }
      a.lastPrice = price;
      a.lastTime = Date.now();

      const bucket = Math.floor(Date.now() / 60000) * 60000;
      let cur = a.current;
      if (!cur || cur.time !== bucket) {
        if (cur) {
          a.candles.push(cur);
          if (a.candles.length > 300) a.candles.shift();
        }
        cur = { time: bucket, open: price, high: price, low: price, close: price };
        a.current = cur;
      } else {
        cur.high = Math.max(cur.high, price);
        cur.low = Math.min(cur.low, price);
        cur.close = price;
      }
    }
  }, 1000);

  // ============================================================
  // 4. INDICATORS
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
  // 5. PATTERN + SIGNAL
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

  function getCandlesFor(pair) {
    const a = getAsset(pair);
    let arr = a.candles.slice(-50);
    // Ensure each has computed props
    arr = arr.map(c => ({
      ...c,
      isGreen: c.close >= c.open,
      body: Math.abs(c.close - c.open),
      total: Math.max(c.high - c.low, 1e-5),
      upperWick: c.high - Math.max(c.open, c.close),
      lowerWick: Math.min(c.open, c.close) - c.low
    }));
    return arr;
  }

  function analyze(pair) {
    const candles = getCandlesFor(pair);
    if (candles.length < 3) return null;

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

    if (call === 0 && put === 0) return null;
    if (call === put) return null;

    const total = call + put;
    const winner = call > put ? 'CALL' : 'PUT';
    const conf = Math.round(Math.max(call, put) / total * 100);

    return {
      pair,
      dir: winner,
      conf,
      pattern: sigs[0]?.name || 'COMPOSITE',
      signals: sigs.filter(s => s.dir === winner).slice(0, 3),
      candleCount: candles.length
    };
  }

  // ============================================================
  // 6. MARKET SCANNER — সব pair check করে best বেছে নেয়
  // ============================================================
  function scanAllPairs() {
    const pairs = Object.keys(Assets);
    const results = [];

    for (const pair of pairs) {
      const a = Assets[pair];
      // Skip if payout too low or no recent data
      if (a.payout < CFG.minPayout) continue;
      if (Date.now() - a.lastTime > CFG.priceMaxAge) continue;
      if (a.candles.length < 3) continue;

      const sig = analyze(pair);
      if (sig && sig.conf >= CFG.minConf) {
        results.push(sig);
      }
    }

    // Sort: high confidence + high payout first
    results.sort((a, b) => {
      const scoreA = a.conf + Assets[a.pair].payout * 0.3;
      const scoreB = b.conf + Assets[b.pair].payout * 0.3;
      return scoreB - scoreA;
    });

    return results;
  }

  // ============================================================
  // 7. UI
  // ============================================================
  const st = document.createElement('style');
  st.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
    #zyro-algo-container{position:fixed;top:50px;right:10px;width:270px;
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
    .btn-scan{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff}
    .btn-mini{padding:4px;font-size:8px;background:rgba(0,242,254,0.15);color:#00f2fe;border:1px solid rgba(0,242,254,0.3)}
    .scan-list{max-height:120px;overflow-y:auto;background:rgba(0,0,0,0.4);border-radius:6px;padding:4px;margin-bottom:6px;font-size:8px}
    .scan-item{display:flex;justify-content:space-between;padding:3px 4px;border-bottom:1px solid rgba(255,255,255,0.05);color:#94a3b8}
    .scan-item.top{background:rgba(0,230,118,0.15);color:#6ee7b7;font-weight:900}
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

  const c = document.createElement('div');
  c.id = 'zyro-algo-container';
  c.innerHTML = `
    <div class="zh" id="drag">
      <div class="zb">⚡ <span>ZYRO</span> v${VERSION}</div>
      <div class="zc"><span id="snd">🔊</span><span id="mn">—</span><span id="cl">✕</span></div>
    </div>
    <div class="zb2">
      <div class="pill">
        <span id="asset">SCANNING</span>
        <span style="display:flex;gap:4px;align-items:center;">
          <span class="badge bad" id="badge">--</span>
          <span id="payout" style="color:#00e676">--%</span>
        </span>
      </div>
      <div class="card">
        <div class="conf-lbl" id="confl">WAITING</div>
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
        <div class="stat"><span>Pairs:</span><b id="pairs" style="color:#38bdf8">0</b></div>
      </div>
      <div class="scan-list" id="scanList"></div>
      <button class="btn btn-go" id="start">▶ START AUTO SCAN</button>
      <button class="btn btn-scan" id="scanBtn">🔍 SCAN NOW</button>
      <button class="btn btn-mini" id="statsBtn">📊 STATS</button>
      <button class="btn btn-mini" id="diagBtn">🔧 DIAG</button>
    </div>
    <div class="mi">ZY</div>
  `;
  document.body.appendChild(c);

  const $ = id => document.getElementById(id);
  const assetEl = $('asset'), badgeEl = $('badge'), payoutEl = $('payout');
  const conflEl = $('confl'), dirEl = $('dir'), sigEl = $('sig'), cfillEl = $('cfill');
  const accEl = $('acc'), clkEl = $('clk'), wlEl = $('wl'), mtgEl = $('mtg'), pnlEl = $('pnl'), pairsEl = $('pairs');
  const startBtn = $('start'), scanListEl = $('scanList');

  // Drag
  let dragging = false, cx, cy, ix, iy, ox = 0, oy = 0;
  $('drag').addEventListener('mousedown', e => {
    if (e.target.tagName === 'SPAN') return;
    dragging = true; ix = e.clientX - ox; iy = e.clientY - oy; e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    cx = e.clientX - ix; cy = e.clientY - iy; ox = cx; oy = cy;
    c.style.transform = `translate3d(${cx}px,${cy}px,0)`;
  });
  document.addEventListener('mouseup', () => dragging = false);
  c.addEventListener('touchstart', e => {
    if (!['INPUT','BUTTON','SELECT'].includes(e.target.tagName)) {
      ix = e.touches[0].clientX - ox; iy = e.touches[0].clientY - oy; dragging = true;
    }
  }, { passive: true });
  c.addEventListener('touchmove', e => {
    if (dragging) {
      cx = e.touches[0].clientX - ix; cy = e.touches[0].clientY - iy; ox = cx; oy = cy;
      c.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    }
  }, { passive: true });
  c.addEventListener('touchend', () => dragging = false);
  $('mn').onclick = e => { e.stopPropagation(); c.classList.add('min'); };
  c.onclick = () => { if (c.classList.contains('min')) c.classList.remove('min'); };
  $('cl').onclick = e => { e.stopPropagation(); c.remove(); popup.remove(); };
  $('snd').onclick = e => { e.stopPropagation(); soundOn = !soundOn; $('snd').innerText = soundOn ? '🔊' : '🔇'; };

  // ============================================================
  // 8. AUDIO
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

  // ============================================================
  // 9. TRADE EXECUTION
  // ============================================================
  let isRunning = false;
  let baseAmt = 1, curAmt = 1, step = 0;
  let wins = 0, losses = 0, pnl = 0;
  let isWaiting = false, lastMinute = -1, lastDir = null;

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

  async function waitForTradeResult() {
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
      ? `🎉 WIN!<br><span style="font-size:9px">${txt}</span>`
      : `⚠️ LOSS<br><span style="font-size:9px">${txt}</span>`;
    win ? soundWin() : soundLoss();
    setTimeout(() => { popup.className = popup.className.replace(' show', ''); }, 2400);
  }

  async function doTrade(pair, dir, pattern) {
    const { up, dn } = getButtons();
    if (!up && !dn) { Diag.log('Buttons not found', 'error'); return; }

    setAmount(curAmt);
    const a = getAsset(pair);
    const entry = a.lastPrice;
    lastDir = dir;
    isWaiting = true;

    if (dir === 'CALL' && up) { up.click(); soundTrade(); }
    else if (dir === 'PUT' && dn) { dn.click(); soundTrade(); }
    else { isWaiting = false; return; }

    const result = await waitForTradeResult();
    const exit = getAsset(pair).lastPrice;
    const payout = getAsset(pair).payout || 85;
    const gain = curAmt * (payout / 100);

    if (result === 'WIN') {
      wins++; pnl += gain; step = 0; curAmt = baseAmt;
      popupShow(true, `${pair}: ${entry} → ${exit}`);
    } else if (result === 'LOSS') {
      losses++; pnl -= curAmt; step++;
      if (step <= CFG.maxMtgSteps) curAmt = +(curAmt * CFG.mtgMult).toFixed(2);
      else { step = 0; curAmt = baseAmt; }
      popupShow(false, `${pair}: ${entry} → ${exit}`);
    }
    updateUI();
    isWaiting = false;
  }

  function updateUI() {
    const t = wins + losses;
    accEl.innerText = t ? ((wins / t) * 100).toFixed(0) + '%' : '--';
    wlEl.innerText = `${wins}/${losses}`;
    mtgEl.innerText = step;
    pnlEl.innerText = `$${pnl.toFixed(2)}`;
    pnlEl.style.color = pnl >= 0 ? '#00e676' : '#ef4444';
    pairsEl.innerText = Object.keys(Assets).length;
  }

  function renderScanList(results) {
    if (!results.length) {
      scanListEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:6px;">No qualifying pairs yet</div>';
      return;
    }
    scanListEl.innerHTML = results.slice(0, 6).map((r, i) => {
      const payout = Assets[r.pair].payout;
      return `<div class="scan-item ${i === 0 ? 'top' : ''}">
        <span>${r.pair}</span>
        <span>${r.dir === 'CALL' ? '▲' : '▼'} ${r.conf}% • ${payout}%</span>
      </div>`;
    }).join('');
  }

  $('scanBtn').onclick = () => {
    const results = scanAllPairs();
    renderScanList(results);
    if (!results.length) alert('No qualifying pairs.\n\nNeed: payout ≥ ' + CFG.minPayout + '%, conf ≥ ' + CFG.minConf + '%, recent data.\n\nWait 1-2 minutes for data collection.');
  };

  $('statsBtn').onclick = () => {
    alert(`📊 STATS\n\nTotal: ${wins + losses}\nWins: ${wins}\nLosses: ${losses}\nWR: ${wins+losses ? ((wins/(wins+losses))*100).toFixed(1) : 0}%\nP/L: $${pnl.toFixed(2)}\n\nPairs tracked: ${Object.keys(Assets).length}`);
  };

  $('diagBtn').onclick = () => {
    const pairs = Object.keys(Assets).map(p => {
      const a = Assets[p];
      return `  ${p}: ${a.candles.length} candles, payout ${a.payout}%, price ${a.lastPrice}`;
    }).join('\n');
    alert(`🔧 DIAGNOSTICS\n\nWS:\n  Connected: ${Diag.ws.connected}\n  Messages: ${Diag.ws.messages}\n  Ticks: ${Diag.ws.ticks}\n  Unknown: ${Diag.ws.unknown}\n\nDOM:\n  Reads OK: ${Diag.dom.reads}\n  Reads Fail: ${Diag.dom.fails}\n  Rejected: ${Diag.dom.rejected}\n\nCurrent Pair: ${currentPair}\n\nTracked Pairs:\n${pairs || '  (none)'}`);
  };

  startBtn.onclick = () => {
    isRunning = !isRunning;
    if (isRunning) {
      baseAmt = CFG.baseAmount;
      curAmt = baseAmt;
      step = 0;
      startBtn.className = 'btn btn-stop';
      startBtn.innerText = '⏸ STOP AUTO';
    } else {
      startBtn.className = 'btn btn-go';
      startBtn.innerText = '▶ START AUTO SCAN';
      dirEl.innerText = 'PAUSED';
    }
  };

  // ============================================================
  // 10. MAIN LOOP — Auto scan + auto trade
  // ============================================================
  setInterval(() => {
    // Badge
    const pair = getActivePair();
    if (pair) {
      const a = getAsset(pair);
      if (a.lastPrice > 0 && Date.now() - a.lastTime < CFG.priceMaxAge) {
        badgeEl.className = 'badge ok';
        badgeEl.innerText = 'LIVE';
      } else {
        badgeEl.className = 'badge warn';
        badgeEl.innerText = 'STALE';
      }
      assetEl.innerText = pair;
      payoutEl.innerText = (a.payout || getActivePayout()) + '%';
    } else {
      badgeEl.className = 'badge bad';
      badgeEl.innerText = 'NO';
    }

    // Clock
    const d = new Date();
    const m = d.getMinutes(), s = d.getSeconds();
    clkEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Scan list refresh every 5 seconds
    if (s % 5 === 0) {
      const results = scanAllPairs();
      renderScanList(results);
    }

    if (!isRunning || isWaiting) return;

    // Top signal for the current preview
    const results = scanAllPairs();
    const best = results[0];
    if (best) {
      conflEl.innerText = `[${best.pattern}] ${best.conf}%`;
      dirEl.innerText = best.dir === 'CALL' ? `▲ ${best.dir}` : `▼ ${best.dir}`;
      dirEl.style.color = best.dir === 'CALL' ? '#00e676' : '#ef4444';
      cfillEl.style.width = best.conf + '%';
      sigEl.innerText = `${best.pair} • ` + best.signals.map(x => x.name).join(' • ');
    } else {
      conflEl.innerText = 'SCANNING...';
      dirEl.innerText = '--';
      sigEl.innerText = 'Waiting for quality signal';
    }

    // Execute at :58 every minute
    if (s === 58 && lastMinute !== m && best) {
      lastMinute = m;

      let pair = best.pair, dir = best.dir, pat = best.pattern;

      // If in recovery, stick to same direction on best-available pair
      if (step > 0 && lastDir) {
        dir = lastDir;
        pat = `MTG ${step}`;
      }

      // If we're not on the best pair, switch
      if (CFG.autoSwitch && pair !== currentPair) {
        Diag.log(`Auto-switching to best pair: ${currentPair} → ${pair}`, 'info');
        // Try to click the pair in Quotex UI
        const pairEls = document.querySelectorAll('[class*="asset"] [class*="item"], [class*="asset-list"] [class*="row"], [class*="asset__item"]');
        for (const el of pairEls) {
          if ((el.textContent || '').includes(pair.split(' ')[0])) {
            el.click();
            break;
          }
        }
        // Give time for switch
        setTimeout(() => doTrade(pair, dir, pat), 1500);
      } else {
        doTrade(pair, dir, pat);
      }
    }
  }, 1000);

  // Track all visible pairs' payout from the asset list
  setInterval(() => {
    // Look for any pair names + payout % in the sidebar/list
    const items = document.querySelectorAll('[class*="asset"] [class*="item"], [class*="asset-list"] [class*="row"], [class*="asset__item"], [class*="market-item"]');
    items.forEach(item => {
      const txt = item.textContent || '';
      const pairMatch = txt.match(/([A-Z]{3}[\/\-]?[A-Z]{3}[^\d\s%]*)/);
      const payoutMatch = txt.match(/(\d{1,3})%/);
      if (pairMatch && payoutMatch) {
        const p = pairMatch[1].trim();
        const a = getAsset(p);
        a.payout = parseInt(payoutMatch[1]);
      }
    });
  }, 5000);

  // INIT
  updateUI();
  console.log('%c⚡ ZYRO v' + VERSION + ' READY', 'color:#00f2fe;font-size:14px;font-weight:bold');
  console.log('Commands: ZYRO.scan() | ZYRO.pairs() | ZYRO.diag()');

  window.ZYRO = {
    scan: () => scanAllPairs(),
    pairs: () => Object.keys(Assets),
    pairData: (p) => Assets[p],
    diag: () => ({ ws: Diag.ws, dom: Diag.dom, pairs: Object.keys(Assets), currentPair }),
    start: () => { if (!isRunning) startBtn.click(); },
    stop: () => { if (isRunning) startBtn.click(); }
  };

})();
