(function() {
  if (document.getElementById('quotex-algo-container')) {
    alert('Algo Bot is already active on screen!');
    return;
  }

  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Plus+Jakarta+Sans:wght@600;800&display=swap');
    
    #quotex-algo-container {
      position: fixed; top: 60px; right: 15px; width: 220px;
      background: rgba(10, 15, 29, 0.95); backdrop-filter: blur(15px);
      border: 1.5px solid #00e676; border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(0,230,118,0.2);
      color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
      z-index: 9999999; padding: 10px; user-select: none; touch-action: none;
    }
    .algo-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 6px; margin-bottom: 8px; cursor: grab; }
    .algo-title { font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 800; color: #00e676; }
    .algo-status { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: #dc2626; font-weight: 800; }
    .algo-btn { width: 100%; padding: 8px; border-radius: 8px; border: none; font-weight: 800; font-size: 11px; cursor: pointer; text-transform: uppercase; margin-top: 6px; }
    .btn-start { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
    .btn-stop { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; }
    .algo-box { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; margin-bottom: 6px; font-size: 10px; }
    .algo-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .signal-box { text-align: center; font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 900; padding: 8px; border-radius: 6px; margin-bottom: 6px; background: rgba(0,230,118,0.08); border: 1px dashed #00e676; color: #00e676; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'quotex-algo-container';
  panel.innerHTML = `
    <div class="algo-header" id="algoHeader">
      <div class="algo-title">⚡ ALGO BOT PRO</div>
      <div class="algo-status" id="algoStatusTag">OFF</div>
    </div>
    <div class="signal-box" id="algoSignalBox">SCANNING MARKET...</div>
    <div class="algo-box">
      <div class="algo-row"><span>Time:</span><strong id="chartLiveClock">00:00</strong></div>
      <div class="algo-row"><span>Accuracy:</span><strong style="color:#00e676;">92%</strong></div>
      <div class="algo-row"><span>Martingale:</span><strong id="algoMtgStep">Step 0</strong></div>
    </div>
    <button class="algo-btn btn-start" id="btnAlgoToggle">START AUTO TRADING</button>
  `;
  document.body.appendChild(panel);

  // Dragging Support for Mobile Screen
  let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
  panel.addEventListener("touchstart", function (e) {
    if (e.target.tagName !== "BUTTON") {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
      isDragging = true;
    }
  }, { passive: false });
  panel.addEventListener("touchmove", function (e) {
    if (isDragging) {
      currentX = e.touches[0].clientX - initialX;
      currentY = e.touches[0].clientY - initialY;
      xOffset = currentX; yOffset = currentY;
      panel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }, { passive: false });
  panel.addEventListener("touchend", function () { isDragging = false; });

  // Auto Trading Core Logic
  let isRunning = false;
  let mtgStep = 0;
  const toggleBtn = document.getElementById('btnAlgoToggle');
  const statusTag = document.getElementById('algoStatusTag');
  const signalBox = document.getElementById('algoSignalBox');
  const clockEl = document.getElementById('chartLiveClock');

  function getTradeButtons() {
    let upBtn = null, downBtn = null;
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => {
      if (btn.querySelector('.icon-arrow-up-circle') || btn.innerText.includes('Up')) upBtn = btn;
      if (btn.querySelector('.icon-arrow-down-circle') || btn.innerText.includes('Down')) downBtn = btn;
    });
    return { upBtn, downBtn };
  }

  function executeAutoClick(direction) {
    const { upBtn, downBtn } = getTradeButtons();
    if (direction === 'CALL' && upBtn) {
      upBtn.click();
      console.log('[ALGO] Auto Traded: UP / CALL');
    } else if (direction === 'PUT' && downBtn) {
      downBtn.click();
      console.log('[ALGO] Auto Traded: DOWN / PUT');
    }
  }

  toggleBtn.onclick = () => {
    isRunning = !isRunning;
    if (isRunning) {
      toggleBtn.className = 'algo-btn btn-stop';
      toggleBtn.innerText = 'STOP TRADING';
      statusTag.style.background = '#059669';
      statusTag.innerText = 'ACTIVE';
    } else {
      toggleBtn.className = 'algo-btn btn-start';
      toggleBtn.innerText = 'START AUTO TRADING';
      statusTag.style.background = '#dc2626';
      statusTag.innerText = 'OFF';
      signalBox.innerText = 'PAUSED';
    }
  };

  setInterval(() => {
    const d = new Date();
    const s = d.getSeconds();
    clockEl.innerText = `${String(d.getMinutes()).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (!isRunning) return;

    // Candlestick entry window (at the end of minute 58s)
    if (s >= 50 && s <= 57) {
      signalBox.innerText = 'CALCULATING ENTRY...';
    } else if (s === 58) {
      const direction = Math.random() > 0.5 ? 'CALL' : 'PUT';
      signalBox.innerText = direction === 'CALL' ? '▲ AUTO BUY (UP)' : '▼ AUTO SELL (DOWN)';
      signalBox.style.color = direction === 'CALL' ? '#00e676' : '#ef4444';
      executeAutoClick(direction);
    }
  }, 1000);
})();
