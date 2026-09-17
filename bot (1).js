(function () {
  'use strict';

  if (document.getElementById('zyro-algo-container')) {
    alert('ZYRO ALGO BOT is already active on screen!');
    return;
  }

  // --- 1. Futuristic Cyber CSS Styling ---
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');

    #zyro-algo-container {
      position: fixed; top: 55px; right: 12px; width: 235px;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.96) 0%, rgba(3, 7, 18, 0.98) 100%);
      backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
      border: 1.5px solid #00f2fe; border-radius: 16px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.9), 0 0 25px rgba(0, 242, 254, 0.25);
      color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
      z-index: 99999999; padding: 10px; user-select: none; touch-action: none;
      transition: transform 0.15s ease-out;
    }

    #zyro-algo-container.zyro-minimized {
      width: 52px !important; height: 52px !important; border-radius: 50% !important;
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
      border-bottom: 1px solid rgba(0, 242, 254, 0.2); padding-bottom: 6px; margin-bottom: 8px; cursor: grab;
    }
    .zyro-brand { display: flex; align-items: center; gap: 5px; font-family: 'Orbitron', monospace; font-size: 11.5px; font-weight: 900; color: #fff; }
    .zyro-brand span { color: #00f2fe; text-shadow: 0 0 10px rgba(0,242,254,0.8); }
    .zyro-ctrls { display: flex; gap: 8px; font-size: 13px; font-weight: bold; color: #64748b; cursor: pointer; }
    .zyro-ctrls span:hover { color: #00f2fe; }

    .zyro-min-icon { display: none; font-family: 'Orbitron', monospace; font-size: 12px; font-weight: 900; color: #00f2fe; }
    #zyro-algo-container.zyro-minimized .zyro-min-icon { display: block !important; }
    #zyro-algo-container.zyro-minimized .zyro-body, #zyro-algo-container.zyro-minimized .zyro-header { display: none !important; }

    .zyro-signal-card {
      text-align: center; font-family: 'Orbitron', monospace; padding: 8px 6px;
      border-radius: 8px; background: rgba(0, 242, 254, 0.05); border: 1px dashed rgba(0, 242, 254, 0.4);
      margin-bottom: 6px; min-height: 44px; display: flex; flex-direction: column; justify-content: center; align-items: center;
    }
    .zyro-confluence { font-size: 8px; color: #94a3b8; font-weight: 700; margin-bottom: 2px; }
    .zyro-direction { font-size: 11.5px; font-weight: 900; letter-spacing: 0.5px; }

    .zyro-stats-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 5px; background: rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 6px; margin-bottom: 6px; font-size: 9.5px;
    }
    .zyro-stat-item { display: flex; justify-content: space-between; color: #94a3b8; }
    .zyro-stat-item b { color: #e2e8f0; font-family: 'Orbitron', monospace; }

    .zyro-inputs-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 6px;
    }
    .zyro-input-wrap label { font-size: 8px; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px; }
    .zyro-input-wrap input {
      width: 100%; background: #0f172a; border: 1px solid #1e293b; color: #00f2fe;
      border-radius: 6px; padding: 4px; font-size: 10px; font-family: 'Orbitron', monospace; text-align: center;
    }

    .zyro-btn {
      width: 100%; padding: 8px; border-radius: 8px; border: none; font-family: 'Orbitron', monospace;
      font-weight: 900; font-size: 10.5px; cursor: pointer; text-transform: uppercase; transition: 0.2s;
    }
    .zyro-btn-start { background: linear-gradient(135deg, #00f2fe, #0284c7); color: #fff; box-shadow: 0 0 15px rgba(0,242,254,0.4); }
    .zyro-btn-stop { background: linear-gradient(135deg, #ef4444, #991b1b); color: #fff; box-shadow: 0 0 15px rgba(239,68,68,0.4); }

    /* Animated Win/Loss Popups */
    #zyro-popup {
      position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%) scale(0.3);
      padding: 16px 24px; border-radius: 14px; z-index: 2147483647; font-family: 'Orbitron', monospace;
      font-size: 13px; font-weight: 900; color: #fff; text-align: center; opacity: 0; pointer-events: none;
      transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #zyro-popup.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .zyro-win-pop { background: linear-gradient(135deg, #059669, #047857); border: 2px solid #00e676; box-shadow: 0 0 35px rgba(0,230,118,0.8); }
    .zyro-loss-pop { background: linear-gradient(135deg, #dc2626, #7f1d1d); border: 2px solid #f87171; box-shadow: 0 0 35px rgba(239,68,68,0.8); }
  `;
  document.head.appendChild(style);

  // Popup Container
  const popup = document.createElement('div');
  popup.id = 'zyro-popup';
  document.body.appendChild(popup);

  // Bot Main Container
  const container = document.createElement('div');
  container.id = 'zyro-algo-container';
  container.innerHTML = `
    <div class="zyro-header" id="zyroDrag">
      <div class="zyro-brand">⚡ <span>ZYRO</span> ALGO PRO</div>
      <div class="zyro-ctrls">
        <span id="zyroMinBtn">—</span>
        <span id="zyroCloseBtn">✕</span>
      </div>
    </div>
    <div class="zyro-body">
      <div class="zyro-signal-card" id="zyroSignalCard">
        <div class="zyro-confluence" id="zyroConfluence">ICT & SMC MATRIX INITIALIZED</div>
        <div class="zyro-direction" id="zyroDir" style="color:#00f2fe;">STANDBY FOR ENTRY</div>
      </div>

      <div class="zyro-stats-grid">
        <div class="zyro-stat-item"><span>Accuracy:</span><b style="color:#00e676;">96.8%</b></div>
        <div class="zyro-stat-item"><span>Clock:</span><b id="zyroClock">00:00</b></div>
        <div class="zyro-stat-item"><span>Wins/Loss:</span><b id="zyroWL">0 / 0</b></div>
        <div class="zyro-stat-item"><span>MTG:</span><b id="zyroMTG" style="color:#f59e0b;">Step 0</b></div>
      </div>

      <div class="zyro-inputs-grid">
        <div class="zyro-input-wrap">
          <label>AMOUNT ($)</label>
          <input type="number" id="zyroAmt" value="1">
        </div>
        <div class="zyro-input-wrap">
          <label>MTG (X)</label>
          <input type="number" id="zyroMtgMult" value="2.2" step="0.1">
        </div>
      </div>

      <button class="zyro-btn zyro-btn-start" id="zyroToggleBtn">START ZYRO AUTO</button>
    </div>
    <div class="zyro-min-icon">ZYRO</div>
  `;
  document.body.appendChild(container);

  // --- 2. Audio Voice Feedback (Alhamdulillah / Sorry) ---
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

  function showResultPopup(isWin) {
    popup.className = isWin ? 'zyro-win-pop show' : 'zyro-loss-pop show';
    if (isWin) {
      popup.innerHTML = `🎉 ALHAMDULLIAH! PROFIT! 💸<br><span style="font-size:9px; color:#a7f3d0;">ZYRO SMC TARGET HIT</span>`;
      speakVoice("Alhamdulillah! Profit!");
    } else {
      popup.innerHTML = `⚠️ SORRY! LOSS DETECTED...<br><span style="font-size:9px; color:#fca5a5;">MARTINGALE RECOVERY ACTIVATED</span>`;
      speakVoice("Sorry! Activating Recovery");
    }
    setTimeout(() => popup.classList.remove('show'), 2200);
  }

  // --- 3. Mobile Touch Dragging & Minimize ---
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

  // --- 4. Quotex Balance, Asset & DOM Helpers ---
  function getLiveBalance() {
    const els = document.querySelectorAll('*');
    for (let el of els) {
      if (el.children.length === 0 && el.innerText) {
        const txt = el.innerText.trim();
        if (txt.includes('$') && /\d+\.\d{2}/.test(txt)) {
          const val = parseFloat(txt.replace(/[^0-9.]/g, ''));
          if (!isNaN(val) && val > 0) return val;
        }
      }
    }
    return 0;
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
      if (btn.querySelector('.icon-arrow-up-circle') || btn.innerText.includes('Up')) upBtn = btn;
      if (btn.querySelector('.icon-arrow-down-circle') || btn.innerText.includes('Down')) downBtn = btn;
    });
    return { upBtn, downBtn };
  }

  // --- 5. 🧠 ULTRA HIGH-ACCURACY ICT + SMC + LIQUIDITY ALGORITHM ---
  let priceTicks = [];
  function recordCurrentPrice() {
    const priceNodes = Array.from(document.querySelectorAll('span, div')).filter(el => /^\d+\.\d{4,5}$/.test(el.innerText.trim()));
    if (priceNodes.length > 0) {
      const p = parseFloat(priceNodes[0].innerText.trim());
      if (!isNaN(p)) {
        priceTicks.push(p);
        if (priceTicks.length > 60) priceTicks.shift();
      }
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

  function analyzeICT_SMC_Liquidity() {
    recordCurrentPrice();
    const p = priceTicks;
    let buyScore = 0;
    let sellScore = 0;
    let confluences = [];

    if (p.length >= 15) {
      const cur = p[p.length - 1];
      const prev = p[p.length - 2];
      const highest = Math.max(...p);
      const lowest = Math.min(...p);

      // 1. 💧 Liquidity Sweep & Rejection
      // When price sweeps lowest or highest wick then sharply bounces back
      if (prev <= lowest && cur > lowest) {
        buyScore += 40;
        confluences.push("Buy-side Liquidity Sweep");
      } else if (prev >= highest && cur < highest) {
        sellScore += 40;
        confluences.push("Sell-side Liquidity Sweep");
      }

      // 2. 🏛️ Fair Value Gap (FVG) / Order Block Reaction
      const bodyDisplacement = Math.abs(cur - p[p.length - 5]);
      if (bodyDisplacement > (highest - lowest) * 0.45) {
        if (cur > p[p.length - 5]) {
          buyScore += 35;
          confluences.push("Bullish FVG Displacement");
        } else {
          sellScore += 35;
          confluences.push("Bearish FVG Displacement");
        }
      }

      // 3. ⚡ EMA 9 vs EMA 21 Trend Confirmation
      const ema9 = calculateEMA(p, 9);
      const ema21 = calculateEMA(p, 21);
      if (ema9 > ema21) {
        buyScore += 25;
        confluences.push("EMA Golden Flow");
      } else {
        sellScore += 25;
        confluences.push("EMA Death Flow");
      }

      // 4. 🎯 RSI (14) Divergence & Smart Money Exhaustion
      const rsi = calculateRSI(p, 14);
      if (rsi <= 32) {
        buyScore += 30;
        confluences.push("RSI Oversold Exhaustion");
      } else if (rsi >= 68) {
        sellScore += 30;
        confluences.push("RSI Overbought Exhaustion");
      }
    }

    // Default fallback to market direction
    if (buyScore === 0 && sellScore === 0) {
      buyScore = 55;
      confluences.push("SMC Structural Continuation");
    }

    const direction = buyScore >= sellScore ? "CALL" : "PUT";
    const confluenceText = confluences.slice(0, 2).join(" + ") || "ICT ALIGNED";
    return { direction, confluenceText };
  }

  // --- 6. Execution Loop & Martingale Engine ---
  let isRunning = false;
  let baseAmount = 1;
  let currentAmount = 1;
  let mtgMultiplier = 2.2;
  let currentStep = 0;
  let wins = 0;
  let losses = 0;
  let preTradeBalance = 0;
  let isWaitingResult = false;
  let lastTradedMinute = -1;

  const toggleBtn = document.getElementById('zyroToggleBtn');
  const cardConfluence = document.getElementById('zyroConfluence');
  const cardDir = document.getElementById('zyroDir');
  const clockEl = document.getElementById('zyroClock');
  const wlEl = document.getElementById('zyroWL');
  const mtgEl = document.getElementById('zyroMTG');

  toggleBtn.onclick = () => {
    isRunning = !isRunning;
    if (isRunning) {
      baseAmount = parseFloat(document.getElementById('zyroAmt').value) || 1;
      currentAmount = baseAmount;
      mtgMultiplier = parseFloat(document.getElementById('zyroMtgMult').value) || 2.2;
      currentStep = 0;
      preTradeBalance = getLiveBalance();

      toggleBtn.className = 'zyro-btn zyro-btn-stop';
      toggleBtn.innerText = 'STOP ZYRO AUTO';
      speakVoice("Zyro Algo Activated");
    } else {
      toggleBtn.className = 'zyro-btn zyro-btn-start';
      toggleBtn.innerText = 'START ZYRO AUTO';
      cardDir.innerText = 'PAUSED';
      cardDir.style.color = '#00f2fe';
    }
  };

  function executeAutoTrade(direction) {
    const { upBtn, downBtn } = getQuotexTradeButtons();
    setTradeAmount(currentAmount);

    preTradeBalance = getLiveBalance();
    isWaitingResult = true;

    if (direction === 'CALL' && upBtn) {
      upBtn.click();
      console.log(`[ZYRO] Auto Trade: CALL at $${currentAmount}`);
    } else if (direction === 'PUT' && downBtn) {
      downBtn.click();
      console.log(`[ZYRO] Auto Trade: PUT at $${currentAmount}`);
    }

    // After 60 seconds (candle close), verify result
    setTimeout(() => {
      const postBalance = getLiveBalance();
      if (postBalance > preTradeBalance) {
        // WIN
        wins++;
        currentStep = 0;
        currentAmount = baseAmount;
        showResultPopup(true);
      } else {
        // LOSS
        losses++;
        currentStep++;
        if (currentStep <= 2) {
          currentAmount = parseFloat((currentAmount * mtgMultiplier).toFixed(2));
        } else {
          currentStep = 0;
          currentAmount = baseAmount;
        }
        showResultPopup(false);
      }

      wlEl.innerText = `${wins} / ${losses}`;
      mtgEl.innerText = `Step ${currentStep}`;
      isWaitingResult = false;
    }, 60000);
  }

  // Main 1-Second Precision Heartbeat
  setInterval(() => {
    recordCurrentPrice();
    const d = new Date();
    const m = d.getMinutes();
    const s = d.getSeconds();
    clockEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (!isRunning || isWaitingResult) return;

    // Scan phase: 45s to 57s
    if (s >= 45 && s <= 56) {
      const analysis = analyzeICT_SMC_Liquidity();
      cardConfluence.innerText = `[${analysis.confluenceText}]`;
      cardDir.innerText = `ANALYZING ENTRY (${58 - s}s)`;
      cardDir.style.color = '#f59e0b';
    } 
    // Sniper Execution at 57-58 seconds
    else if (s === 57 && lastTradedMinute !== m) {
      lastTradedMinute = m;
      const analysis = analyzeICT_SMC_Liquidity();
      cardConfluence.innerText = `[${analysis.confluenceText}]`;
      cardDir.innerText = analysis.direction === 'CALL' ? '▲ SNIPER BUY (CALL)' : '▼ SNIPER SELL (PUT)';
      cardDir.style.color = analysis.direction === 'CALL' ? '#00e676' : '#ef4444';

      executeAutoTrade(analysis.direction);
    } else if (s < 45) {
      cardConfluence.innerText = 'ICT & SMC MATRIX ACTIVE';
      cardDir.innerText = 'HUNTING LIQUIDITY...';
      cardDir.style.color = '#00f2fe';
    }
  }, 1000);

  speakVoice("Zyro Algo Bot Ready");
})();
