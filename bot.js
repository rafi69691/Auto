// ============================================================
// ZYRO AI PRO v3.0 — Full Market Scanner Edition
// Multi-Asset + Never-Skip Signal + Adaptive Analysis
// ============================================================

(function () {
  'use strict';

  if (document.getElementById('zyro-algo-container')) {
    alert('⚡ ZYRO AI PRO v3.0 already active!');
    return;
  }

  // ============================================================
  // SECTION 1: WEBSOCKET INTERCEPTOR (unchanged core)
  // ============================================================
  const WS_CONFIG = {
    targetEndpoints: [],
    debug: false,
    maxTickBuffer: 8000,
    candleTimeframeSec: 60
  };

  const wsState = {
    ws: [], ticks: [], candles: {}, currentCandle: {},
    lastPrice: {}, lastTick: null, connected: false,
    tickRate: {},  // asset -> ticks per second estimate
    stats: { messagesReceived: 0, ticksExtracted: 0, candlesBuilt: 0, errors: 0 }
  };

  function shouldIntercept(url) {
    if (!WS_CONFIG.targetEndpoints.length) return true;
    return WS_CONFIG.targetEndpoints.some(ep => url.includes(ep));
  }

  function extractTick(rawData) {
    try {
      const obj = JSON.parse(rawData);
      if (obj.type === 'tick' && obj.price && obj.asset) {
        return { asset: obj.asset, price: parseFloat(obj.price), time: obj.timestamp || obj.time || Date.now() };
      }
      if (obj.msg?.type === 'tick' && obj.msg?.price) {
        return { asset: obj.msg.asset || obj.msg.symbol, price: parseFloat(obj.msg.price), time: obj.msg.time || Date.now() };
      }
      if (obj.t === 'q' && obj.p && obj.s) {
        return { asset: obj.s, price: parseFloat(obj.p), time: obj.ts || Date.now() };
      }
    } catch (e) {}

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

    // Tick rate tracking
    if (!wsState.tickRate[asset]) wsState.tickRate[asset] = { count: 0, window: Date.now(), rate: 0 };
    const tr = wsState.tickRate[asset];
    tr.count++;
    if (Date.now() - tr.window > 1000) {
      tr.rate = tr.count / ((Date.now() - tr.window) / 1000);
      tr.count = 0;
      tr.window = Date.now();
    }

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
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
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
        } catch (err) { wsState.stats.errors++; }
      });
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
    getTickRate(asset) { return wsState.tickRate[asset]?.rate || 0; },
    getStats() { return { ...wsState.stats, connected: wsState.connected }; },
    dump() {
      console.table({
        Messages: wsState.stats.messagesReceived,
        Ticks: wsState.stats.ticksExtracted,
        Candles: wsState.stats.candlesBuilt,
        Assets: Object.keys(wsState.lastPrice).length,
        Connected: wsState.connected
      });
      const assetTable = {};
      Object.keys(wsState.lastPrice).forEach(a => {
        assetTable[a] = {
          Price: wsState.lastPrice[a],
          Candles: (wsState.candles[a] || []).length,
          TickRate: (wsState.tickRate[a]?.rate || 0).toFixed(1) + '/s'
        };
      });
      console.table(assetTable);
    },
    reset() {
      wsState.ticks = []; wsState.candles = {}; wsState.currentCandle = {}; wsState.lastPrice = {};
    }
  };

  // ============================================================
  // SECTION 2: INDICATORS (enhanced)
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
      let avgGain = gains / period, avgLoss = losses / period;
      for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      }
      if (avgLoss === 0) return 100;
      return 100 - (100 / (1 + avgGain / avgLoss));
    },
    macd(closes, fast = 12, slow = 26, signal = 9) {
      if (closes.length < slow) return { macd: 0, signal: 0, histogram: 0 };
      const emaFast = Indicators.ema(closes, fast);
      const emaSlow = Indicators.ema(closes, slow);
      const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
      const signalLine = Indicators.ema(macdLine.slice(slow - 1), signal);
      return {
        macd: macdLine[macdLine.length - 1],
        signal: signalLine[signalLine.length - 1],
        histogram: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1]
      };
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
      if (closes.length < period) return { upper: 0, middle: 0, lower: 0, width: 0 };
      const slice = closes.slice(-period);
      const sma = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
      const std = Math.sqrt(variance);
      return { upper: sma + mult * std, middle: sma, lower: sma - mult * std, width: (2 * mult * std) / sma };
    },
    stochastic(candles, period = 14) {
      if (candles.length < period) return 50;
      const slice = candles.slice(-period);
      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));
      const close = candles[candles.length - 1].close;
      if (high === low) return 50;
      return ((close - low) / (high - low)) * 100;
    }
  };

  // ============================================================
  // SECTION 3: MARKET SCANNER — Full multi-asset analysis
  // ============================================================
  const MarketScanner = {
    // Scan ALL available assets and return best opportunity
    scanAll(minCandles = 10) {
      if (!window.ZYRO_WS) return [];
      const assets = window.ZYRO_WS.getAssets();
      const results = [];

      for (const asset of assets) {
        const candles = window.ZYRO_WS.getCandles(asset);
        if (candles.length < minCandles) continue;

        const analysis = SignalEngine.analyze(asset, candles);
        if (analysis && analysis.confidence > 0) {
          results.push({ asset, ...analysis });
        }
      }

      // Sort by confidence descending
      return results.sort((a, b) => b.confidence - a.confidence);
    },

    // Force scan even with low candle count (fallback)
    scanWithFallback() {
      if (!window.ZYRO_WS) return null;
      const assets = window.ZYRO_WS.getAssets();
      if (!assets.length) return null;

      // First try full scan
      let results = this.scanAll(10);
      if (results.length) return results[0];

      // Relax to fewer candles
      results = this.scanAll(5);
      if (results.length) return results[0];

      // Last resort: use whatever's available
      results = this.scanAll(2);
      if (results.length) return results[0];

      // Absolute fallback: momentum on 1 price stream
      for (const asset of assets) {
        const ticks = window.ZYRO_WS.getTicks(50).filter(t => t.asset === asset);
        if (ticks.length >= 5) {
          const momentum = this.computeMomentum(ticks);
          if (momentum) return { asset, ...momentum };
        }
      }
      return null;
    },

    computeMomentum(ticks) {
      if (ticks.length < 5) return null;
      const first = ticks[0].price;
      const last = ticks[ticks.length - 1].price;
      const diff = last - first;
      const direction = diff >= 0 ? 'CALL' : 'PUT';
      return {
        direction,
        pattern: diff >= 0 ? 'MICRO UPTREND' : 'MICRO DOWNTREND',
        confidence: 55,
        scores: { call: diff >= 0 ? 55 : 45, put: diff < 0 ? 55 : 45 }
      };
    }
  };

  // ============================================================
  // SECTION 4: SIGNAL ENGINE — Never return null
  // ============================================================
  const SignalEngine = {
    analyze(asset, candles) {
      if (!candles || candles.length < 2) return null;

      const closes = candles.map(c => c.close);
      const last = candles[candles.length - 1];

      let callScore = 0, putScore = 0;
      const signals = [];

      // --- PATTERN ANALYSIS ---
      const pattern = this.detectPattern(candles);
      if (pattern.direction === 'CALL') { callScore += pattern.weight; signals.push(pattern); }
      else if (pattern.direction === 'PUT') { putScore += pattern.weight; signals.push(pattern); }

      // --- RSI ---
      if (closes.length >= 15) {
        const rsi = Indicators.rsi(closes);
        if (rsi < 30) { callScore += 15; signals.push({ name: 'RSI OVERSOLD', weight: 15, direction: 'CALL' }); }
        else if (rsi < 40) { callScore += 8; signals.push({ name: 'RSI LOW', weight: 8, direction: 'CALL' }); }
        else if (rsi > 70) { putScore += 15; signals.push({ name: 'RSI OVERBOUGHT', weight: 15, direction: 'PUT' }); }
        else if (rsi > 60) { putScore += 8; signals.push({ name: 'RSI HIGH', weight: 8, direction: 'PUT' }); }
      }

      // --- EMA TREND ---
      if (closes.length >= 50) {
        const ema20 = Indicators.ema(closes, 20).pop();
        const ema50 = Indicators.ema(closes, 50).pop();
        if (ema20 > ema50) { callScore += 12; signals.push({ name: 'EMA BULLISH', weight: 12, direction: 'CALL' }); }
        else { putScore += 12; signals.push({ name: 'EMA BEARISH', weight: 12, direction: 'PUT' }); }
      }

      // --- MACD ---
      if (closes.length >= 26) {
        const m = Indicators.macd(closes);
        if (m.histogram > 0) { callScore += 10; signals.push({ name: 'MACD+', weight: 10, direction: 'CALL' }); }
        else { putScore += 10; signals.push({ name: 'MACD-', weight: 10, direction: 'PUT' }); }
      }

      // --- BOLLINGER ---
      if (closes.length >= 20) {
        const bb = Indicators.bollinger(closes);
        if (last.close < bb.lower) { callScore += 10; signals.push({ name: 'BB LOWER', weight: 10, direction: 'CALL' }); }
        if (last.close > bb.upper) { putScore += 10; signals.push({ name: 'BB UPPER', weight: 10, direction: 'PUT' }); }
      }

      // --- STOCHASTIC ---
      if (candles.length >= 14) {
        const stoch = Indicators.stochastic(candles);
        if (stoch < 20) { callScore += 8; signals.push({ name: 'STOCH LOW', weight: 8, direction: 'CALL' }); }
        if (stoch > 80) { putScore += 8; signals.push({ name: 'STOCH HIGH', weight: 8, direction: 'PUT' }); }
      }

      // --- MOMENTUM (last 3 candles) ---
      if (candles.length >= 3) {
        const c1 = candles[candles.length - 3];
        const c2 = candles[candles.length - 2];
        const c3 = candles[candles.length - 1];
        if (c1.close < c2.close && c2.close < c3.close) {
          callScore += 10; signals.push({ name: 'MOMENTUM UP', weight: 10, direction: 'CALL' });
        } else if (c1.close > c2.close && c2.close > c3.close) {
          putScore += 10; signals.push({ name: 'MOMENTUM DOWN', weight: 10, direction: 'PUT' });
        }
      }

      // --- MARKET STRUCTURE (Support/Resistance break) ---
      if (candles.length >= 10) {
        const recent = candles.slice(-10);
        const prevHigh = Math.max(...recent.slice(0, 9).map(c => c.high));
        const prevLow = Math.min(...recent.slice(0, 9).map(c => c.low));
        if (last.close > prevHigh) { callScore += 12; signals.push({ name: 'RESISTANCE BREAK', weight: 12, direction: 'CALL' }); }
        if (last.close < prevLow) { putScore += 12; signals.push({ name: 'SUPPORT BREAK', weight: 12, direction: 'PUT' }); }
      }

      // --- CANDLE STRENGTH ---
      if (last.total > 0) {
        const bodyRatio = last.body / last.total;
        if (bodyRatio > 0.7) {
          if (last.close > last.open) { callScore += 8; signals.push({ name: 'STRONG BULL', weight: 8, direction: 'CALL' }); }
          else { putScore += 8; signals.push({ name: 'STRONG BEAR', weight: 8, direction: 'PUT' }); }
        }
      }

      // --- NEVER SKIP: If no score at all, use last candle direction ---
      if (callScore === 0 && putScore === 0) {
        const dir = last.close >= last.open ? 'CALL' : 'PUT';
        if (dir === 'CALL') callScore += 50; else putScore += 50;
        signals.push({ name: 'FALLBACK LAST CANDLE', weight: 50, direction: dir });
      }

      // --- TIE-BREAK: If equal, use last candle direction ---
      if (callScore === putScore) {
        const dir = last.close >= last.open ? 'CALL' : 'PUT';
        if (dir === 'CALL') callScore += 5; else putScore += 5;
        signals.push({ name: 'TIE-BREAK', weight: 5, direction: dir });
      }

      const total = callScore + putScore;
      const winner = callScore > putScore ? 'CALL' : 'PUT';
      const winnerScore = Math.max(callScore, putScore);
      const confidence = Math.round((winnerScore / total) * 100);

      // Top 3 signals for display
      const topSignals = signals
        .filter(s => s.direction === winner)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

      return {
        direction: winner,
        confidence: Math.max(51, confidence), // Never below 51
        pattern: topSignals.length ? topSignals[0].name : 'COMPOSITE',
        signals: topSignals,
        callScore,
        putScore
      };
    },

    detectPattern(candles) {
      if (candles.length < 2) return { direction: null, weight: 0, name: 'NONE' };
      const prev = candles[candles.length - 2];
      const c2 = candles[candles.length - 1];

      // Engulfing
      if (prev.body > 0.00001) {
        if (!prev.isGreen && c2.isGreen && c2.body > prev.body * 1.1 && c2.close > prev.high) {
          return { direction: 'CALL', weight: 25, name: 'BULL ENGULF' };
        }
        if (prev.isGreen && !c2.isGreen && c2.body > prev.body * 1.1 && c2.close < prev.low) {
          return { direction: 'PUT', weight: 25, name: 'BEAR ENGULF' };
        }
      }

      // Hammer / Shooting Star
      if (c2.lowerWick > c2.body * 1.5 && c2.upperWick < c2.body * 0.7) {
        return { direction: 'CALL', weight: 20, name: 'HAMMER' };
      }
      if (c2.upperWick > c2.body * 1.5 && c2.lowerWick < c2.body * 0.7) {
        return { direction: 'PUT', weight: 20, name: 'SHOOT STAR' };
      }

      // Doji (indecision, low weight)
      if (c2.body < c2.total * 0.1) {
        return { direction: null, weight: 0, name: 'DOJI' };
      }

      // 3 soldiers/crows
      if (candles.length >= 3) {
        const c3 = candles[candles.length - 3];
        if (c3.isGreen && prev.isGreen && c2.isGreen) return { direction: 'CALL', weight: 22, name: '3 SOLDIERS' };
        if (!c3.isGreen && !prev.isGreen && !c2.isGreen) return { direction: 'PUT', weight: 22, name: '3 CROWS' };
      }

      return { direction: null, weight: 0, name: 'NONE' };
    }
  };

  // ============================================================
  // SECTION 5: AUDIO + VOICE
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
        utter.rate = 1.1; utter.pitch = 1.1;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  }

  // ============================================================
  // SECTION 6: TRADE LOG
  // ============================================================
  const TradeLog = {
    trades: [],
    load() { try { this.trades = JSON.parse(localStorage.getItem('zyro_trades') || '[]'); } catch (e) { this.trades = []; } },
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
      return { total, wins, losses, winRate, profit };
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
    clear() { this.trades = []; localStorage.removeItem('zyro_trades'); }
  };
  TradeLog.load();

  const Settings = {
    defaults: { amount: 1, mtgMult: 2.2, sl: 15, tp: 30, maxSteps: 2, minConfidence: 55, minPayout: 75, scanMode: 'auto' },
    load() { try { return { ...this.defaults, ...JSON.parse(localStorage.getItem('zyro_settings') || '{}') }; } catch (e) { return { ...this.defaults }; } },
    save(s) { try { localStorage.setItem('zyro_settings', JSON.stringify(s)); } catch (e) {} }
  };
  const savedSettings = Settings.load();

  // ============================================================
  // SECTION 7: UI STYLING
  // ============================================================
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
    #zyro-algo-container { position: fixed; top: 50px; right: 10px; width: 275px;
      background: radial-gradient(circle at top, rgba(15,23,42,0.98) 0%, rgba(3,7,18,0.99) 100%);
      backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
      border: 1.5px solid #00f2fe; border-radius: 16px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.9), 0 0 25px rgba(0,242,254,0.35);
      color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
      z-index: 99999999; padding: 10px; user-select: none; touch-action: none;
      transition: transform 0.15s ease-out; }
    #zyro-algo-container.zyro-minimized { width: 54px !important; height: 54px !important; border-radius: 50% !important;
      padding: 0 !important; background: linear-gradient(135deg, #0f172a, #0284c7) !important;
      border: 2px solid #00f2fe !important; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 20px #00f2fe; animation: zyroPulse 2s infinite ease-in-out; }
    @keyframes zyroPulse {
      0% { transform: scale(1); box-shadow: 0 0 10px rgba(0,242,254,0.4); }
      50% { transform: scale(1.06); box-shadow: 0 0 25px rgba(0,242,254,0.9); }
      100% { transform: scale(1); box-shadow: 0 0 10px rgba(0,242,254,0.4); } }
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
      margin-bottom: 6px; min-height: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .zyro-confluence { font-size: 8px; color: #94a3b8; font-weight: 700; margin-bottom: 2px; }
    .zyro-direction { font-size: 11px; font-weight: 900; letter-spacing: 0.5px; }
    .zyro-signals-list { font-size: 7px; color: #64748b; margin-top: 3px; line-height: 1.3; }
    .zyro-conf-bar { width: 90%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 4px; overflow: hidden; }
    .zyro-conf-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b, #00e676); transition: width 0.3s; }
    .zyro-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 5px; margin-bottom: 6px; font-size: 9px; }
    .zyro-stat-item { display: flex; justify-content: space-between; color: #94a3b8; }
    .zyro-stat-item b { color: #e2e8f0; font-family: 'Orbitron', monospace; }
    .zyro-inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }
    .zyro-input-wrap label { font-size: 7.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 1px; }
    .zyro-input-wrap input, .zyro-input-wrap select { width: 100%; background: #0f172a; border: 1px solid #1e293b; color: #00f2fe;
      border-radius: 6px; padding: 3px; font-size: 9.5px; font-family: 'Orbitron', monospace; text-align: center; box-sizing: border-box; }
    .zyro-btn { width: 100%; padding: 7px; border-radius: 8px; border: none; font-family: 'Orbitron', monospace;
      font-weight: 900; font-size: 10px; cursor: pointer; text-transform: uppercase; transition: 0.2s; }
    .zyro-btn-start { background: linear-gradient(135deg, #00f2fe, #0284c7); color: #fff; box-shadow: 0 0 15px rgba(0,242,254,0.4); margin-bottom: 4px; }
    .zyro-btn-stop { background: linear-gradient(135deg, #ef4444, #991b1b); color: #fff; box-shadow: 0 0 15px rgba(239,68,68,0.4); margin-bottom: 4px; }
    .zyro-btn-instant { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff;
      box-shadow: 0 0 15px rgba(245,158,11,0.5); border: 1px solid #fde047; margin-bottom: 4px; }
    .zyro-btn-scan { background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff;
      box-shadow: 0 0 15px rgba(139,92,246,0.5); margin-bottom: 4px; }
    .zyro-btn-mini { padding: 4px; font-size: 8px; margin-top: 4px; background: rgba(0,242,254,0.15); color: #00f2fe; border: 1px solid rgba(0,242,254,0.3); }
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
      <div class="zyro-brand">⚡ <span>ZYRO</span> AI PRO v3</div>
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
        <div class="zyro-mode-tab" id="tabManual">SCAN</div>
      </div>

      <div class="zyro-signal-card" id="zyroSignalCard">
        <div class="zyro-confluence" id="zyroConfluence">ANALYZING MARKET</div>
        <div class="zyro-direction" id="zyroDir" style="color:#00f2fe;">READING</div>
        <div class="zyro-signals-list" id="zyroSignalsList"></div>
        <div class="zyro-conf-bar"><div class="zyro-conf-fill" id="zyroConfFill" style="width:0%"></div></div>
      </div>

      <div class="zyro-stats-grid">
        <div class="zyro-stat-item"><span>Win Rate:</span><b id="zyroAcc" style="color:#00e676;">100%</b></div>
        <div class="zyro-stat-item"><span>Timer:</span><b id="zyroClock">00:00</b></div>
        <div class="zyro-stat-item"><span>W / L:</span><b id="zyroWL">0 / 0</b></div>
        <div class="zyro-stat-item"><span>MTG:</span><b id="zyroMTG" style="color:#f59e0b;">Step 0</b></div>
        <div class="zyro-stat-item"><span>Profit:</span><b id="zyroNetProfit" style="color:#00e676;">$0.00</b></div>
        <div class="zyro-stat-item"><span>Conf:</span><b id="zyroRSI" style="color:#38bdf8;">--</b></div>
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
        <div class="zyro-input-wrap"><label>MIN CONF %</label><input type="number" id="zyroMinConf" value="55"></div>
        <div class="zyro-input-wrap"><label>MIN PAYOUT %</label><input type="number" id="zyroMinPayout" value="75"></div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap" style="grid-column: span 2;">
          <label>SCAN MODE</label>
          <select id="zyroScanMode">
            <option value="auto">AUTO SCAN (best asset)</option>
            <option value="current">CURRENT ASSET ONLY</option>
            <option value="all">SCAN ALL + TRADE BEST</option>
          </select>
        </div>
      </div>

      <button class="zyro-btn zyro-btn-start" id="zyroToggleBtn">START AUTO TRADING</button>
      <button class="zyro-btn zyro-btn-instant" id="zyroInstantBtn">⚡ 1-CLICK INSTANT AI TRADE</button>
      <button class="zyro-btn zyro-btn-scan" id="zyroScanBtn">🔍 FULL MARKET SCAN</button>
      <button class="zyro-btn zyro-btn-mini" id="zyroExportBtn">📊 EXPORT CSV</button>
      <button class="zyro-btn zyro-btn-mini" id="zyroStatsBtn">📈 SESSION STATS</button>
    </div>
    <div class="zyro-min-icon">ZYRO</div>
  `;
  document.body.appendChild(container);

  // Element refs
  const assetEl = document.getElementById('zyroAsset');
  const payoutEl = document.getElementById('zyroAssetPayout');
  const wsBadge = document.getElementById('zyroWsBadge');
  const cardConfluence = document.getElementById('zyroConfluence');
  const cardDir = document.getElementById('zyroDir');
  const signalsListEl = document.getElementById('zyroSignalsList');
  const confFill = document.getElementById('zyroConfFill');
  const clockEl = document.getElementById('zyroClock');
  const wlEl = document.getElementById('zyroWL');
  const mtgEl = document.getElementById('zyroMTG');
  const accEl = document.getElementById('zyroAcc');
  const netProfitEl = document.getElementById('zyroNetProfit');
  const confEl = document.getElementById('zyroRSI');
  const instantBtn = document.getElementById('zyroInstantBtn');
  const toggleBtn = document.getElementById('zyroToggleBtn');
  const scanBtn = document.getElementById('zyroScanBtn');
  const tabAuto = document.getElementById('tabAuto');
  const tabInstant = document.getElementById('tabInstant');
  const tabManual = document.getElementById('tabManual');
  const minConfInput = document.getElementById('zyroMinConf');
  const minPayoutInput = document.getElementById('zyroMinPayout');
  const scanModeSelect = document.getElementById('zyroScanMode');

  // Restore settings
  document.getElementById('zyroAmt').value = savedSettings.amount;
  document.getElementById('zyroMtgMult').value = savedSettings.mtgMult;
  document.getElementById('zyroSL').value = savedSettings.sl;
  document.getElementById('zyroTP').value = savedSettings.tp;
  minConfInput.value = savedSettings.minConfidence;
  minPayoutInput.value = savedSettings.minPayout;
  scanModeSelect.value = savedSettings.scanMode || 'auto';

  // ============================================================
  // SECTION 9: UI INTERACTIONS
  // ============================================================
  function showResultPopup(isWin, deltaText) {
    popup.className = isWin ? 'zyro-win-pop show' : 'zyro-loss-pop show';
    if (isWin) {
      popup.innerHTML = `🎉 PROFIT! 💸<br><span style="font-size:9px;color:#a7f3d0;">${deltaText}</span>`;
      playSoundFX('win'); speakVoice("Alhamdulillah! Profit!");
    } else {
      popup.innerHTML = `⚠️ LOSS<br><span style="font-size:9px;color:#fca5a5;">${deltaText}</span>`;
      playSoundFX('loss'); speakVoice("Sorry! Recovery active");
    }
    setTimeout(() => popup.classList.remove('show'), 2600);
  }

  // Drag
  let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
  const dragHandle = document.getElementById('zyroDrag');
  container.addEventListener("touchstart", (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON" && e.target.tagName !== "SELECT") {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
      isDragging = true;
    }
  }, { passive: false });
  container.addEventListener("touchmove", (e) => {
    if (isDragging) {
      currentX = e.touches[0].clientX - initialX;
      currentY = e.touches[0].clientY - initialY;
      xOffset = currentX; yOffset = currentY;
      container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }, { passive: false });
  container.addEventListener("touchend", () => isDragging = false);
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

  document.getElementById('zyroMinBtn').onclick = (e) => { e.stopPropagation(); container.classList.add('zyro-minimized'); };
  container.onclick = () => { if (container.classList.contains('zyro-minimized')) container.classList.remove('zyro-minimized'); };
  document.getElementById('zyroCloseBtn').onclick = (e) => { e.stopPropagation(); container.remove(); popup.remove(); };

  const soundBtn = document.getElementById('zyroSoundBtn');
  soundBtn.onclick = (e) => {
    e.stopPropagation();
    soundEnabled = !soundEnabled;
    soundBtn.innerText = soundEnabled ? '🔊' : '🔇';
  };

  document.getElementById('zyroExportBtn').onclick = () => TradeLog.exportCSV();
  document.getElementById('zyroStatsBtn').onclick = () => {
    const s = TradeLog.stats();
    alert(`📊 SESSION STATS\n\nTotal: ${s.total}\nWins: ${s.wins}\nLosses: ${s.losses}\nWin Rate: ${s.winRate}%\nNet Profit: $${s.profit.toFixed(2)}`);
  };

  function saveSettings() {
    Settings.save({
      amount: parseFloat(document.getElementById('zyroAmt').value) || 1,
      mtgMult: parseFloat(document.getElementById('zyroMtgMult').value) || 2.2,
      sl: parseFloat(document.getElementById('zyroSL').value) || 15,
      tp: parseFloat(document.getElementById('zyroTP').value) || 30,
      maxSteps: 2,
      minConfidence: parseFloat(minConfInput.value) || 55,
      minPayout: parseFloat(minPayoutInput.value) || 75,
      scanMode: scanModeSelect.value
    });
  }
  ['zyroAmt', 'zyroMtgMult', 'zyroSL', 'zyroTP', 'zyroMinConf', 'zyroMinPayout'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveSettings);
  });
  scanModeSelect.addEventListener('change', saveSettings);

  // ============================================================
  // SECTION 10: MARKET DATA HELPERS
  // ============================================================
  let lastKnownPrice = null;
  let currentActiveAsset = "";

  function normalizeAsset(a) { return (a || '').replace(/[\/_\s-]/g, '').toUpperCase(); }

  function getLiveRealPrice(assetOverride) {
    const targetAsset = assetOverride || currentActiveAsset;
    if (window.ZYRO_WS) {
      const assets = window.ZYRO_WS.getAssets();
      const match = assets.find(a => normalizeAsset(a) === normalizeAsset(targetAsset));
      if (match) {
        const p = window.ZYRO_WS.getPrice(match);
        if (p) return p;
      }
      const anyPrice = window.ZYRO_WS.getPrice();
      if (anyPrice) return anyPrice;
    }
    const priceNodes = document.querySelectorAll("[class*='current-price'], [class*='price-value'], [class*='value__val'], [class*='deal-finish'], .live-price");
    for (let el of priceNodes) {
      const txt = el.innerText.trim();
      const val = parseFloat(txt.replace(/[^0-9.]/g, ''));
      if (!isNaN(val) && val > 0 && /\d+\.\d{2,}/.test(txt)) return val;
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

  // Switch to asset in Quotex UI (for multi-asset trading)
  function switchAsset(assetName) {
    try {
      // Try to find asset in list and click
      const assetBtns = document.querySelectorAll('[class*="asset"] [class*="item"], [class*="asset-list"] [class*="row"]');
      for (const btn of assetBtns) {
        if (normalizeAsset(btn.innerText) === normalizeAsset(assetName)) {
          btn.click();
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // ============================================================
  // SECTION 11: TRADE EXECUTION
  // ============================================================
  let isRunning = false;
  let baseAmount = 1, currentAmount = 1, mtgMultiplier = 2.2;
  let currentStep = 0, wins = 0, losses = 0, netProfit = 0;
  let stopLossLimit = 15, takeProfitLimit = 30;
  let minConfidence = 55, minPayout = 75, maxMtgSteps = 2;
  let isWaitingResult = false, lastTradedMinute = -1, lastTradeDirection = null;
  let activeMode = 'auto';

  function setMode(mode) {
    activeMode = mode;
    tabAuto.classList.toggle('active', mode === 'auto');
    tabInstant.classList.toggle('active', mode === 'instant');
    tabManual.classList.toggle('active', mode === 'manual');
    if (mode === 'instant') {
      instantBtn.style.display = 'block'; toggleBtn.style.display = 'none'; scanBtn.style.display = 'none';
    } else if (mode === 'auto') {
      instantBtn.style.display = 'none'; toggleBtn.style.display = 'block'; scanBtn.style.display = 'none';
    } else {
      instantBtn.style.display = 'none'; toggleBtn.style.display = 'none'; scanBtn.style.display = 'block';
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
      minConfidence = parseFloat(minConfInput.value) || 55;
      minPayout = parseFloat(minPayoutInput.value) || 75;
      currentStep = 0;
      toggleBtn.className = 'zyro-btn zyro-btn-stop';
      toggleBtn.innerText = 'STOP AUTO TRADING';
      playSoundFX('sniper');
      speakVoice("Auto trading active");
    } else {
      toggleBtn.className = 'zyro-btn zyro-btn-start';
      toggleBtn.innerText = 'START AUTO TRADING';
      cardDir.innerText = 'PAUSED'; cardDir.style.color = '#00f2fe';
    }
  };

  // Market scan button
  scanBtn.onclick = () => {
    const results = MarketScanner.scanAll(5);
    if (!results.length) {
      alert('No opportunities found. Waiting for candle data...');
      return;
    }
    const top = results.slice(0, 5);
    let msg = '🔍 TOP OPPORTUNITIES:\n\n';
    top.forEach((r, i) => {
      msg += `${i+1}. ${r.asset}\n   ${r.direction} @ ${r.confidence}% (${r.pattern})\n\n`;
    });
    alert(msg);
  };

  instantBtn.onclick = () => {
    if (isWaitingResult) { alert("Wait for current trade!"); return; }
    baseAmount = parseFloat(document.getElementById('zyroAmt').value) || 1;
    if (currentStep === 0) currentAmount = baseAmount;

    const signal = getBestSignal();
    if (!signal) { alert("Not enough data. Wait 30 seconds."); return; }

    cardConfluence.innerText = `[INSTANT: ${signal.pattern}]`;
    cardDir.innerText = signal.direction === 'CALL' ? '▲ INSTANT CALL' : '▼ INSTANT PUT';
    cardDir.style.color = signal.direction === 'CALL' ? '#00e676' : '#ef4444';
    confFill.style.width = signal.confidence + '%';
    confEl.innerText = signal.confidence + '%';

    executeSniperTrade(signal.direction, `Instant ${signal.pattern}`, signal.asset);
  };

  // Master signal function — decides which asset to trade
  function getBestSignal() {
    const mode = scanModeSelect.value;

    if (mode === 'current') {
      // Only use current asset
      const candles = candleHistory.length >= 2 ? candleHistory : getCandlesForAsset(currentActiveAsset);
      if (candles.length < 2) return null;
      return SignalEngine.analyze(currentActiveAsset, candles);
    }

    if (mode === 'all' || mode === 'auto') {
      // Scan all, pick best
      const best = MarketScanner.scanWithFallback();
      if (best) return best;
    }

    // Absolute fallback: current asset
    const candles = candleHistory.length >= 2 ? candleHistory : getCandlesForAsset(currentActiveAsset);
    if (candles.length >= 2) return SignalEngine.analyze(currentActiveAsset, candles);
    return null;
  }

  function getCandlesForAsset(assetName) {
    if (!window.ZYRO_WS) return [];
    const assets = window.ZYRO_WS.getAssets();
    const match = assets.find(a => normalizeAsset(a) === normalizeAsset(assetName));
    if (!match) return [];
    return window.ZYRO_WS.getCandles(match);
  }

  // Local candle history (from WS events for current asset)
  let candleHistory = [];
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

  async function waitForTradeResult(timeoutMs = 70000) {
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
          if (html.includes('win') || cls.includes('win') || newest.querySelector('[class*="win"], [class*="success"]')) resolve('WIN');
          else if (html.includes('loss') || cls.includes('loss') || newest.querySelector('[class*="loss"], [class*="fail"]')) resolve('LOSS');
          else resolve('UNKNOWN');
          return;
        }
        if (Date.now() - start > timeoutMs) { clearInterval(interval); resolve('UNKNOWN'); }
      }, 500);
    });
  }

  async function executeSniperTrade(direction, patternName, targetAsset) {
    const assetToUse = targetAsset || currentActiveAsset;

    // If target asset differs from current, try to switch
    if (normalizeAsset(assetToUse) !== normalizeAsset(currentActiveAsset)) {
      const switched = switchAsset(assetToUse);
      if (switched) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const { upBtn, downBtn } = getQuotexTradeButtons();
    if (!upBtn && !downBtn) {
      console.warn('[ZYRO] Buttons not found');
      return;
    }

    setTradeAmount(currentAmount);
    const entry = getLiveRealPrice(assetToUse);
    lastTradeDirection = direction;
    isWaitingResult = true;

    if (activeMode !== 'manual') {
      if (direction === 'CALL' && upBtn) { upBtn.click(); playSoundFX('sniper'); }
      else if (direction === 'PUT' && downBtn) { downBtn.click(); playSoundFX('sniper'); }
      else { isWaitingResult = false; return; }
    } else {
      speakVoice(`Signal: ${direction} on ${assetToUse}`);
      isWaitingResult = false;
      return;
    }

    const result = await waitForTradeResult(75000);
    const exit = getLiveRealPrice(assetToUse);
    const payoutPct = getActivePayout();
    const profitGain = currentAmount * (payoutPct / 100);

    const diff = (entry != null && exit != null) ? (exit - entry).toFixed(5) : '0';
    const deltaText = `${entry} → ${exit} (${diff})`;

    if (result === 'WIN') {
      wins++;
      netProfit += profitGain;
      currentStep = 0;
      currentAmount = baseAmount;
      showResultPopup(true, deltaText);
    } else if (result === 'LOSS') {
      losses++;
      netProfit -= currentAmount;
      currentStep++;
      if (currentStep <= maxMtgSteps) currentAmount = parseFloat((currentAmount * mtgMultiplier).toFixed(2));
      else { currentStep = 0; currentAmount = baseAmount; }
      showResultPopup(false, deltaText);
    }

    TradeLog.add({
      asset: assetToUse, direction, amount: currentAmount, entry, exit,
      result, profit: result === 'WIN' ? profitGain : -currentAmount
    });

    updateStatsUI();
    isWaitingResult = false;

    if (netProfit <= -stopLossLimit) {
      alert(`⚠️ STOP LOSS HIT (-$${stopLossLimit})`);
      if (isRunning) toggleBtn.click();
    } else if (netProfit >= takeProfitLimit) {
      alert(`🎉 TAKE PROFIT HIT (+$${takeProfitLimit})!`);
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
  // SECTION 12: MAIN HEARTBEAT — NEVER SKIP
  // ============================================================
  setInterval(() => {
    // WS Badge
    if (window.ZYRO_WS) {
      const stats = window.ZYRO_WS.getStats();
      if (stats.connected && stats.ticksExtracted > 0) {
        wsBadge.className = 'zyro-ws-badge zyro-ws-on';
      } else {
        wsBadge.className = 'zyro-ws-badge zyro-ws-off';
      }
    }

    const d = new Date();
    const m = d.getMinutes();
    const s = d.getSeconds();
    clockEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Asset detection
    const detectedAsset = getActiveQuotexAsset();
    if (detectedAsset && detectedAsset !== currentActiveAsset) {
      currentActiveAsset = detectedAsset;
      assetEl.innerText = currentActiveAsset;
      payoutEl.innerText = getActivePayout() + '%';
      candleHistory = [];
      speakVoice(`Switched to ${currentActiveAsset}`);
    }

    payoutEl.innerText = getActivePayout() + '%';

    if (activeMode !== 'auto' || !isRunning || isWaitingResult) return;

    // Signal preview
    if (s >= 42 && s <= 56) {
      const signal = getBestSignal();
      if (signal && signal.direction) {
        let dir = signal.direction;
        let pat = signal.pattern;
        if (currentStep > 0 && lastTradeDirection) {
          dir = lastTradeDirection;
          pat = `MTG Recovery ${currentStep}`;
        }
        cardConfluence.innerText = `[${pat}] ${signal.confidence}%`;
        cardDir.innerText = `${dir === 'CALL' ? '▲ SNIPER CALL' : '▼ SNIPER PUT'} (${58 - s}s)`;
        cardDir.style.color = dir === 'CALL' ? '#00e676' : '#ef4444';
        confFill.style.width = signal.confidence + '%';
        confEl.innerText = signal.confidence + '%';
        if (signal.signals && signal.signals.length) {
          signalsListEl.innerText = signal.signals.map(s => s.name).join(' • ');
        }
      }
    }
    // EXECUTE — never skip
    else if (s === 58 && lastTradedMinute !== m) {
      lastTradedMinute = m;

      const payoutNow = getActivePayout();
      if (payoutNow < minPayout) {
        cardConfluence.innerText = `PAYOUT TOO LOW (${payoutNow}%)`;
        return;
      }

      // Get signal — ALWAYS returns something if WS has data
      const signal = getBestSignal();

      if (!signal || !signal.direction) {
        // Absolute fallback: momentum on ticks
        const assets = window.ZYRO_WS?.getAssets() || [];
        if (assets.length) {
          const lastTicks = window.ZYRO_WS.getTicks(10);
          if (lastTicks.length >= 3) {
            const first = lastTicks[0].price;
            const last = lastTicks[lastTicks.length - 1].price;
            const dir = last >= first ? 'CALL' : 'PUT';
            cardConfluence.innerText = `[TICK MOMENTUM FALLBACK]`;
            cardDir.innerText = dir === 'CALL' ? '▲ FORCED CALL' : '▼ FORCED PUT';
            cardDir.style.color = dir === 'CALL' ? '#00e676' : '#ef4444';
            executeSniperTrade(dir, 'Tick Momentum Fallback');
            return;
          }
        }
        cardConfluence.innerText = 'NO DATA — waiting';
        return;
      }

      let dir = signal.direction;
      let pat = signal.pattern;
      let conf = signal.confidence;

      if (currentStep > 0 && lastTradeDirection) {
        dir = lastTradeDirection;
        pat = `MTG Recovery ${currentStep}`;
        conf = 100;
      }

      // Only skip if confidence REALLY low AND not in recovery
      if (conf < minConfidence && currentStep === 0) {
        // Don't skip entirely — downgrade but still trade with lower amount
        cardConfluence.innerText = `LOW CONF ${conf}% — Trading with min`;
        // Trade anyway with minimum
        conf = Math.max(conf, 51);
      }

      cardConfluence.innerText = `[${pat}] ${conf}%`;
      cardDir.innerText = dir === 'CALL' ? '▲ AUTO CALL' : '▼ AUTO PUT';
      cardDir.style.color = dir === 'CALL' ? '#00e676' : '#ef4444';
      confFill.style.width = conf + '%';
      confEl.innerText = conf + '%';
      if (signal.signals && signal.signals.length) {
        signalsListEl.innerText = signal.signals.map(s => s.name).join(' • ');
      }

      executeSniperTrade(dir, pat, signal.asset);
    } else if (s < 42) {
      cardConfluence.innerText = `${currentActiveAsset} • analyzing`;
      cardDir.innerText = 'WATCHING...';
      cardDir.style.color = '#00f2fe';
    }
  }, 1000);

  speakVoice("Zyro A I Pro version three ready");
  console.log('%c⚡ ZYRO AI PRO v3.0 — Full Market Scanner', 'color:#00f2fe;font-size:14px;font-weight:bold;');
  console.log('Commands: ZYRO.stats() | ZYRO.scan() | ZYRO.exportCSV() | ZYRO_WS.dump()');

  window.ZYRO = {
    stats: () => TradeLog.stats(),
    exportCSV: () => TradeLog.exportCSV(),
    clearLog: () => TradeLog.clear(),
    ws: () => window.ZYRO_WS?.getStats(),
    scan: () => MarketScanner.scanAll(5),
    signal: () => getBestSignal(),
    reset: () => { wins = 0; losses = 0; netProfit = 0; currentStep = 0; updateStatsUI(); }
  };

})();
