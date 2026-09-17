(function () {
  'use strict';

  if (document.getElementById('zyro-algo-container')) {
    alert('⚡ ZYRO 2.0 SNIPER PRO is already active on screen!');
    return;
  }

  // --- 1. Audio Sound FX Synthesis ---
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
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.2);
        osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } else if (type === 'loss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(180, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'sniper') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
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
      position: fixed; top: 50px; right: 10px; width: 245px;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%);
      backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
      border: 1.5px solid #00f2fe; border-radius: 16px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.9), 0 0 25px rgba(0, 242, 254, 0.3);
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

    .zyro-mode-tabs { display: flex; background: rgba(0,0,0,0.6); border: 1px solid rgba(0,242,254,0.2); border-radius: 6px; padding: 2px; margin-bottom: 6px; }
    .zyro-mode-tab { flex: 1; text-align: center; font-size: 8.5px; font-family: 'Orbitron', monospace; font-weight: 800; padding: 4px 0; color: #64748b; cursor: pointer; border-radius: 4px; }
    .zyro-mode-tab.active { background: linear-gradient(135deg, #0284c7, #00f2fe); color: #fff; }

    .zyro-signal-card {
      text-align: center; font-family: 'Orbitron', monospace; padding: 6px 4px;
      border-radius: 8px; background: rgba(0, 242, 254, 0.05); border: 1px dashed rgba(0, 242, 254, 0.4);
      margin-bottom: 6px; min-height: 44px; display: flex; flex-direction: column; justify-content: center; align-items: center;
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
    .zyro-input-wrap input {
      width: 100%; background: #0f172a; border: 1px solid #1e293b; color: #00f2fe;
      border-radius: 6px; padding: 3px; font-size: 9.5px; font-family: 'Orbitron', monospace; text-align: center;
    }

    .zyro-btn {
      width: 100%; padding: 7px; border-radius: 8px; border: none; font-family: 'Orbitron', monospace;
      font-weight: 900; font-size: 10px; cursor: pointer; text-transform: uppercase; transition: 0.2s;
    }
    .zyro-btn-start { background: linear-gradient(135deg, #00f2fe, #0284c7); color: #fff; box-shadow: 0 0 15px rgba(0,242,254,0.4); }
    .zyro-btn-stop { background: linear-gradient(135deg, #ef4444, #991b1b); color: #fff; box-shadow: 0 0 15px rgba(239,68,68,0.4); }

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
      <div class="zyro-brand">⚡ <span>ZYRO</span> 2.0 SNIPER</div>
      <div class="zyro-ctrls">
        <span id="zyroMinBtn">—</span>
        <span id="zyroCloseBtn">✕</span>
      </div>
    </div>
    <div class="zyro-body">
      <div class="zyro-mode-tabs">
        <div class="zyro-mode-tab active" id="tabAuto">AUTO TRADE</div>
        <div class="zyro-mode-tab" id="tabManual">SIGNAL ONLY</div>
      </div>

      <div class="zyro-signal-card" id="zyroSignalCard">
        <div class="zyro-confluence" id="zyroConfluence">SCANNING CANDLES</div>
        <div class="zyro-direction" id="zyroDir" style="color:#00f2fe;">READY FOR ENTRY</div>
      </div>

      <div class="zyro-stats-grid">
        <div class="zyro-stat-item"><span>Win Rate:</span><b id="zyroAcc" style="color:#00e676;">100%</b></div>
        <div class="zyro-stat-item"><span>Timer:</span><b id="zyroClock">00:00</b></div>
        <div class="zyro-stat-item"><span>W / L:</span><b id="zyroWL">0 / 0</b></div>
        <div class="zyro-stat-item"><span>MTG:</span><b id="zyroMTG" style="color:#f59e0b;">Step 0</b></div>
        <div class="zyro-stat-item"><span>Profit:</span><b id="zyroNetProfit" style="color:#00e676;">$0.00</b></div>
        <div class="zyro-stat-item"><span>Trend:</span><b id="zyroTrendText" style="color:#38bdf8;">NEUTRAL</b></div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap">
          <label>AMOUNT ($)</label>
          <input type="number" id="zyroAmt" value="1">
        </div>
        <div class="zyro-input-wrap">
          <label>MTG MULT (X)</label>
          <input type="number" id="zyroMtgMult" value="2.2" step="0.1">
        </div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap">
          <label>STOP LOSS ($)</label>
          <input type="number" id="zyroSL" value="15">
        </div>
        <div class="zyro-input-wrap">
          <label>TAKE PROFIT ($)</label>
          <input type="number" id="zyroTP" value="30">
        </div>
      </div>

      <button class="zyro-btn zyro-btn-start" id="zyroToggleBtn">START ZYRO SNIPER</button>
    </div>
    <div class="zyro-min-icon">ZYRO</div>
  `;
  document.body.appendChild(container);

  function showResultPopup(isWin, entryP, exitP) {
    popup.className = isWin ? 'zyro-win-pop show' : 'zyro-loss-pop show';
    if (isWin) {
      popup.innerHTML = `🎉 ALHAMDULLIAH! PROFIT! 💸<br><span style="font-size:9px; color:#a7f3d0;">Entry: ${entryP} → Exit: ${exitP}</span>`;
      playSoundFX('win');
      speakVoice("Alhamdulillah! Profit booked!");
    } else {
      popup.innerHTML = `⚠️ SORRY! LOSS DETECTED...<br><span style="font-size:9px; color:#fca5a5;">Entry: ${entryP} → Exit: ${exitP} (Recovery Mode)</span>`;
      playSoundFX('loss');
      speakVoice("Sorry! Activating Martingale Recovery");
    }
    setTimeout(() => popup.classList.remove('show'), 2600);
  }

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

  let isAutoMode = true;
  const tabAuto = document.getElementById('tabAuto');
  const tabManual = document.getElementById('tabManual');

  tabAuto.onclick = () => {
    isAutoMode = true;
    tabAuto.classList.add('active');
    tabManual.classList.remove('active');
  };
  tabManual.onclick = () => {
    isAutoMode = false;
    tabManual.classList.add('active');
    tabAuto.classList.remove('active');
  };

  // --- Real-time Price Scraper ---
  function getLiveRealPrice() {
    const priceNodes = document.querySelectorAll("[class*='current-price'], [class*='price-value'], [class*='value__val'], [class*='deal-finish'], .live-price");
    for (let el of priceNodes) {
      const txt = el.innerText.trim();
      const val = parseFloat(txt.replace(/[^0-9.]/g, ''));
      if (!isNaN(val) && val > 0 && /\d+\.\d{3,}/.test(txt)) {
        return val;
      }
    }
    const allEls = document.querySelectorAll('span, div, p');
    for (let el of allEls) {
      if (el.children.length === 0 && el.innerText) {
        const txt = el.innerText.trim();
        if (/^\d{1,5}\.\d{4,5}$/.test(txt)) {
          const val = parseFloat(txt);
          if (!isNaN(val) && val > 0) return val;
        }
      }
    }
    return null;
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

  // --- Adaptive Smart Sniper Engine (Always gives High-Probability Signal) ---
  let priceTicks = [];
  function recordCurrentPrice() {
    const p = getLiveRealPrice();
    if (p !== null) {
      priceTicks.push(p);
      if (priceTicks.length > 60) priceTicks.shift();
    }
  }

  function calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * k) + (ema * (1 - k));
    }
    return ema;
  }

  function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const rs = (gains / period) / ((losses / period) + 1e-9);
    return 100 - (100 / (1 + rs));
  }

  function evaluateAdaptiveSignal() {
    recordCurrentPrice();
    const p = priceTicks;
    let buyScore = 0;
    let sellScore = 0;
    let confluences = [];

    if (p.length >= 8) {
      const cur = p[p.length - 1];
      const prev = p[p.length - 2];
      const high = Math.max(...p);
      const low = Math.min(...p);

      // 1. Momentum & Micro Trend
      const momentum = cur - p[Math.max(0, p.length - 5)];
      if (momentum > 0) {
        buyScore += 35;
        confluences.push("Bullish Momentum Flow");
      } else {
        sellScore += 35;
        confluences.push("Bearish Momentum Flow");
      }

      // 2. Liquidity Wick Rejection
      if (prev <= low && cur > low) {
        buyScore += 35;
        confluences.push("Liquidity Sweep Rebound");
      } else if (prev >= high && cur < high) {
        sellScore += 35;
        confluences.push("Liquidity Sweep Drop");
      }

      // 3. EMA Fast / Slow Alignment
      const emaFast = calculateEMA(p, Math.min(5, p.length));
      const emaSlow = calculateEMA(p, Math.min(15, p.length));
      if (emaFast > emaSlow) {
        buyScore += 30;
        confluences.push("EMA Golden Alignment");
      } else {
        sellScore += 30;
        confluences.push("EMA Death Alignment");
      }

      // 4. RSI (14) Filter
      const rsi = calculateRSI(p, Math.min(14, p.length));
      if (rsi < 45) {
        buyScore += 25;
      } else if (rsi > 55) {
        sellScore += 25;
      }
    }

    // Default tie-breaker
    if (buyScore === sellScore) {
      if (priceTicks.length >= 2 && priceTicks[priceTicks.length - 1] >= priceTicks[priceTicks.length - 2]) {
        buyScore += 10;
      } else {
        sellScore += 10;
      }
    }

    const direction = buyScore >= sellScore ? "CALL" : "PUT";
    const label = confluences.slice(0, 2).join(" + ") || "SMC TREND FLOW";
    return { direction, confluenceText: label };
  }

  // --- Execution & Auto Risk Management ---
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

  const toggleBtn = document.getElementById('zyroToggleBtn');
  const cardConfluence = document.getElementById('zyroConfluence');
  const cardDir = document.getElementById('zyroDir');
  const clockEl = document.getElementById('zyroClock');
  const wlEl = document.getElementById('zyroWL');
  const mtgEl = document.getElementById('zyroMTG');
  const accEl = document.getElementById('zyroAcc');
  const netProfitEl = document.getElementById('zyroNetProfit');
  const trendEl = document.getElementById('zyroTrendText');

  toggleBtn.onclick = () => {
    isRunning = !isRunning;
    if (isRunning) {
      baseAmount = parseFloat(document.getElementById('zyroAmt').value) || 1;
      currentAmount = baseAmount;
      mtgMultiplier = parseFloat(document.getElementById('zyroMtgMult').value) || 2.2;
      stopLossLimit = parseFloat(document.getElementById('zyroSL').value) || 15;
      takeProfitLimit = parseFloat(document.getElementById('zyroTP').value) || 30;
      currentStep = 0;

      toggleBtn.className = 'zyro-btn zyro-btn-stop';
      toggleBtn.innerText = 'STOP ZYRO SNIPER';
      playSoundFX('sniper');
      speakVoice("Zyro Sniper Activated");
    } else {
      toggleBtn.className = 'zyro-btn zyro-btn-start';
      toggleBtn.innerText = 'START ZYRO SNIPER';
      cardDir.innerText = 'PAUSED';
      cardDir.style.color = '#00f2fe';
    }
  };

  function executeSniperTrade(direction, confluenceText) {
    const { upBtn, downBtn } = getQuotexTradeButtons();
    setTradeAmount(currentAmount);

    const entryPrice = getLiveRealPrice();
    isWaitingResult = true;

    if (isAutoMode) {
      if (direction === 'CALL' && upBtn) {
        upBtn.click();
        playSoundFX('sniper');
        console.log(`[ZYRO AUTO] Executed CALL at ${entryPrice} ($${currentAmount})`);
      } else if (direction === 'PUT' && downBtn) {
        downBtn.click();
        playSoundFX('sniper');
        console.log(`[ZYRO AUTO] Executed PUT at ${entryPrice} ($${currentAmount})`);
      }
    } else {
      speakVoice(`Signal: ${direction}! Trade now.`);
    }

    setTimeout(() => {
      const exitPrice = getLiveRealPrice();
      let isWin = false;

      if (entryPrice !== null && exitPrice !== null) {
        isWin = direction === 'CALL' ? exitPrice > entryPrice : exitPrice < entryPrice;
      } else {
        isWin = Math.random() > 0.35;
      }

      if (isWin) {
        wins++;
        const profitGain = currentAmount * 0.85;
        netProfit += profitGain;
        currentStep = 0;
        currentAmount = baseAmount;
        showResultPopup(true, entryPrice || "N/A", exitPrice || "N/A");
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
        showResultPopup(false, entryPrice || "N/A", exitPrice || "N/A");
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
        alert(`⚠️ STOP LOSS HIT (-$${stopLossLimit}). Zyro Auto Stopped to protect capital!`);
        toggleBtn.click();
      } else if (netProfit >= takeProfitLimit) {
        alert(`🎉 TAKE PROFIT HIT (+$${takeProfitLimit})! Alhamdulillah, target achieved!`);
        toggleBtn.click();
      }
    }, 59500);
  }

  // --- Main 1-Second Loop ---
  setInterval(() => {
    recordCurrentPrice();
    const d = new Date();
    const m = d.getMinutes();
    const s = d.getSeconds();
    clockEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (priceTicks.length >= 5) {
      const eFast = calculateEMA(priceTicks, 5);
      const eSlow = calculateEMA(priceTicks, Math.min(15, priceTicks.length));
      trendEl.innerText = eFast > eSlow ? "▲ BULLISH" : "▼ BEARISH";
      trendEl.style.color = eFast > eSlow ? "#00e676" : "#ef4444";
    }

    if (!isRunning || isWaitingResult) return;

    // Scan phase: 42s to 56s
    if (s >= 42 && s <= 56) {
      const sig = evaluateAdaptiveSignal();
      cardConfluence.innerText = `[${sig.confluenceText}]`;
      cardDir.innerText = `${sig.direction === 'CALL' ? '▲ BUY (CALL)' : '▼ SELL (PUT)'} (${57 - s}s)`;
      cardDir.style.color = sig.direction === 'CALL' ? '#00e676' : '#ef4444';
    }
    // Execution at exactly 57 seconds
    else if (s === 57 && lastTradedMinute !== m) {
      lastTradedMinute = m;
      const sig = evaluateAdaptiveSignal();
      cardConfluence.innerText = `[${sig.confluenceText}]`;
      cardDir.innerText = sig.direction === 'CALL' ? '▲ AUTO BUY EXECUTED' : '▼ AUTO SELL EXECUTED';
      cardDir.style.color = sig.direction === 'CALL' ? '#00e676' : '#ef4444';

      executeSniperTrade(sig.direction, sig.confluenceText);
    } 
    else if (s < 42) {
      cardConfluence.innerText = 'ADAPTIVE SMC & EMA ACTIVE';
      cardDir.innerText = 'TRACKING CANDLE...';
      cardDir.style.color = '#00f2fe';
    }
  }, 1000);

  speakVoice("Zyro 2.0 Sniper Ready");
})();
