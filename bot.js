// ============================================================
// ZYRO HUMAN AI PRO v2.0 — Full Power Upgrade
// WebSocket + Indicators + Confluence + Risk Manager + Real Result
// ============================================================

(function () {
  'use strict';

  if (document.getElementById('zyro-algo-container')) {
    alert('⚡ ZYRO HUMAN AI PRO v2.0 is already active!');
    return;
  }

  // ============================================================
  // SECTION 1: WEBSOCKET INTERCEPTOR
  // ============================================================
  const WS_CONFIG = {
    targetEndpoints: [],   // sniff করে endpoint দাও (optional)
    debug: false,
    maxTickBuffer: 5000,
    candleTimeframeSec: 60
  };

  const wsState = {
    ws: [],
    ticks: [],
    candles: {},
    currentCandle: {},
    lastPrice: {},
    lastTick: null,
    connected: false,
    stats: { messagesReceived: 0, ticksExtracted: 0, candlesBuilt: 0, errors: 0 }
  };

  function wsLog(...args) { if (WS_CONFIG.debug) console.log('[ZYRO-WS]', ...args); }

  function shouldIntercept(url) {
    if (!WS_CONFIG.targetEndpoints.length) return true;
    return WS_CONFIG.targetEndpoints.some(ep => url.includes(ep));
  }

  function extractTick(rawData) {
    // Format 1: JSON
    try {
      const obj = JSON.parse(rawData);
      if (obj.type === 'tick' && obj.price && obj.asset) {
        return { asset: obj.asset, price: parseFloat(obj.price), time: obj.timestamp || obj.time || Date.now() };
      }
      if (obj.msg?.type === 'tick' && obj.msg?.price) {
        return { asset: obj.msg.asset || obj.msg.symbol, price: parseFloat(obj.msg.price), time: obj.msg.time || Date.now() };
      }
      // Quotex short format
      if (obj.t === 'q' && obj.p && obj.s) {
        return { asset: obj.s, price: parseFloat(obj.p), time: obj.ts || Date.now() };
      }
    } catch (e) {}

    // Format 2: socket.io
    if (typeof rawData === 'string' && rawData.startsWith('42')) {
      try {
        const arr = JSON.parse(rawData.slice(2));
        if (Array.isArray(arr) && arr[0] === 'tick' && arr[1]) {
          const d = arr[1];
          return { asset: d.asset || d.symbol, price: parseFloat(d.price || d.value), time: d.time || d.timestamp || Date.now() };
        }
        if (Array.isArray(arr) && arr[0] === 'quotes' && Array.isArray(arr[1])) {
          return arr[1].map(q => ({
            asset: q.asset || q.symbol,
            price: parseFloat(q.price || q.value),
            time: q.time || Date.now()
          }));
        }
      } catch (e) {}
    }
    return null;
  }

  function feedTick(tick) {
    if (!tick || !tick.asset || !tick.price || isNaN(tick.price)) return;
    const { asset, price, time } = tick;

    wsState.lastPrice[asset] = price;
    wsState.lastTick = tick;
    wsState.stats.ticksExtracted++;

    wsState.ticks.push(tick);
    if (wsState.ticks.length > WS_CONFIG.maxTickBuffer) wsState.ticks.shift();

    const bucketMs = WS_CONFIG.candleTimeframeSec * 1000;
    const bucket = Math.floor(time / bucketMs) * bucketMs;
    let cur = wsState.currentCandle[asset];

    if (!cur || cur.time !== bucket) {
      if (cur) {
        if (!wsState.candles[asset]) wsState.candles[asset] = [];
        wsState.candles[asset].push(cur);
        if (wsState.candles[asset].length > 500) wsState.candles[asset].shift();
        wsState.stats.candlesBuilt++;
        window.dispatchEvent(new CustomEvent('zyro:candle', { detail: { asset, candle: cur } }));
      }
      cur = { time: bucket, open: price, high: price, low: price, close: price, ticks: 1 };
      wsState.currentCandle[asset] = cur;
    } else {
      cur.high = Math.max(cur.high, price);
      cur.low = Math.min(cur.low, price);
      cur.close = price;
      cur.ticks++;
    }

    window.dispatchEvent(new CustomEvent('zyro:tick', { detail: tick }));
  }

  const OriginalWebSocket = window.WebSocket;
  function ZyroWebSocket(url, protocols) {
    wsLog('WS created:', url);
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    ws._zyroUrl = url;

    if (shouldIntercept(url)) {
      wsState.connected = true;
      ws.addEventListener('message', function (event) {
        try {
          wsState.stats.messagesReceived++;
          const raw = event.data;
          if (typeof raw !== 'string') return;
          const tick = extractTick(raw);
          if (!tick) return;
          if (Array.isArray(tick)) tick.forEach(feedTick);
          else feedTick(tick);
        } catch (err) {
          wsState.stats.errors++;
        }
      });
      ws.addEventListener('close', () => wsLog('WS closed:', url));
      ws.addEventListener('error', (e) => wsLog('WS error:', e));
    }
    wsState.ws.push(ws);
    return ws;
  }
  ZyroWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  ZyroWebSocket.OPEN = OriginalWebSocket.OPEN;
  ZyroWebSocket.CLOSING = OriginalWebSocket.CLOSING;
  ZyroWebSocket.CLOSED = OriginalWebSocket.CLOSED;
  ZyroWebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket = ZyroWebSocket;

  window.ZYRO_WS = {
    getPrice(asset) { return asset ? wsState.lastPrice[asset] : wsState.lastTick?.price; },
    getCurrentCandle(asset) { return wsState.currentCandle[asset]; },
    getCandles(asset) { return wsState.candles[asset] || []; },
    getLastCandles(asset, n = 20) { return (wsState.candles[asset] || []).slice(-n); },
    getTicks(n = 100) { return wsState.ticks.slice(-n); },
    getAssets() { return Object.keys(wsState.lastPrice); },
    getStats() { return { ...wsState.stats, connected: wsState.connected }; },
    dump() {
      console.table({
        Messages: wsState.stats.messagesReceived,
        Ticks: wsState.stats.ticksExtracted,
        Candles: wsState.stats.candlesBuilt,
        Errors: wsState.stats.errors,
        Assets: Object.keys(wsState.lastPrice).length
      });
    },
    reset() {
      wsState.ticks = [];
      wsState.candles = {};
      wsState.currentCandle = {};
      wsState.lastPrice = {};
    }
  };

  // ============================================================
  // SECTION 2: TECHNICAL INDICATORS
  // ============================================================
  const Indicators = {
    ema(data, period) {
      if (!data.length) return [];
      const k = 2 / (period + 1);
      const out = [data[0]];
      for (let i = 1; i < data.length; i++) out.push(data[i] * k + out[i - 1] * (1 - k));
      return out;
    },
    sma(data, period) {
      const out = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { out.push(null); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j];
        out.push(sum / period);
      }
      return out;
    },
    rsi(closes, period = 14) {
      if (closes.length < period + 1) return 50;
      let gains = 0, losses = 0;
      for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
      }
      let avgGain = gains / period;
      let avgLoss = losses / period;
      for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
      }
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    },
    macd(closes, fast = 12, slow = 26, signal = 9) {
      if (closes.length < slow) return { macd: 0, signal: 0, histogram: 0 };
      const emaFast = Indicators.ema(closes, fast);
      const emaSlow = Indicators.ema(closes, slow);
      const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
      const signalLine = Indicators.ema(macdLine.slice(slow - 1), signal);
      const macd = macdLine[macdLine.length - 1];
      const sig = signalLine[signalLine.length - 1];
      return { macd, signal: sig, histogram: macd - sig };
    },
    atr(candles, period = 14) {
      if (candles.length < period + 1) return 0;
      const trs = [];
      for (let i = 1; i < candles.length; i++) {
        const c = candles[i], p = candles[i - 1];
        trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
      }
      return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
    },
    bollinger(closes, period = 20, mult = 2) {
      if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
      const slice = closes.slice(-period);
      const sma = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
      const std = Math.sqrt(variance);
      return { upper: sma + mult * std, middle: sma, lower: sma - mult * std };
    }
  };

  // ============================================================
  // SECTION 3: AUDIO + VOICE
  // ============================================================
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playSoundFX(type) {
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.32);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
        osc.start(); osc.stop(audioCtx.currentTime + 0.45);
      } else if (type === 'loss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(160, audioCtx.currentTime + 0.38);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.38);
        osc.start(); osc.stop(audioCtx.currentTime + 0.38);
      } else if (type === 'sniper') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
      }
    } catch (e) {}
  }

  let soundEnabled = true;
  function speakVoice(text) {
    if (!soundEnabled) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.05; utter.pitch = 1.1;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  }

  // ============================================================
  // SECTION 4: TRADE LOG (localStorage persistence)
  // ============================================================
  const TradeLog = {
    trades: [],
    load() {
      try { this.trades = JSON.parse(localStorage.getItem('zyro_trades') || '[]'); } catch (e) { this.trades = []; }
    },
    add(t) {
      this.trades.push({ ...t, ts: Date.now() });
      if (this.trades.length > 1000) this.trades.shift();
      try { localStorage.setItem('zyro_trades', JSON.stringify(this.trades)); } catch (e) {}
    },
    stats() {
      const total = this.trades.length;
      const wins = this.trades.filter(t => t.result === 'WIN').length;
      const losses = total - wins;
      const winRate = total ? ((wins / total) * 100).toFixed(1) : '0.0';
      const profit = this.trades.reduce((a, t) => a + (t.profit || 0), 0);
      const avgWin = wins ? this.trades.filter(t => t.result === 'WIN').reduce((a, t) => a + t.profit, 0) / wins : 0;
      const avgLoss = losses ? this.trades.filter(t => t.result === 'LOSS').reduce((a, t) => a + t.profit, 0) / losses : 0;
      return { total, wins, losses, winRate, profit, avgWin, avgLoss };
    },
    exportCSV() {
      const headers = 'time,asset,direction,amount,entry,exit,result,profit\n';
      const rows = this.trades.map(t =>
        `${new Date(t.ts).toISOString()},${t.asset || ''},${t.direction},${t.amount},${t.entry || ''},${t.exit || ''},${t.result || ''},${t.profit || 0}`
      ).join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `zyro_trades_${Date.now()}.csv`;
      a.click();
    },
    clear() {
      this.trades = [];
      localStorage.removeItem('zyro_trades');
    }
  };
  TradeLog.load();

  // ============================================================
  // SECTION 5: SETTINGS PERSISTENCE
  // ============================================================
  const Settings = {
    defaults: {
      amount: 1, mtgMult: 2.2, sl: 15, tp: 30,
      maxSteps: 2, minConfidence: 75, minPayout: 80,
      tgToken: '', tgChat: ''
    },
    load() {
      try { return { ...this.defaults, ...JSON.parse(localStorage.getItem('zyro_settings') || '{}') }; }
      catch (e) { return { ...this.defaults }; }
    },
    save(s) {
      try { localStorage.setItem('zyro_settings', JSON.stringify(s)); } catch (e) {}
    }
  };
  const savedSettings = Settings.load();

  // ============================================================
  // SECTION 6: TELEGRAM ALERTS
  // ============================================================
  async function sendTelegram(msg) {
    const token = localStorage.getItem('zyro_tg_token') || '';
    const chat = localStorage.getItem('zyro_tg_chat') || '';
    if (!token || !chat) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'HTML' })
      });
    } catch (e) {}
  }

  // ============================================================
  // SECTION 7: UI STYLING
  // ============================================================
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');

    #zyro-algo-container {
      position: fixed; top: 50px; right: 10px; width: 265px;
      background: radial-gradient(circle at top, rgba(15,23,42,0.98) 0%, rgba(3,7,18,0.99) 100%);
      backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
      border: 1.5px solid #00f2fe; border-radius: 16px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.9), 0 0 25px rgba(0,242,254,0.35);
      color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
      z-index: 99999999; padding: 10px; user-select: none; touch-action: none;
      transition: transform 0.15s ease-out;
    }
    #zyro-algo-container.zyro-minimized {
      width: 54px !important; height: 54px !important; border-radius: 50% !important;
      padding: 0 !important; background: linear-gradient(135deg, #0f172a, #0284c7) !important;
      border: 2px solid #00f2fe !important; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 20px #00f2fe; animation: zyroPulse 2s infinite ease-in-out;
    }
    @keyframes zyroPulse {
      0% { transform: scale(1); box-shadow: 0 0 10px rgba(0,242,254,0.4); }
      50% { transform: scale(1.06); box-shadow: 0 0 25px rgba(0,242,254,0.9); }
      100% { transform: scale(1); box-shadow: 0 0 10px rgba(0,242,254,0.4); }
    }
    .zyro-header { display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(0,242,254,0.2); padding-bottom: 5px; margin-bottom: 6px; cursor: grab; }
    .zyro-brand { display: flex; align-items: center; gap: 5px; font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 900; color: #fff; }
    .zyro-brand span { color: #00f2fe; text-shadow: 0 0 10px rgba(0,242,254,0.8); }
    .zyro-ctrls { display: flex; gap: 8px; font-size: 13px; font-weight: bold; color: #64748b; cursor: pointer; }
    .zyro-ctrls span:hover { color: #00f2fe; }
    .zyro-min-icon { display: none; font-family: 'Orbitron', monospace; font-size: 12px; font-weight: 900; color: #00f2fe; }
    #zyro-algo-container.zyro-minimized .zyro-min-icon { display: block !important; }
    #zyro-algo-container.zyro-minimized .zyro-body, #zyro-algo-container.zyro-minimized .zyro-header { display: none !important; }

    .zyro-asset-pill { background: rgba(0,242,254,0.12); border: 1px solid #00f2fe; border-radius: 6px;
      padding: 4px 6px; font-size: 10px; font-family: 'Orbitron', monospace; font-weight: 800;
      color: #00f2fe; text-align: center; margin-bottom: 6px; letter-spacing: 0.5px;
      display: flex; justify-content: space-between; align-items: center; }
    .zyro-ws-badge { font-size: 8px; padding: 1px 4px; border-radius: 4px; }
    .zyro-ws-on { background: #065f46; color: #6ee7b7; }
    .zyro-ws-off { background: #7f1d1d; color: #fca5a5; }

    .zyro-mode-tabs { display: flex; background: rgba(0,0,0,0.6); border: 1px solid rgba(0,242,254,0.2); border-radius: 6px; padding: 2px; margin-bottom: 6px; }
    .zyro-mode-tab { flex: 1; text-align: center; font-size: 8px; font-family: 'Orbitron', monospace; font-weight: 800; padding: 4px 0; color: #64748b; cursor: pointer; border-radius: 4px; }
    .zyro-mode-tab.active { background: linear-gradient(135deg, #0284c7, #00f2fe); color: #fff; }

    .zyro-signal-card { text-align: center; font-family: 'Orbitron', monospace; padding: 6px 4px;
      border-radius: 8px; background: rgba(0,242,254,0.05); border: 1px dashed rgba(0,242,254,0.4);
      margin-bottom: 6px; min-height: 52px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .zyro-confluence { font-size: 8px; color: #94a3b8; font-weight: 700; margin-bottom: 2px; }
    .zyro-direction { font-size: 11px; font-weight: 900; letter-spacing: 0.5px; }
    .zyro-conf-bar { width: 90%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 4px; overflow: hidden; }
    .zyro-conf-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b, #00e676); transition: width 0.3s; }

    .zyro-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 5px; margin-bottom: 6px; font-size: 9px; }
    .zyro-stat-item { display: flex; justify-content: space-between; color: #94a3b8; }
    .zyro-stat-item b { color: #e2e8f0; font-family: 'Orbitron', monospace; }

    .zyro-inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }
    .zyro-input-wrap label { font-size: 7.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 1px; }
    .zyro-input-wrap input { width: 100%; background: #0f172a; border: 1px solid #1e293b; color: #00f2fe;
      border-radius: 6px; padding: 3px; font-size: 9.5px; font-family: 'Orbitron', monospace; text-align: center; box-sizing: border-box; }

    .zyro-btn { width: 100%; padding: 7px; border-radius: 8px; border: none; font-family: 'Orbitron', monospace;
      font-weight: 900; font-size: 10px; cursor: pointer; text-transform: uppercase; transition: 0.2s; }
    .zyro-btn-start { background: linear-gradient(135deg, #00f2fe, #0284c7); color: #fff; box-shadow: 0 0 15px rgba(0,242,254,0.4); margin-bottom: 4px; }
    .zyro-btn-stop { background: linear-gradient(135deg, #ef4444, #991b1b); color: #fff; box-shadow: 0 0 15px rgba(239,68,68,0.4); margin-bottom: 4px; }
    .zyro-btn-instant { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff;
      box-shadow: 0 0 15px rgba(245,158,11,0.5); border: 1px solid #fde047; }
    .zyro-btn-mini { padding: 4px; font-size: 8px; margin-top: 4px; background: rgba(0,242,254,0.15); color: #00f2fe; border: 1px solid rgba(0,242,254,0.3); }
    .zyro-btn-mini:hover { background: rgba(0,242,254,0.3); }

    #zyro-popup { position: fixed; top: 40%; left: 50%; transform: translate(-50%,-50%) scale(0.3);
      padding: 16px 24px; border-radius: 14px; z-index: 2147483647; font-family: 'Orbitron', monospace;
      font-size: 12.5px; font-weight: 900; color: #fff; text-align: center; opacity: 0; pointer-events: none;
      transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    #zyro-popup.show { opacity: 1; transform: translate(-50%,-50%) scale(1); }
    .zyro-win-pop { background: linear-gradient(135deg, #059669, #047857); border: 2px solid #00e676; box-shadow: 0 0 35px rgba(0,230,118,0.8); }
    .zyro-loss-pop { background: linear-gradient(135deg, #dc2626, #7f1d1d); border: 2px solid #f87171; box-shadow: 0 0 35px rgba(239,68,68,0.8); }
  `;
  document.head.appendChild(style);

  const popup = document.createElement('div');
  popup.id = 'zyro-popup';
  document.body.appendChild(popup);

  // ============================================================
  // SECTION 8: UI HTML
  // ============================================================
  const container = document.createElement('div');
  container.id = 'zyro-algo-container';
  container.innerHTML = `
    <div class="zyro-header" id="zyroDrag">
      <div class="zyro-brand">⚡ <span>ZYRO</span> AI PRO v2</div>
      <div class="zyro-ctrls">
        <span id="zyroSoundBtn" title="Toggle Sound">🔊</span>
        <span id="zyroMinBtn">—</span>
        <span id="zyroCloseBtn">✕</span>
      </div>
    </div>
    <div class="zyro-body">
      <div class="zyro-asset-pill">
        <span id="zyroAsset">SCANNING...</span>
        <span style="display:flex; gap:4px; align-items:center;">
          <span class="zyro-ws-badge zyro-ws-off" id="zyroWsBadge">WS</span>
          <span id="zyroAssetPayout" style="color:#00e676;">85%</span>
        </span>
      </div>

      <div class="zyro-mode-tabs">
        <div class="zyro-mode-tab active" id="tabAuto">AUTO</div>
        <div class="zyro-mode-tab" id="tabInstant">INSTANT</div>
        <div class="zyro-mode-tab" id="tabManual">SIGNAL</div>
      </div>

      <div class="zyro-signal-card" id="zyroSignalCard">
        <div class="zyro-confluence" id="zyroConfluence">ANALYZING MARKET</div>
        <div class="zyro-direction" id="zyroDir" style="color:#00f2fe;">READING</div>
        <div class="zyro-conf-bar"><div class="zyro-conf-fill" id="zyroConfFill" style="width:0%"></div></div>
      </div>

      <div class="zyro-stats-grid">
        <div class="zyro-stat-item"><span>Win Rate:</span><b id="zyroAcc" style="color:#00e676;">100%</b></div>
        <div class="zyro-stat-item"><span>Timer:</span><b id="zyroClock">00:00</b></div>
        <div class="zyro-stat-item"><span>W / L:</span><b id="zyroWL">0 / 0</b></div>
        <div class="zyro-stat-item"><span>MTG:</span><b id="zyroMTG" style="color:#f59e0b;">Step 0</b></div>
        <div class="zyro-stat-item"><span>Profit:</span><b id="zyroNetProfit" style="color:#00e676;">$0.00</b></div>
        <div class="zyro-stat-item"><span>RSI:</span><b id="zyroRSI" style="color:#38bdf8;">--</b></div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap"><label>AMOUNT ($)</label><input type="number" id="zyroAmt" value="1"></div>
        <div class="zyro-input-wrap"><label>MTG MULT (X)</label><input type="number" id="zyroMtgMult" value="2.2" step="0.1"></div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap"><label>STOP LOSS ($)</label><input type="number" id="zyroSL" value="15"></div>
        <div class="zyro-input-wrap"><label>TAKE PROFIT ($)</label><input type="number" id="zyroTP" value="30"></div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap"><label>MIN CONF %</label><input type="number" id="zyroMinConf" value="75"></div>
        <div class="zyro-input-wrap"><label>MIN PAYOUT %</label><input type="number" id="zyroMinPayout" value="80"></div>
      </div>

      <button class="zyro-btn zyro-btn-start" id="zyroToggleBtn">START AUTO TRADING</button>
      <button class="zyro-btn zyro-btn-instant" id="zyroInstantBtn">⚡ 1-CLICK INSTANT AI TRADE</button>
      <button class="zyro-btn zyro-btn-mini" id="zyroExportBtn">📊 EXPORT CSV</button>
      <button class="zyro-btn zyro-btn-mini" id="zyroStatsBtn">📈 SESSION STATS</button>
    </div>
    <div class="zyro-min-icon">ZYRO</div>
  `;
  document.body.appendChild(container);

  // Elements
  const assetEl = document.getElementById('zyroAsset');
  const payoutEl = document.getElementById('zyroAssetPayout');
  const wsBadge = document.getElementById('zyroWsBadge');
  const cardConfluence = document.getElementById('zyroConfluence');
  const cardDir = document.getElementById('zyroDir');
  const confFill = document.getElementById('zyroConfFill');
  const clockEl = document.getElementById('zyroClock');
  const wlEl = document.getElementById('zyroWL');
  const mtgEl = document.getElementById('zyroMTG');
  const accEl = document.getElementById('zyroAcc');
  const netProfitEl = document.getElementById('zyroNetProfit');
  const rsiEl = document.getElementById('zyroRSI');
  const instantBtn = document.getElementById('zyroInstantBtn');
  const toggleBtn = document.getElementById('zyroToggleBtn');
  const tabAuto = document.getElementById('tabAuto');
  const tabInstant = document.getElementById('tabInstant');
  const tabManual = document.getElementById('tabManual');
  const minConfInput = document.getElementById('zyroMinConf');
  const minPayoutInput = document.getElementById('zyroMinPayout');

  // Restore settings
  document.getElementById('zyroAmt').value = savedSettings.amount;
  document.getElementById('zyroMtgMult').value = savedSettings.mtgMult;
  document.getElementById('zyroSL').value = savedSettings.sl;
  document.getElementById('zyroTP').value = savedSettings.tp;
  minConfInput.value = savedSettings.minConfidence;
  minPayoutInput.value = savedSettings.minPayout;

  // ============================================================
  // SECTION 9: UI INTERACTIONS  // ============================================================
  function showResultPopup(isWin, deltaText) {
    popup.className = isWin ? 'zyro-win-pop show' : 'zyro-loss-pop show';
    if (isWin) {
      popup.innerHTML = `🎉 PROFIT! 💸<br><span style="font-size:9px;color:#a7f3d0;">${deltaText}</span>`;
      playSoundFX('win');
      speakVoice("Alhamdulillah! Profit booked!");
    } else {
      popup.innerHTML = `⚠️ LOSS DETECTED<br><span style="font-size:9px;color:#fca5a5;">${deltaText}</span>`;
      playSoundFX('loss');
      speakVoice("Sorry! Activating recovery");
    }
    setTimeout(() => popup.classList.remove('show'), 2600);
  }

  // Dragging
  let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
  container.addEventListener("touchstart", function (e) {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
      isDragging = true;
    }
  }, { passive: false });
  container.addEventListener("touchmove", function (e) {
    if (isDragging) {
      currentX = e.touches[0].clientX - initialX;
      currentY = e.touches[0].clientY - initialY;
      xOffset = currentX; yOffset = currentY;
      container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }, { passive: false });
  container.addEventListener("touchend", () => isDragging = false);

  // Mouse drag
  const dragHandle = document.getElementById('zyroDrag');
  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'SPAN') return;
    isDragging = true;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    xOffset = currentX; yOffset = currentY;
    container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  });
  document.addEventListener('mouseup', () => isDragging = false);

  document.getElementById('zyroMinBtn').onclick = (e) => {
    e.stopPropagation();
    container.classList.add('zyro-minimized');
  };
  container.onclick = () => {
    if (container.classList.contains('zyro-minimized')) container.classList.remove('zyro-minimized');
  };
  document.getElementById('zyroCloseBtn').onclick = (e) => {
    e.stopPropagation();
    container.remove();
    popup.remove();
  };

  const soundBtn = document.getElementById('zyroSoundBtn');
  soundBtn.onclick = (e) => {
    e.stopPropagation();
    soundEnabled = !soundEnabled;
    soundBtn.innerText = soundEnabled ? '🔊' : '🔇';
  };

  document.getElementById('zyroExportBtn').onclick = () => {
    TradeLog.exportCSV();
  };

  document.getElementById('zyroStatsBtn').onclick = () => {
    const s = TradeLog.stats();
    alert(
      `📊 SESSION STATS\n\n` +
      `Total Trades: ${s.total}\n` +
      `Wins: ${s.wins}\n` +
      `Losses: ${s.losses}\n` +
      `Win Rate: ${s.winRate}%\n` +
      `Net Profit: $${s.profit.toFixed(2)}\n` +
      `Avg Win: $${s.avgWin.toFixed(2)}\n` +
      `Avg Loss: $${s.avgLoss.toFixed(2)}`
    );
  };

  // Save settings on change
  function saveSettings() {
    Settings.save({
      amount: parseFloat(document.getElementById('zyroAmt').value) || 1,
      mtgMult: parseFloat(document.getElementById('zyroMtgMult').value) || 2.2,
      sl: parseFloat(document.getElementById('zyroSL').value) || 15,
      tp: parseFloat(document.getElementById('zyroTP').value) || 30,
      maxSteps: 2,
      minConfidence: parseFloat(minConfInput.value) || 75,
      minPayout: parseFloat(minPayoutInput.value) || 80
    });
  }
  ['zyroAmt', 'zyroMtgMult', 'zyroSL', 'zyroTP', 'zyroMinConf', 'zyroMinPayout'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveSettings);
  });

  // ============================================================
  // SECTION 10: MARKET DATA HELPERS
  // ============================================================
  let lastKnownPrice = null;
  let currentActiveAsset = "";

  function normalizeAsset(a) {
    if (!a) return '';
    return a.replace(/[\/_\s-]/g, '').toUpperCase();
  }

  function getLiveRealPrice() {
    // WebSocket primary
    if (window.ZYRO_WS) {
      const wsPrice = window.ZYRO_WS.getPrice();
      if (wsPrice && !isNaN(wsPrice)) {
        lastKnownPrice = wsPrice;
        return wsPrice;
      }
      // Try asset-specific
      const assets = window.ZYRO_WS.getAssets();
      const match = assets.find(a => normalizeAsset(a) === normalizeAsset(currentActiveAsset));
      if (match) {
        const p = window.ZYRO_WS.getPrice(match);
        if (p) { lastKnownPrice = p; return p; }
      }
    }

    // DOM fallback
    const priceNodes = document.querySelectorAll("[class*='current-price'], [class*='price-value'], [class*='value__val'], [class*='deal-finish'], .live-price");
    for (let el of priceNodes) {
      const txt = el.innerText.trim();
      const val = parseFloat(txt.replace(/[^0-9.]/g, ''));
      if (!isNaN(val) && val > 0 && /\d+\.\d{2,}/.test(txt)) {
        lastKnownPrice = val;
        return val;
      }
    }
    return lastKnownPrice || 1.08450;
  }

  function getActiveQuotexAsset() {
    const sel = document.querySelector('#mobile-asset-btn .VyFjj, .VyFjj, .asset-select__name, [class*="asset-name"], [class*="current-symbol"]');
    if (sel && sel.innerText.trim()) return sel.innerText.trim();
    const activeTab = document.querySelector('.tab--active, [class*="tab-active"]');
    if (activeTab && activeTab.innerText.trim()) return activeTab.innerText.trim();
    return "EUR/USD (OTC)";
  }

  function getActivePayout() {
    const pEl = document.querySelector('.payout-value, [class*="payout"], [class*="percent"]');
    if (pEl) {
      const match = pEl.innerText.match(/\d+%/);
      if (match) return parseInt(match[0]);
    }
    return 85;
  }

  function setTradeAmount(amount) {
    const inputs = document.querySelectorAll("input[type='text'], input[type='number']");
    for (let inp of inputs) {
      if (inp.name === "amount" || inp.getAttribute("autocomplete") === "off" || inp.placeholder === "Investment") {
        inp.value = amount;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }

  function getQuotexTradeButtons() {
    let upBtn = null, downBtn = null;
    document.querySelectorAll('button').forEach(btn => {
      if (btn.querySelector('.icon-arrow-up-circle') || btn.innerText.includes('Up') || btn.classList.contains('call-btn')) upBtn = btn;
      if (btn.querySelector('.icon-arrow-down-circle') || btn.innerText.includes('Down') || btn.classList.contains('put-btn')) downBtn = btn;
    });
    return { upBtn, downBtn };
  }

  // ============================================================
  // SECTION 11: CONFLUENCE SCORER (Pattern + Indicators)
  // ============================================================
  let candleHistory = [];

  // Sync WS candles into our local history
  window.addEventListener('zyro:candle', (e) => {
    const { asset, candle } = e.detail;
    if (normalizeAsset(asset) !== normalizeAsset(currentActiveAsset)) return;
    candleHistory.push({
      open: candle.open, high: candle.high, low: candle.low, close: candle.close,
      isGreen: candle.close >= candle.open,
      body: Math.abs(candle.close - candle.open),
      total: candle.high - candle.low,
      upperWick: candle.high - Math.max(candle.open, candle.close),
      lowerWick: Math.min(candle.open, candle.close) - candle.low
    });
    if (candleHistory.length > 50) candleHistory.shift();
  });

  function analyzePattern() {
    if (candleHistory.length < 2) {
      return { direction: null, pattern: "WARMING UP", confidence: 0 };
    }
    const prev = candleHistory[candleHistory.length - 1];
    const c2 = candleHistory[candleHistory.length - 2];

    // Engulfing
    if (prev.body > 0.00005) {
      if (!prev.isGreen && c2.isGreen && c2.body > prev.body * 1.15 && c2.close > prev.high) {
        return { direction: "CALL", pattern: "BULLISH ENGULFING", confidence: 82 };
      }
      if (prev.isGreen && !c2.isGreen && c2.body > prev.body * 1.15 && c2.close < prev.low) {
        return { direction: "PUT", pattern: "BEARISH ENGULFING", confidence: 82 };
      }
    }

    // Pinbar
    if (c2.lowerWick > c2.body * 1.8 && c2.upperWick < c2.body * 0.6) {
      return { direction: "CALL", pattern: "HAMMER REBOUND", confidence: 78 };
    }
    if (c2.upperWick > c2.body * 1.8 && c2.lowerWick < c2.body * 0.6) {
      return { direction: "PUT", pattern: "SHOOTING STAR", confidence: 78 };
    }

    // Three soldiers
    if (candleHistory.length >= 3) {
      const c3 = candleHistory[candleHistory.length - 3];
      if (c3.isGreen && prev.isGreen && c2.isGreen) return { direction: "CALL", pattern: "3 SOLDIERS", confidence: 80 };
      if (!c3.isGreen && !prev.isGreen && !c2.isGreen) return { direction: "PUT", pattern: "3 CROWS", confidence: 80 };
    }

    // Breakout
    if (c2.total > 0 && c2.body > c2.total * 0.6) {
      return { direction: c2.isGreen ? "CALL" : "PUT", pattern: c2.isGreen ? "BULL BREAKOUT" : "BEAR BREAKOUT", confidence: 74 };
    }

    return { direction: null, pattern: "NO CLEAR PATTERN", confidence: 0 };
  }

  function scoreSignal() {
    const pattern = analyzePattern();
    if (!pattern.direction) return { direction: null, pattern: pattern.pattern, confidence: 0 };

    // Get candles from WS or local
    let candles = [];
    if (window.ZYRO_WS) {
      const assets = window.ZYRO_WS.getAssets();
      const match = assets.find(a => normalizeAsset(a) === normalizeAsset(currentActiveAsset));
      if (match) candles = window.ZYRO_WS.getCandles(match);
    }
    if (candles.length < 20) candles = candleHistory;

    const closes = candles.map(c => c.close);
    let callScore = 0, putScore = 0;
    const isCall = pattern.direction === 'CALL';

    // Base pattern score
    if (isCall) callScore += pattern.confidence;
    else putScore += pattern.confidence;

    // RSI
    if (closes.length >= 15) {
      const rsi = Indicators.rsi(closes);
      rsiEl.innerText = rsi.toFixed(0);
      if (rsi < 30) callScore += 12;
      if (rsi > 70) putScore += 12;
    }

    // EMA trend
    if (closes.length >= 50) {
      const ema20 = Indicators.ema(closes, 20).pop();
      const ema50 = Indicators.ema(closes, 50).pop();
      if (ema20 > ema50) callScore += 8;
      else putScore += 8;
    }

    // MACD
    if (closes.length >= 26) {
      const m = Indicators.macd(closes);
      if (m.histogram > 0) callScore += 8;
      else putScore += 8;
    }

    // Bollinger
    if (closes.length >= 20) {
      const bb = Indicators.bollinger(closes);
      const last = closes[closes.length - 1];
      if (last < bb.lower) callScore += 6;
      if (last > bb.upper) putScore += 6;
    }

    const total = callScore + putScore;
    if (total === 0) return { direction: null, pattern: pattern.pattern, confidence: 0 };

    const winner = callScore > putScore ? 'CALL' : 'PUT';
    const conf = Math.round((Math.max(callScore, putScore) / total) * 100);

    return { direction: winner, pattern: pattern.pattern, confidence: conf };
  }

  // ============================================================
  // SECTION 12: TRADE EXECUTION + REAL RESULT
  // ============================================================
  let isRunning = false;
  let baseAmount = 1;
  let currentAmount = 1;
  let mtgMultiplier = 2.2;
  let currentStep = 0;
  let wins = 0;
  let losses = 0;
  let netProfit = 0;
  let stopLossLimit = 15;
  let takeProfitLimit = 30;
  let minConfidence = 75;
  let minPayout = 80;
  let maxMtgSteps = 2;
  let isWaitingResult = false;
  let lastTradedMinute = -1;
  let lastTradeDirection = null;

  let activeMode = 'auto';

  function setMode(mode) {
    activeMode = mode;
    tabAuto.classList.toggle('active', mode === 'auto');
    tabInstant.classList.toggle('active', mode === 'instant');
    tabManual.classList.toggle('active', mode === 'manual');
    if (mode === 'instant') {
      instantBtn.style.display = 'block';
      toggleBtn.style.display = 'none';
      speakVoice("Instant mode");
    } else if (mode === 'auto') {
      instantBtn.style.display = 'none';
      toggleBtn.style.display = 'block';
    } else {
      instantBtn.style.display = 'none';
      toggleBtn.style.display = 'none';
      speakVoice("Signal mode");
    }
  }
  tabAuto.onclick = () => setMode('auto');
  tabInstant.onclick = () => setMode('instant');
  tabManual.onclick = () => setMode('manual');
  setMode('auto');

  toggleBtn.onclick = () => {
    isRunning = !isRunning;
    if (isRunning) {
      baseAmount = parseFloat(document.getElementById('zyroAmt').value) || 1;
      currentAmount = baseAmount;
      mtgMultiplier = parseFloat(document.getElementById('zyroMtgMult').value) || 2.2;
      stopLossLimit = parseFloat(document.getElementById('zyroSL').value) || 15;
      takeProfitLimit = parseFloat(document.getElementById('zyroTP').value) || 30;
      minConfidence = parseFloat(minConfInput.value) || 75;
      minPayout = parseFloat(minPayoutInput.value) || 80;
      currentStep = 0;
      toggleBtn.className = 'zyro-btn zyro-btn-stop';
      toggleBtn.innerText = 'STOP AUTO TRADING';
      playSoundFX('sniper');
      speakVoice("Zyro Auto Activated");
      sendTelegram('🚀 <b>ZYRO AUTO STARTED</b>');
    } else {
      toggleBtn.className = 'zyro-btn zyro-btn-start';
      toggleBtn.innerText = 'START AUTO TRADING';
      cardDir.innerText = 'PAUSED';
      cardDir.style.color = '#00f2fe';
      speakVoice("Auto stopped");
    }
  };

  instantBtn.onclick = () => {
    if (isWaitingResult) {
      alert("Wait for current trade to finish!");
      return;
    }
    const curP = getLiveRealPrice();
    baseAmount = parseFloat(document.getElementById('zyroAmt').value) || 1;
    if (currentStep === 0) currentAmount = baseAmount;

    const analysis = scoreSignal();
    if (!analysis.direction) {
      alert("No clear signal. Wait for pattern.");
      return;
    }

    cardConfluence.innerText = `[INSTANT: ${analysis.pattern}]`;
    cardDir.innerText = analysis.direction === 'CALL' ? '▲ INSTANT CALL' : '▼ INSTANT PUT';
    cardDir.style.color = analysis.direction === 'CALL' ? '#00e676' : '#ef4444';
    confFill.style.width = analysis.confidence + '%';

    executeSniperTrade(analysis.direction, `Instant ${analysis.pattern}`, curP);
  };

  async function waitForTradeResult(timeoutMs = 70000) {
    // Try to read from Quotex trade history DOM
    const start = Date.now();
    const selector = '[class*="history"] [class*="item"], [class*="trades-list"] [class*="item"], [class*="positions"] [class*="item"]';
    const beforeCount = document.querySelectorAll(selector).length;

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const items = document.querySelectorAll(selector);
        if (items.length > beforeCount) {
          const newest = items[0];
          const html = newest.innerHTML.toLowerCase();
          const cls = newest.className.toLowerCase();
          clearInterval(interval);

          if (html.includes('win') || cls.includes('win') || newest.querySelector('[class*="win"], [class*="success"]')) {
            resolve('WIN');
          } else if (html.includes('loss') || cls.includes('loss') || newest.querySelector('[class*="loss"], [class*="fail"]')) {
            resolve('LOSS');
          } else {
            resolve('UNKNOWN');
          }
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          resolve('TIMEOUT');
        }
      }, 500);
    });
  }

  async function executeSniperTrade(direction, patternName, entryPrice) {
    const { upBtn, downBtn } = getQuotexTradeButtons();

    if (!upBtn && !downBtn) {
      console.warn('[ZYRO] Trade buttons not found. Aborting.');
      speakVoice("Trade buttons not found");
      return;
    }

    setTradeAmount(currentAmount);
    const entry = entryPrice || getLiveRealPrice();
    lastTradeDirection = direction;
    isWaitingResult = true;

    const assetName = currentActiveAsset;

    if (activeMode !== 'manual') {
      if (direction === 'CALL' && upBtn) {
        upBtn.click();
        playSoundFX('sniper');
      } else if (direction === 'PUT' && downBtn) {
        downBtn.click();
        playSoundFX('sniper');
      } else {
        console.warn('[ZYRO] Direction button not available.');
        isWaitingResult = false;
        return;
      }
    } else {
      speakVoice(`Signal: ${direction}! ${patternName}`);
      isWaitingResult = false;
      return;
    }

    sendTelegram(`📊 <b>TRADE PLACED</b>\nAsset: ${assetName}\nDir: ${direction}\nAmount: $${currentAmount}\nPattern: ${patternName}`);

    // Wait for actual result
    let result = await waitForTradeResult(75000);

    // Fallback: if DOM didn't reveal, compare prices
    let exit = getLiveRealPrice();
    if (result === 'UNKNOWN' || result === 'TIMEOUT') {
      if (entry != null && exit != null) {
        if (direction === 'CALL') result = exit > entry ? 'WIN' : 'LOSS';
        else result = exit < entry ? 'WIN' : 'LOSS';
      } else {
        result = 'UNKNOWN';
      }
    }

    const diff = (entry != null && exit != null) ? (exit - entry).toFixed(5) : '0';
    const deltaText = `Entry: ${entry} → Exit: ${exit} (Diff: ${diff})`;

    const payoutPct = getActivePayout();
    const profitGain = currentAmount * (payoutPct / 100);

    if (result === 'WIN') {
      wins++;
      netProfit += profitGain;
      currentStep = 0;
      currentAmount = baseAmount;
      showResultPopup(true, deltaText);
      sendTelegram(`🟢 <b>WIN</b> +$${profitGain.toFixed(2)}\nBalance net: $${netProfit.toFixed(2)}`);
    } else if (result === 'LOSS') {
      losses++;
      netProfit -= currentAmount;
      currentStep++;
      if (currentStep <= maxMtgSteps) {
        currentAmount = parseFloat((currentAmount * mtgMultiplier).toFixed(2));
      } else {
        currentStep = 0;
        currentAmount = baseAmount;
      }
      showResultPopup(false, deltaText);
      sendTelegram(`🔴 <b>LOSS</b> -$${currentAmount.toFixed(2)}\nStep: ${currentStep}\nBalance net: $${netProfit.toFixed(2)}`);
    } else {
      speakVoice("Result unknown");
    }

    TradeLog.add({
      asset: assetName,
      direction,
      amount: currentAmount,
      entry,
      exit,
      result,
      profit: result === 'WIN' ? profitGain : -currentAmount
    });

    updateStatsUI();
    isWaitingResult = false;

    // SL/TP check
    if (netProfit <= -stopLossLimit) {
      alert(`⚠️ STOP LOSS HIT (-$${stopLossLimit})`);
      sendTelegram(`⚠️ <b>STOP LOSS HIT</b> Net: $${netProfit.toFixed(2)}`);
      if (isRunning) toggleBtn.click();
    } else if (netProfit >= takeProfitLimit) {
      alert(`🎉 TAKE PROFIT HIT (+$${takeProfitLimit})!`);
      sendTelegram(`🎉 <b>TAKE PROFIT HIT</b> Net: $${netProfit.toFixed(2)}`);
      if (isRunning) toggleBtn.click();
    }
  }

  function updateStatsUI() {
    const total = wins + losses;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 100;
    accEl.innerText = `${winRate}%`;
    wlEl.innerText = `${wins} / ${losses}`;
    mtgEl.innerText = `Step ${currentStep}`;
    netProfitEl.innerText = `$${netProfit.toFixed(2)}`;
    netProfitEl.style.color = netProfit >= 0 ? '#00e676' : '#ef4444';
    accEl.style.color = winRate >= 55 ? '#00e676' : '#f59e0b';
  }

  // ============================================================
  // SECTION 13: MAIN HEARTBEAT
  // ============================================================
  setInterval(() => {
    // WS Badge
    if (window.ZYRO_WS) {
      const stats = window.ZYRO_WS.getStats();
      if (stats.connected && stats.ticksExtracted > 0) {
        wsBadge.className = 'zyro-ws-badge zyro-ws-on';
        wsBadge.innerText = 'WS';
      } else {
        wsBadge.className = 'zyro-ws-badge zyro-ws-off';
        wsBadge.innerText = 'WS';
      }
    }

    const d = new Date();
    const m = d.getMinutes();
    const s = d.getSeconds();
    clockEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Asset change detection
    const detectedAsset = getActiveQuotexAsset();
    if (detectedAsset && detectedAsset !== currentActiveAsset) {
      currentActiveAsset = detectedAsset;
      assetEl.innerText = currentActiveAsset;
      const p = getActivePayout();
      payoutEl.innerText = p + '%';
      candleHistory = [];
      cardConfluence.innerText = `NEW ASSET: ${currentActiveAsset}`;
      cardDir.innerText = 'READING CANDLES...';
      cardDir.style.color = '#38bdf8';
      speakVoice(`Switched to ${currentActiveAsset}`);
    }

    // Payout update
    const payoutNow = getActivePayout();
    payoutEl.innerText = payoutNow + '%';

    if (activeMode !== 'auto' || !isRunning || isWaitingResult) return;

    // Pre-trade signal preview
    if (s >= 45 && s <= 56) {
      const analysis = scoreSignal();
      let dir = analysis.direction;
      let pat = analysis.pattern;

      if (currentStep > 0 && lastTradeDirection) {
        dir = lastTradeDirection;
        pat = `Recovery Step ${currentStep}`;
      }

      if (dir) {
        cardConfluence.innerText = `[${pat}] ${analysis.confidence}%`;
        cardDir.innerText = `${dir === 'CALL' ? '▲ SNIPER CALL' : '▼ SNIPER PUT'} (${58 - s}s)`;
        cardDir.style.color = dir === 'CALL' ? '#00e676' : '#ef4444';
        confFill.style.width = analysis.confidence + '%';
      } else {
        cardConfluence.innerText = analysis.pattern;
        cardDir.innerText = 'WAITING...';
        cardDir.style.color = '#64748b';
      }
    } else if (s === 58 && lastTradedMinute !== m) {
      lastTradedMinute = m;

      // Payout filter
      if (payoutNow < minPayout) {
        cardConfluence.innerText = `PAYOUT TOO LOW (${payoutNow}%)`;
        return;
      }

      const analysis = scoreSignal();
      let dir = analysis.direction;
      let pat = analysis.pattern;
      let conf = analysis.confidence;

      if (currentStep > 0 && lastTradeDirection) {
        dir = lastTradeDirection;
        pat = `Recovery Step ${currentStep}`;
        conf = 100; // always take recovery
      }

      if (!dir) {
        cardConfluence.innerText = 'NO SIGNAL — SKIP';
        return;
      }

      if (conf < minConfidence && currentStep === 0) {
        cardConfluence.innerText = `LOW CONF (${conf}%) — SKIP`;
        speakVoice("Signal skipped, low confidence");
        return;
      }

      cardConfluence.innerText = `[${pat}] ${conf}%`;
      cardDir.innerText = dir === 'CALL' ? '▲ AUTO CALL FIRED' : '▼ AUTO PUT FIRED';
      cardDir.style.color = dir === 'CALL' ? '#00e676' : '#ef4444';
      confFill.style.width = conf + '%';

      executeSniperTrade(dir, pat);
    } else if (s < 45) {
      const assetData = window.ZYRO_WS ? 'WS active' : 'DOM mode';
      cardConfluence.innerText = `${currentActiveAsset} • ${assetData}`;
      cardDir.innerText = 'WATCHING STRUCTURE...';
      cardDir.style.color = '#00f2fe';
    }
  }, 1000);

  // Final init
  speakVoice("Zyro A I Pro version two ready");

  // Expose API
  window.ZYRO = {
    stats: () => TradeLog.stats(),
    exportCSV: () => TradeLog.exportCSV(),
    clearLog: () => TradeLog.clear(),
    ws: () => window.ZYRO_WS?.getStats(),
    reset: () => { wins = 0; losses = 0; netProfit = 0; currentStep = 0; updateStatsUI(); }
  };

  console.log('%c⚡ ZYRO HUMAN AI PRO v2.0 LOADED', 'color:#00f2fe;font-size:14px;font-weight:bold;');
  console.log('Console commands: ZYRO.stats() | ZYRO.exportCSV() | ZYRO.ws() | ZYRO_WS.dump()');

})();
