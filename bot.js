(function () {
  'use strict';

  if (document.getElementById('zyro-algo-container')) {
    alert('⚡ ZYRO HUMAN AI MASTER is already active on screen!');
    return;
  }

  // --- 1. Audio & Voice FX Engine ---
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playSoundFX(type) {
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.18);
        osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.32);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.45);
      } else if (type === 'loss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(160, audioCtx.currentTime + 0.38);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.38);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.38);
      } else if (type === 'sniper') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      }
    } catch(e) {}
  }

  function speakVoice(text) {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.05;
        utter.pitch = 1.1;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  }

  // --- 2. Futuristic Cyber UI Styling ---
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');

    #zyro-algo-container {
      position: fixed; top: 50px; right: 10px; width: 260px;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%);
      backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
      border: 1.5px solid #00f2fe; border-radius: 16px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.9), 0 0 25px rgba(0, 242, 254, 0.35);
      color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
      z-index: 99999999; padding: 10px; user-select: none; touch-action: none;
      transition: transform 0.15s ease-out;
    }

    #zyro-algo-container.zyro-minimized {
      width: 54px !important; height: 54px !important; border-radius: 50% !important;
      padding: 0 !important; background: linear-gradient(135deg, #0f172a, #0284c7) !important;
      border: 2px solid #00f2fe !important; cursor: grab; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 20px #00f2fe; animation: zyroPulse 2s infinite ease-in-out;
    }
    @keyframes zyroPulse {
      0% { transform: scale(1); box-shadow: 0 0 10px rgba(0,242,254,0.4); }
      50% { transform: scale(1.06); box-shadow: 0 0 25px rgba(0,242,254,0.9); }
      100% { transform: scale(1); box-shadow: 0 0 10px rgba(0,242,254,0.4); }
    }

    .zyro-header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(0, 242, 254, 0.2); padding-bottom: 5px; margin-bottom: 6px; cursor: grab;
    }
    .zyro-brand { display: flex; align-items: center; gap: 5px; font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 900; color: #fff; }
    .zyro-brand span { color: #00f2fe; text-shadow: 0 0 10px rgba(0,242,254,0.8); }
    .zyro-ctrls { display: flex; gap: 8px; font-size: 13px; font-weight: bold; color: #64748b; cursor: pointer; }
    .zyro-ctrls span:hover { color: #00f2fe; }

    .zyro-min-icon { display: none; font-family: 'Orbitron', monospace; font-size: 12px; font-weight: 900; color: #00f2fe; }
    #zyro-algo-container.zyro-minimized .zyro-min-icon { display: block !important; }
    #zyro-algo-container.zyro-minimized .zyro-body, #zyro-algo-container.zyro-minimized .zyro-header { display: none !important; }

    .zyro-asset-pill {
      background: rgba(0, 242, 254, 0.12); border: 1px solid #00f2fe; border-radius: 6px;
      padding: 4px 6px; font-size: 10px; font-family: 'Orbitron', monospace; font-weight: 800;
      color: #00f2fe; text-align: center; margin-bottom: 6px; letter-spacing: 0.5px;
      display: flex; justify-content: space-between; align-items: center;
    }

    .zyro-mode-tabs { display: flex; background: rgba(0,0,0,0.6); border: 1px solid rgba(0,242,254,0.2); border-radius: 6px; padding: 2px; margin-bottom: 6px; }
    .zyro-mode-tab { flex: 1; text-align: center; font-size: 8px; font-family: 'Orbitron', monospace; font-weight: 800; padding: 4px 0; color: #64748b; cursor: pointer; border-radius: 4px; }
    .zyro-mode-tab.active { background: linear-gradient(135deg, #0284c7, #00f2fe); color: #fff; }

    .zyro-signal-card {
      text-align: center; font-family: 'Orbitron', monospace; padding: 6px 4px;
      border-radius: 8px; background: rgba(0, 242, 254, 0.05); border: 1px dashed rgba(0, 242, 254, 0.4);
      margin-bottom: 6px; min-height: 48px; display: flex; flex-direction: column; justify-content: center; align-items: center;
    }
    .zyro-confluence { font-size: 8px; color: #94a3b8; font-weight: 700; margin-bottom: 2px; }
    .zyro-direction { font-size: 11px; font-weight: 900; letter-spacing: 0.5px; }

    .zyro-stats-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 5px; margin-bottom: 6px; font-size: 9px;
    }
    .zyro-stat-item { display: flex; justify-content: space-between; color: #94a3b8; }
    .zyro-stat-item b { color: #e2e8f0; font-family: 'Orbitron', monospace; }

    .zyro-inputs-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px;
    }
    .zyro-input-wrap label { font-size: 7.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 1px; }
    .zyro-input-wrap input, .zyro-input-wrap select {
      width: 100%; background: #0f172a; border: 1px solid #1e293b; color: #00f2fe;
      border-radius: 6px; padding: 3px; font-size: 9px; font-family: 'Orbitron', monospace; text-align: center;
    }

    .zyro-btn {
      width: 100%; padding: 7px; border-radius: 8px; border: none; font-family: 'Orbitron', monospace;
      font-weight: 900; font-size: 10px; cursor: pointer; text-transform: uppercase; transition: 0.2s;
    }
    .zyro-btn-start { background: linear-gradient(135deg, #00f2fe, #0284c7); color: #fff; box-shadow: 0 0 15px rgba(0,242,254,0.4); margin-bottom: 4px; }
    .zyro-btn-stop { background: linear-gradient(135deg, #ef4444, #991b1b); color: #fff; box-shadow: 0 0 15px rgba(239,68,68,0.4); margin-bottom: 4px; }

    .zyro-btn-instant {
      background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff;
      box-shadow: 0 0 15px rgba(245,158,11,0.5); border: 1px solid #fde047;
    }

    #zyro-popup {
      position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%) scale(0.3);
      padding: 16px 24px; border-radius: 14px; z-index: 2147483647; font-family: 'Orbitron', monospace;
      font-size: 12.5px; font-weight: 900; color: #fff; text-align: center; opacity: 0; pointer-events: none;
      transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #zyro-popup.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .zyro-win-pop { background: linear-gradient(135deg, #059669, #047857); border: 2px solid #00e676; box-shadow: 0 0 35px rgba(0,230,118,0.8); }
    .zyro-loss-pop { background: linear-gradient(135deg, #dc2626, #7f1d1d); border: 2px solid #f87171; box-shadow: 0 0 35px rgba(239,68,68,0.8); }
  `;
  document.head.appendChild(style);

  const popup = document.createElement('div');
  popup.id = 'zyro-popup';
  document.body.appendChild(popup);

  const container = document.createElement('div');
  container.id = 'zyro-algo-container';
  container.innerHTML = `
    <div class="zyro-header" id="zyroDrag">
      <div class="zyro-brand">⚡ <span>ZYRO</span> ULTRA PRO V3</div>
      <div class="zyro-ctrls">
        <span id="zyroMinBtn">—</span>
        <span id="zyroCloseBtn">✕</span>
      </div>
    </div>
    <div class="zyro-body">
      <div class="zyro-asset-pill">
        <span id="zyroAsset">SCANNING PAIR...</span>
        <span id="zyroAssetPayout" style="color:#00e676;">85%</span>
      </div>

      <div class="zyro-mode-tabs">
        <div class="zyro-mode-tab active" id="tabAuto">AUTO</div>
        <div class="zyro-mode-tab" id="tabInstant">INSTANT</div>
        <div class="zyro-mode-tab" id="tabManual">SIGNAL</div>
      </div>

      <div class="zyro-signal-card" id="zyroSignalCard">
        <div class="zyro-confluence" id="zyroConfluence">SMART EXECUTION ENGINE READY</div>
        <div class="zyro-direction" id="zyroDir" style="color:#00f2fe;">ANALYZING MARKET</div>
      </div>

      <div class="zyro-stats-grid">
        <div class="zyro-stat-item"><span>Win Rate:</span><b id="zyroAcc" style="color:#00e676;">100%</b></div>
        <div class="zyro-stat-item"><span>Timer:</span><b id="zyroClock">00:00</b></div>
        <div class="zyro-stat-item"><span>W / L:</span><b id="zyroWL">0 / 0</b></div>
        <div class="zyro-stat-item"><span>MTG:</span><b id="zyroMTG" style="color:#f59e0b;">Step 0</b></div>
        <div class="zyro-stat-item"><span>RSI (14):</span><b id="zyroRSI" style="color:#38bdf8;">50.0</b></div>
        <div class="zyro-stat-item"><span>Profit:</span><b id="zyroNetProfit" style="color:#00e676;">$0.00</b></div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap">
          <label>AMOUNT ($)</label>
          <input type="number" id="zyroAmt" value="1">
        </div>
        <div class="zyro-input-wrap">
          <label>FILTER MODE</label>
          <select id="zyroFilterMode">
            <option value="RELAXED" selected>RELAXED (Recommended)</option>
            <option value="OFF">OFF (Trade Every Signal)</option>
            <option value="STRICT">STRICT (High Confirm)</option>
          </select>
        </div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap">
          <label>MTG MULT (X)</label>
          <input type="number" id="zyroMtgMult" value="2.2" step="0.1">
        </div>
        <div class="zyro-input-wrap">
          <label>STOP LOSS ($)</label>
          <input type="number" id="zyroSL" value="15">
        </div>
      </div>

      <button class="zyro-btn zyro-btn-start" id="zyroToggleBtn">START AUTO TRADING</button>
      <button class="zyro-btn zyro-btn-instant" id="zyroInstantBtn">⚡ 1-CLICK INSTANT AI TRADE</button>
    </div>
    <div class="zyro-min-icon">ZYRO</div>
  `;
  document.body.appendChild(container);

  function showResultPopup(isWin, deltaText) {
    popup.className = isWin ? 'zyro-win-pop show' : 'zyro-loss-pop show';
    if (isWin) {
      popup.innerHTML = `🎉 PROFIT BOOKED! 💸<br><span style="font-size:9px; color:#a7f3d0;">${deltaText}</span>`;
      playSoundFX('win');
      speakVoice("Alhamdulillah! Profit booked!");
    } else {
      popup.innerHTML = `⚠️ LOSS DETECTED...<br><span style="font-size:9px; color:#fca5a5;">${deltaText}</span>`;
      playSoundFX('loss');
      speakVoice("Loss! Activating Martingale Recovery");
    }
    setTimeout(() => popup.classList.remove('show'), 2600);
  }

  // --- UI Controls & Dragging ---
  let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
  container.addEventListener("touchstart", function (e) {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON" && e.target.tagName !== "SELECT") {
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

  document.getElementById('zyroMinBtn').onclick = (e) => {
    e.stopPropagation();
    container.classList.add('zyro-minimized');
  };
  container.onclick = () => {
    if (container.classList.contains('zyro-minimized')) {
      container.classList.remove('zyro-minimized');
    }
  };
  document.getElementById('zyroCloseBtn').onclick = (e) => {
    e.stopPropagation();
    container.remove();
    popup.remove();
  };

  let activeMode = 'auto';
  const tabAuto = document.getElementById('tabAuto');
  const tabInstant = document.getElementById('tabInstant');
  const tabManual = document.getElementById('tabManual');
  const instantBtn = document.getElementById('zyroInstantBtn');
  const toggleBtn = document.getElementById('zyroToggleBtn');

  function setMode(mode) {
    activeMode = mode;
    tabAuto.classList.toggle('active', mode === 'auto');
    tabInstant.classList.toggle('active', mode === 'instant');
    tabManual.classList.toggle('active', mode === 'manual');

    if (mode === 'instant') {
      instantBtn.style.display = 'block';
      toggleBtn.style.display = 'none';
      speakVoice("Instant Mode Activated");
    } else {
      instantBtn.style.display = 'block';
      toggleBtn.style.display = 'block';
    }
  }

  tabAuto.onclick = () => setMode('auto');
  tabInstant.onclick = () => setMode('instant');
  tabManual.onclick = () => setMode('manual');

  const assetEl = document.getElementById('zyroAsset');
  const payoutEl = document.getElementById('zyroAssetPayout');
  const rsiEl = document.getElementById('zyroRSI');
  let currentActiveAsset = "";

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
      const match = pEl.innerText.match(/\d+/);
      if (match) return parseInt(match[0]);
    }
    return 85;
  }

  let lastKnownPrice = null;

  function getLiveRealPrice() {
    const priceNodes = document.querySelectorAll("[class*='current-price'], [class*='price-value'], [class*='value__val'], [class*='deal-finish'], [class*='chart-price'], .live-price, [class*='strike-price']");
    for (let el of priceNodes) {
      const txt = el.innerText.trim();
      const val = parseFloat(txt.replace(/[^0-9.]/g, ''));
      if (!isNaN(val) && val > 0 && /\d+\.\d{2,}/.test(txt)) {
        lastKnownPrice = val;
        return val;
      }
    }

    const chartArea = document.querySelector('.chart-container, #chart, canvas')?.parentElement || document.body;
    const candidates = chartArea.querySelectorAll('div, span');
    for (let i = candidates.length - 1; i >= Math.max(0, candidates.length - 150); i--) {
      const el = candidates[i];
      if (el.children.length === 0 && el.innerText) {
        const txt = el.innerText.trim();
        if (/^\d{1,5}\.\d{2,6}$/.test(txt)) {
          const val = parseFloat(txt);
          if (!isNaN(val) && val > 0 && val < 500000) {
            lastKnownPrice = val;
            return val;
          }
        }
      }
    }

    if (lastKnownPrice !== null) return lastKnownPrice;
    return 1.08450;
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
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => {
      if (btn.querySelector('.icon-arrow-up-circle') || btn.innerText.includes('Up') || btn.classList.contains('call-btn')) upBtn = btn;
      if (btn.querySelector('.icon-arrow-down-circle') || btn.innerText.includes('Down') || btn.classList.contains('put-btn')) downBtn = btn;
    });
    return { upBtn, downBtn };
  }

  // --- 3. TECHNICAL INDICATORS ENGINE ---
  let candleHistory = [];
  let curOpen = null, curHigh = null, curLow = null;

  function trackCurrentCandle(price, sec) {
    if (sec <= 1 || curOpen === null) {
      curOpen = price;
      curHigh = price;
      curLow = price;
    } else {
      if (price > curHigh) curHigh = price;
      if (price < curLow) curLow = price;
    }
  }

  function archiveCompletedCandle(closePrice) {
    if (curOpen !== null && curHigh !== null && curLow !== null) {
      const isGreen = closePrice >= curOpen;
      const body = Math.abs(closePrice - curOpen);
      const total = curHigh - curLow;
      const upperWick = curHigh - Math.max(curOpen, closePrice);
      const lowerWick = Math.min(curOpen, closePrice) - curLow;

      candleHistory.push({
        open: curOpen,
        high: curHigh,
        low: curLow,
        close: closePrice,
        isGreen,
        body,
        total,
        upperWick,
        lowerWick
      });

      if (candleHistory.length > 50) candleHistory.shift();
    }
  }

  function calculateRSI(period = 14) {
    if (candleHistory.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = candleHistory.length - period; i < candleHistory.length; i++) {
      let diff = candleHistory[i].close - candleHistory[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    let rs = avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
  }

  function calculateEMA(period) {
    if (candleHistory.length < period) return null;
    let k = 2 / (period + 1);
    let ema = candleHistory[0].close;
    for (let i = 1; i < candleHistory.length; i++) {
      ema = (candleHistory[i].close * k) + (ema * (1 - k));
    }
    return ema;
  }

  // --- 4. SMART BALANCED DECISION ENGINE ---
  function analyzeSmartTradingDecision(curPrice) {
    if (curOpen === null) {
      return { direction: "CALL", pattern: "DEFAULT BULLISH FLOW", confidence: 80 };
    }

    const curIsGreen = curPrice >= curOpen;
    const curBody = Math.abs(curPrice - curOpen);
    const curUpperWick = curHigh - Math.max(curOpen, curPrice);
    const curLowerWick = Math.min(curOpen, curPrice) - curLow;
    const prev = candleHistory.length > 0 ? candleHistory[candleHistory.length - 1] : null;

    let baseDir = curIsGreen ? "CALL" : "PUT";
    let rawPattern = curIsGreen ? "BULLISH MOMENTUM" : "BEARISH MOMENTUM";

    // 1. Core Candle Patterns
    if (prev && prev.body > 0.00005) {
      if (!prev.isGreen && curIsGreen && curBody > prev.body * 1.1) {
        baseDir = "CALL"; rawPattern = "BULLISH ENGULFING";
      } else if (prev.isGreen && !curIsGreen && curBody > prev.body * 1.1) {
        baseDir = "PUT"; rawPattern = "BEARISH ENGULFING";
      }
    }

    if (curLowerWick > curBody * 1.5 && curUpperWick < curBody * 0.7) {
      baseDir = "CALL"; rawPattern = "BULLISH HAMMER";
    } else if (curUpperWick > curBody * 1.5 && curLowerWick < curBody * 0.7) {
      baseDir = "PUT"; rawPattern = "SHOOTING STAR";
    }

    const filterMode = document.getElementById('zyroFilterMode')?.value || 'RELAXED';

    // If Filter is OFF, trade directly on price action without restrictions
    if (filterMode === 'OFF') {
      return { direction: baseDir, pattern: `${rawPattern} [NO FILTER]`, confidence: 90 };
    }

    // 2. Indicator Checks (Relaxed or Strict)
    const rsi = calculateRSI(14);
    const emaFast = calculateEMA(7);
    const emaSlow = calculateEMA(14);

    if (filterMode === 'RELAXED') {
      // Only block extreme RSI values (Over 82 or Under 18)
      if (baseDir === "CALL" && rsi > 82) return { direction: "WAIT", pattern: "EXTREME OVERBOUGHT (RSI > 82)" };
      if (baseDir === "PUT" && rsi < 18) return { direction: "WAIT", pattern: "EXTREME OVERSOLD (RSI < 18)" };
    } 
    else if (filterMode === 'STRICT') {
      if (baseDir === "CALL" && rsi > 70) return { direction: "WAIT", pattern: "RSI OVERBOUGHT (>70)" };
      if (baseDir === "PUT" && rsi < 30) return { direction: "WAIT", pattern: "RSI OVERSOLD (<30)" };
      
      if (emaFast && emaSlow) {
        if (baseDir === "CALL" && emaFast < emaSlow) return { direction: "WAIT", pattern: "EMA DOWNTREND FILTER" };
        if (baseDir === "PUT" && emaFast > emaSlow) return { direction: "WAIT", pattern: "EMA UPTREND FILTER" };
      }
    }

    return { direction: baseDir, pattern: rawPattern, confidence: 92 };
  }

  // --- 5. Execution & Risk Engine ---
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
  let isWaitingResult = false;
  let lastTradedMinute = -1;
  let lastTradeDirection = null;

  const cardConfluence = document.getElementById('zyroConfluence');
  const cardDir = document.getElementById('zyroDir');
  const clockEl = document.getElementById('zyroClock');
  const wlEl = document.getElementById('zyroWL');
  const mtgEl = document.getElementById('zyroMTG');
  const accEl = document.getElementById('zyroAcc');
  const netProfitEl = document.getElementById('zyroNetProfit');

  toggleBtn.onclick = () => {
    isRunning = !isRunning;
    if (isRunning) {
      baseAmount = parseFloat(document.getElementById('zyroAmt').value) || 1;
      currentAmount = baseAmount;
      mtgMultiplier = parseFloat(document.getElementById('zyroMtgMult').value) || 2.2;
      stopLossLimit = parseFloat(document.getElementById('zyroSL').value) || 15;
      currentStep = 0;

      toggleBtn.className = 'zyro-btn zyro-btn-stop';
      toggleBtn.innerText = 'STOP AUTO TRADING';
      playSoundFX('sniper');
      speakVoice("Zyro Auto Trading Started");
    } else {
      toggleBtn.className = 'zyro-btn zyro-btn-start';
      toggleBtn.innerText = 'START AUTO TRADING';
      cardDir.innerText = 'PAUSED';
      cardDir.style.color = '#00f2fe';
    }
  };

  instantBtn.onclick = () => {
    if (isWaitingResult) {
      alert("Wait for active trade to finish!");
      return;
    }

    let curP = getLiveRealPrice();
    baseAmount = parseFloat(document.getElementById('zyroAmt').value) || 1;
    if (currentStep === 0) currentAmount = baseAmount;

    let analysis = analyzeSmartTradingDecision(curP);

    if (analysis.direction === "WAIT") {
      // Force instant trade even if filtered
      analysis.direction = (curP >= (curOpen || curP)) ? 'CALL' : 'PUT';
      analysis.pattern = 'INSTANT OVERRIDE';
    }

    cardConfluence.innerText = `[INSTANT: ${analysis.pattern}]`;
    cardDir.innerText = analysis.direction === 'CALL' ? '▲ INSTANT CALL TAKEN' : '▼ INSTANT PUT TAKEN';
    cardDir.style.color = analysis.direction === 'CALL' ? '#00e676' : '#ef4444';

    executeSniperTrade(analysis.direction, `Instant ${analysis.pattern}`);
  };

  function executeSniperTrade(direction, patternName) {
    const { upBtn, downBtn } = getQuotexTradeButtons();
    setTradeAmount(currentAmount);

    const entryPrice = getLiveRealPrice();
    lastTradeDirection = direction;
    isWaitingResult = true;

    if (activeMode !== 'manual') {
      if (direction === 'CALL' && upBtn) {
        upBtn.click();
        playSoundFX('sniper');
      } else if (direction === 'PUT' && downBtn) {
        downBtn.click();
        playSoundFX('sniper');
      }
    } else {
      speakVoice(`Signal: ${direction}! ${patternName}`);
    }

    setTimeout(() => {
      const exitPrice = getLiveRealPrice();
      let isWin = false;

      if (entryPrice !== null && exitPrice !== null) {
        if (direction === 'CALL') isWin = (exitPrice > entryPrice);
        else if (direction === 'PUT') isWin = (exitPrice < entryPrice);
      }

      const payout = getActivePayout();
      const diff = (exitPrice !== null && entryPrice !== null) ? (exitPrice - entryPrice).toFixed(5) : "0";
      const deltaText = `Entry: ${entryPrice} → Exit: ${exitPrice} (Diff: ${diff})`;

      if (isWin) {
        wins++;
        const profitGain = currentAmount * (payout / 100);
        netProfit += profitGain;
        currentStep = 0;
        currentAmount = baseAmount;
        showResultPopup(true, deltaText);
      } else {
        losses++;
        netProfit -= currentAmount;
        currentStep++;
        if (currentStep <= 2) {
          currentAmount = parseFloat((currentAmount * mtgMultiplier).toFixed(2));
        } else {
          currentStep = 0;
          currentAmount = baseAmount;
        }
        showResultPopup(false, deltaText);
      }

      const total = wins + losses;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 100;
      accEl.innerText = `${winRate}%`;
      wlEl.innerText = `${wins} / ${losses}`;
      mtgEl.innerText = `Step ${currentStep}`;
      netProfitEl.innerText = `$${netProfit.toFixed(2)}`;
      netProfitEl.style.color = netProfit >= 0 ? '#00e676' : '#ef4444';
      isWaitingResult = false;

      if (netProfit <= -stopLossLimit) {
        alert(`⚠️ STOP LOSS HIT (-$${stopLossLimit}). Auto Trade Stopped!`);
        if (isRunning) toggleBtn.click();
      }
    }, 60000);
  }

  // --- Main 1-Second Precision Engine ---
  setInterval(() => {
    const curP = getLiveRealPrice();
    const d = new Date();
    const m = d.getMinutes();
    const s = d.getSeconds();
    clockEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (curP !== null) {
      trackCurrentCandle(curP, s);
      if (s === 59) archiveCompletedCandle(curP);
    }

    // Update RSI
    const currentRsi = calculateRSI(14);
    rsiEl.innerText = currentRsi;
    rsiEl.style.color = currentRsi > 70 ? '#ef4444' : (currentRsi < 30 ? '#00e676' : '#38bdf8');

    // Asset Detection
    const detectedAsset = getActiveQuotexAsset();
    const activePayout = getActivePayout();

    if (detectedAsset && detectedAsset !== currentActiveAsset) {
      currentActiveAsset = detectedAsset;
      assetEl.innerText = currentActiveAsset;
      payoutEl.innerText = `${activePayout}%`;

      candleHistory = [];
      curOpen = null;
      cardConfluence.innerText = `ACTIVE PAIR: ${currentActiveAsset}`;
      cardDir.innerText = 'READING CANDLES...';
      cardDir.style.color = '#38bdf8';
    }

    if (activeMode !== 'auto' || !isRunning || isWaitingResult) return;

    if (s >= 45 && s <= 56) {
      let analysis = analyzeSmartTradingDecision(curP);

      // Martingale ALWAYS forces trade execution (bypasses filter)
      if (currentStep > 0 && lastTradeDirection) {
        analysis.direction = lastTradeDirection;
        analysis.pattern = `Martingale Recovery Step ${currentStep}`;
      }

      cardConfluence.innerText = `[${analysis.pattern}]`;
      if (analysis.direction === 'WAIT') {
        cardDir.innerText = '✋ FILTERED (HOLDING)';
        cardDir.style.color = '#f59e0b';
      } else {
        cardDir.innerText = `${analysis.direction === 'CALL' ? '▲ SNIPER CALL' : '▼ SNIPER PUT'} (${58 - s}s)`;
        cardDir.style.color = analysis.direction === 'CALL' ? '#00e676' : '#ef4444';
      }
    }
    else if (s === 58 && lastTradedMinute !== m) {
      lastTradedMinute = m;
      let analysis = analyzeSmartTradingDecision(curP);

      // Martingale ALWAYS forces trade execution
      if (currentStep > 0 && lastTradeDirection) {
        analysis.direction = lastTradeDirection;
        analysis.pattern = `Martingale Recovery Step ${currentStep}`;
      }

      if (analysis.direction !== 'WAIT') {
        cardConfluence.innerText = `[${analysis.pattern}]`;
        cardDir.innerText = analysis.direction === 'CALL' ? '▲ AUTO CALL EXECUTED' : '▼ AUTO PUT EXECUTED';
        cardDir.style.color = analysis.direction === 'CALL' ? '#00e676' : '#ef4444';

        executeSniperTrade(analysis.direction, analysis.pattern);
      } else {
        console.log(`[ZYRO ULTRA] Signal skipped at 58s due to ${analysis.pattern}`);
      }
    } 
    else if (s < 45) {
      cardConfluence.innerText = `READY | CANDLES: ${candleHistory.length}`;
      cardDir.innerText = 'WATCHING MARKET...';
      cardDir.style.color = '#00f2fe';
    }
  }, 1000);

  speakVoice("Zyro Ultra V3 System Ready");
})();
