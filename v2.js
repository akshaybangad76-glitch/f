/* PLAY7 — ULTRA RELIABLE: Multi-Method Swipe Detection + FULL BYPASS + STRICT GAME RULES */
(function(){

  /* ============================================================
     FULL BYPASS
       • Console filter  → hides "Amondo: Using amondo web sdk…"
       • amo.imprint.create wrapper → forces isAnalyticsEnabled:false
       • Sentry / PostHog / network / bot-detect / 404 rescue
     ============================================================ */
  (function FULL_BYPASS(){
    const _log = console.log.bind(console);
    const TAG  = '%c[BYPASS]%c';
    const S1   = 'background:#dc2626;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold';
    const log  = (m,c)=>_log(TAG,S1,'color:'+(c||'#fca5a5'),m);

    /* 0. Console filter — kill the Amondo banner */
    const isAmoBanner = args => args.some(x =>
      typeof x === 'string' && (
        x.includes('Amondo: Using amondo') ||
        x.includes('Amondo WebSDK')
      )
    );
    ['log','error','warn','info'].forEach(k=>{
      const orig = console[k].bind(console);
      console[k] = function(...args){
        if(isAmoBanner(args)) return;
        return orig(...args);
      };
    });

    /* 1. Sentry init guard */
    try{ window.__amondo_sentry_initialized__ = true; }catch(_){}

    /* 2. Sentry kill */
    function killSentry(){
      try{
        const S = window.Sentry;
        if(!S) return;
        try{ S.init = () => null; }catch(_){}
        const c = S.getClient?.();
        if(c){
          try{ c.getOptions().enabled = false; }catch(_){}
          try{ c.close?.(); }catch(_){}
          try{ const t = c.getTransport?.(); if(t) t.send = () => Promise.resolve({}); }catch(_){}
        }
        ['captureException','captureMessage','captureEvent','addBreadcrumb']
          .forEach(k=>{ try{ S[k] = () => ''; }catch(_){} });
      }catch(_){}
    }
    killSentry();

    /* 3. PostHog kill */
    function killPostHog(){
      try{
        const ph = window.posthog;
        if(!ph) return;
        ['capture','captureException','captureLog','identify','alias','group',
         'register','register_once','register_for_session',
         'setPersonProperties','setPersonPropertiesForFlags',
         'reloadFeatureFlags','reset']
          .forEach(k=>{ try{ ph[k] = () => {}; }catch(_){} });
        try{ ph._is_bot                 = () => false; }catch(_){}
        try{ ph.is_capturing            = () => false; }catch(_){}
        try{ ph.has_opted_out_capturing = () => true;  }catch(_){}
        try{ ph.has_opted_in_capturing  = () => false; }catch(_){}
        if(ph.consent){
          try{ ph.consent.isOptedOut = () => true;  }catch(_){}
          try{ ph.consent.isOptedIn  = () => false; }catch(_){}
          try{ ph.consent.isRejected = () => true;  }catch(_){}
        }
        if(ph.featureFlags){
          try{ ph.featureFlags.getFeatureFlag   = () => null;  }catch(_){}
          try{ ph.featureFlags.isFeatureEnabled = () => false; }catch(_){}
        }
      }catch(_){}
    }
    killPostHog();

    /* 4. Force analytics off at the SDK API surface */
    function wrapAmo(){
      try{
        const a = window.amo;
        if(!a || !a.imprint || typeof a.imprint.create !== 'function') return false;
        if(a.imprint.__p7wrapped) return true;
        const orig = a.imprint.create;
        a.imprint.create = function(container, opts){
          const o = Object.assign({}, opts || {}, {
            isAnalyticsEnabled:   false,
            isCookieConsentGiven: false
          });
          return orig.call(this, container, o);
        };
        a.imprint.__p7wrapped = true;
        log('amo.imprint.create wrapped — analytics forced OFF','#22c55e');
        return true;
      }catch(_){ return false; }
    }
    if(!wrapAmo()){
      const t = setInterval(()=>{ if(wrapAmo()) clearInterval(t); }, 20);
      setTimeout(()=>clearInterval(t), 15000);
    }

    /* 5. Bot-detect spoof */
    try{
      Object.defineProperty(navigator,'webdriver',      {get:()=>false,    configurable:true});
      const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      Object.defineProperty(navigator,'userAgent',      {get:()=>UA,        configurable:true});
      Object.defineProperty(navigator,'userAgentData',  {get:()=>undefined, configurable:true});
      Object.defineProperty(navigator,'platform',       {get:()=>'Win32',   configurable:true});
      Object.defineProperty(navigator,'maxTouchPoints', {get:()=>0,         configurable:true});
    }catch(_){}

    /* 6. Kill window-level error reporters */
    try{ window.onerror = null; }catch(_){}
    try{ window.onunhandledrejection = null; }catch(_){}

    /* 7. Network block */
    const BLOCK = [
      'sentry.io','betterstackdata.com',
      'analytics-ph.amondo.com','posthog.com','i.posthog.com',
      'us.i.posthog.com','eu.i.posthog.com','app.posthog.com'
    ];
    const hit = u => BLOCK.some(h => String(u || '').includes(h));

    try{
      const of = window.fetch;
      window.fetch = function(input, init){
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if(hit(url)) return Promise.resolve(
          new Response('{}',{status:200,headers:{'Content-Type':'application/json'}})
        );
        return of.apply(this, arguments);
      };
    }catch(_){}

    try{
      const OX = window.XMLHttpRequest;
      const NX = function(){
        const x = new OX();
        const o = x.open;
        x.open = function(m,u){
          if(hit(u)){ this.__p7blocked = true; return; }
          return o.apply(x, arguments);
        };
        const os = x.send;
        x.send = function(){
          if(this.__p7blocked) return;
          return os.apply(x, arguments);
        };
        return x;
      };
      NX.prototype = OX.prototype;
      window.XMLHttpRequest = NX;
    }catch(_){}

    try{
      if(navigator.sendBeacon){
        const os = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function(u,d){ if(hit(u)) return true; return os(u,d); };
      }
    }catch(_){}

    /* 8. Continuous re-apply */
    setInterval(()=>{ killSentry(); killPostHog(); wrapAmo(); }, 500);

    /* 9. 404 sprite rescue (heart-*.png etc.) */
    try{
      window.__P7_MISSING__ = new WeakMap();
      const NAME_RE = /box-(thunder|gully|firefox|heart|trap)/i;
      const PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
      if(d && d.set){
        Object.defineProperty(HTMLImageElement.prototype,'src',{
          configurable:true,
          get:d.get,
          set:function(v){
            const raw  = String(v||'');
            const name = raw.split('/').pop().split('?')[0];
            if(NAME_RE.test(name)){
              this.addEventListener('error', () => {
                try{
                  window.__P7_MISSING__.set(this, name);
                  d.set.call(this, PLACEHOLDER);
                }catch(_){}
              }, {once:true});
            }
            return d.set.call(this, v);
          }
        });
      }
    }catch(_){}

    log('active — banner + Sentry + PostHog + bot-detect + beacons OFF','#22c55e');
  })();
  /* ================== END BYPASS ============================== */


  /* ---------- original PLAY7 below ----------------------------- */
  if(window.PLAY7 && window.PLAY7.__live){
    try{ PLAY7.stop(); }catch(_){}
  }
  try{ window.PLAY6 && PLAY6.stop && PLAY6.stop(); }catch(_){}
  try{ window.PLAY5 && PLAY5.stop && PLAY5.stop(); }catch(_){}
  try{ window.PLAY4 && PLAY4.stop && PLAY4.stop(); }catch(_){}

  /* ============================================================
     CONFIG  —  FAST + ACCURATE: Balanced timing for rapid boxes
     ============================================================ */
  const CFG = {
    reactionMin: 40,         // Wait 40ms after box appears (fast but human-like)
    reactionMax: 80,         // Wait max 80ms after box appears
    jitterPx: 0.5,           // Minimal pointer jitter
    distMin: 0.36,
    distMax: 0.46,
    evGapMin: 2,             // 2 ms between pointer events (fast)
    evGapMax: 4,             // Small random delay
    boxGoneMs: 60,           // Box gone detection
    postSwipeGraceMs: 150,   // 150 ms after pointerup before accepting next box
    angleConfidenceMin: 0.95, // High confidence (balanced)
    minAngleSamples: 5,      // Minimum 5 consistent samples (fast)
    maxAngleVariance: 0.15,  // Max radians variance (reasonable tolerance)
    consecutiveRequired: 5,  // 5 consecutive same-direction readings
    boxStableWaitMs: 60,     // Wait 60ms after box appears (fast)
    maxReadingsBuffer: 12,   // Buffer size
    minBoxVisibleMs: 80,     // Box must be visible for 80ms (fast)
    maxAngleChangePerFrame: 0.5, // Max angle change per frame (relaxed)
    directionLockFrames: 5,  // 5 frames with same direction (fast)
    minSwipeWindowMs: 70,    // Minimum time before a swipe can execute
    highScoreMode: false     // Only changed manually (never inferred from sprite size)
  };

  /* ============================================================
     GAME RULES  —  strict mapping, no wrong-side swipes
       arrow  (thunder / gully / firefox)  →  SAME as arrow rotation
       life   (heart)                      →  SAME as arrow rotation
       trap   (trap)                       →  OPPOSITE of arrow rotation
     `INVERT_KINDS` is the single source of truth — flip it once if
     the game ever changes its rules and the whole loop follows.
     ============================================================ */
  const INVERT_KINDS = new Set(['trap']);          // kinds that must be inverted
  const SAME_KINDS   = new Set(['arrow','life']);  // kinds that follow the arrow

  const rnd  = (a,b)=>a+Math.random()*(b-a);
  const rndi = (a,b)=>Math.floor(rnd(a,b+1));

  const S = {
    __live:true,
    box:null,
    swiped:false,
    swipeInProgress:false,
    boxIdCounter:0,
    lastSwipedBoxId:-1,
    count:0,
    wrong:0,
    stats:{up:0,down:0,left:0,right:0,trap:0,life:0,arrow:0},
    log:[],
    lastAngle:null,
    angleReadings:[],      // buffer for multi-sample angle averaging
    spriteCenter:null,     // cached box center from drawImage
    swipeAt:0,
    swipeAtBefore:0,
    lastBoxName:null,
    busyUntil:0,
    consecutiveSameDir:0,  // track consecutive same-direction readings for validation
    lockedDirection:null,  // locked direction after passing all checks
    directionLockCount:0,  // counter for direction lock frames
    boxStableStartTime:0,  // timestamp when box first appeared and stabilized
    swipeIntervals:[]      // intervals between recent successful swipes (ms)
  };

  const P='%c[P7]%c ', S1='background:#f59e0b;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold';
  const L=(m,c)=>console.log(P,S1,'color:'+(c||'#fcd34d'),m);

  const frame = ()=>[...document.querySelectorAll('iframe')].find(f=>(f.getAttribute('src')||'').includes('/game'));
  const win   = ()=>{try{return frame()?.contentWindow||null}catch(_){return null}};
  const cv    = ()=>{try{return frame()?.contentDocument?.querySelector('canvas')||null}catch(_){return null}};

  /* Map a canvas-rotation angle (radians) to a swipe direction.
     Canvas Y is down, so:
        -45°..45°    → right
         45°..135°   → down
        135°..180°/-180°..-135° → left
        -135°..-45°  → up                                         */
  function angleToDir(a){
    const t = Math.PI*2;
    a = a - t*Math.floor((a+Math.PI)/t);
    const d = a*180/Math.PI;
    if(d>=-45 && d<45)   return 'right';
    if(d>=45  && d<135)  return 'down';
    if(d>=135 || d<-135) return 'left';
    return 'up';
  }

  /* ------------------------------------------------------------------
     FAST ANGLE DETECTION - Quick validation for rapid boxes
     Collects angle readings and validates consistency quickly.
     Optimized for speed while maintaining accuracy.
     ------------------------------------------------------------------ */
  function addAngleReading(angle, timestamp){
    const dir = angleToDir(angle);

    // Use per-box adaptive config if available, otherwise fall back to global CFG.
    const cfg = S.box || {};
    const minSamples = cfg.minSamples || CFG.minAngleSamples;
    const maxVariance = cfg.maxVariance || CFG.maxAngleVariance;
    const maxChange = cfg.maxAngleChange || CFG.maxAngleChangePerFrame;
    const lockFrames = cfg.lockFrames || CFG.directionLockFrames;
    const maxBuffer = cfg.maxReadingsBuffer || CFG.maxReadingsBuffer;
    const consecutiveReq = cfg.consecutiveRequired || CFG.consecutiveRequired;

    // Check angle change rate
    let angleChangeValid = true;
    if(S.angleReadings.length > 0){
      const lastReading = S.angleReadings[S.angleReadings.length - 1];
      const angleChange = Math.abs(angle - lastReading.angle);
      const normalizedChange = angleChange > Math.PI ? 2*Math.PI - angleChange : angleChange;
      if(normalizedChange > maxChange){
        angleChangeValid = false;
      }
    }

    S.angleReadings.push({ angle, dir, t: timestamp, valid: angleChangeValid });

    // Keep only last N readings for averaging
    if(S.angleReadings.length > maxBuffer) S.angleReadings.shift();

    // Check if ALL recent readings agree on direction
    const checkCount = Math.min(S.angleReadings.length, minSamples);
    const recent = S.angleReadings.slice(-checkCount);
    const dirs = recent.map(r => r.dir);
    const allSame = dirs.every(d => d === dirs[0]);

    // Calculate angle variance
    let variance = 0;
    if(recent.length >= 2){
      const angles = recent.map(r => r.angle);
      const avg = angles.reduce((s,a) => s+a, 0) / angles.length;
      variance = angles.reduce((max, a) => Math.max(max, Math.abs(a - avg)), 0);
    }

    // Validate: all same direction AND low variance AND enough samples
    const hasEnoughSamples = S.angleReadings.length >= minSamples;
    const hasLowVariance = variance <= maxVariance;
    const isDirectionConsistent = allSame && checkCount >= minSamples;

    if(allSame){
      S.consecutiveSameDir++;
    } else {
      S.consecutiveSameDir = 0;
    }

    // Direction lock counter
    if(allSame && hasLowVariance && hasEnoughSamples){
      S.directionLockCount++;
      if(S.directionLockCount >= lockFrames && !S.lockedDirection){
        S.lockedDirection = dirs[0];
      }
    } else {
      S.directionLockCount = Math.max(0, S.directionLockCount - 1);
      if(S.directionLockCount === 0){
        S.lockedDirection = null;
      }
    }

    // Calculate average angle from consistent readings
    const avgAngle = recent.reduce((sum, r) => sum + r.angle, 0) / recent.length;

    // Confidence scoring
    let confidence = 0.0;
    const passesAllChecks = hasEnoughSamples && hasLowVariance && isDirectionConsistent &&
                           S.directionLockCount >= lockFrames;

    if(passesAllChecks){
      confidence = 1.0;
    } else if(hasEnoughSamples && hasLowVariance && isDirectionConsistent){
      confidence = 0.95;
    } else if(S.angleReadings.length >= 5 && allSame && hasLowVariance){
      confidence = 0.85;
    } else if(S.angleReadings.length >= 3 && allSame){
      confidence = 0.7;
    } else {
      confidence = 0.3;
    }

    return {
      dir: angleToDir(avgAngle),
      lockedDir: S.lockedDirection,
      confidence: confidence,
      avgAngle: avgAngle,
      readingCount: S.angleReadings.length,
      variance: variance,
      passesAllChecks: passesAllChecks,
      directionLockCount: S.directionLockCount
    };
  }

  /* Fallback direction detector for ultra-fast boxes: takes the majority
     direction among the most recent readings. Useful when the arrow doesn't
     stay stable long enough for the strict lock-based validation. */
  function getMajorityReading(){
    const n = S.angleReadings.length;
    if(n < 3) return null;
    const recent = S.angleReadings.slice(-6);
    const counts = {};
    recent.forEach(r => { counts[r.dir] = (counts[r.dir] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const [bestDir, bestCount] = sorted[0];
    if(bestCount < 3) return null;
    const majority = recent.filter(r => r.dir === bestDir);
    const avgAngle = majority.reduce((s,r) => s + r.angle, 0) / majority.length;
    return {
      dir: bestDir,
      avgAngle,
      count: bestCount,
      total: recent.length,
      confidence: bestCount / recent.length
    };
  }

  function clearAngleReadings(){
    S.angleReadings = [];
    S.consecutiveSameDir = 0;
    S.spriteCenter = null;
    S.lockedDirection = null;
    S.directionLockCount = 0;
    S.boxStableStartTime = 0;
  }

  /* ------------------------------------------------------------------
     Sprite → kind mapping.  Extend the regex if the game adds more
     arrow variants; every unknown `box-*` sprite defaults to 'arrow'.
     ------------------------------------------------------------------ */
  const BOX_RE = /box-(thunder|gully|firefox|heart|trap)/i;
  function boxKind(nm){
    if(/trap/i.test(nm))    return 'trap';
    if(/heart/i.test(nm))   return 'life';
    if(/thunder/i.test(nm)) return 'arrow';
    if(/gully/i.test(nm))   return 'arrow';
    if(/firefox/i.test(nm)) return 'arrow';
    return 'arrow';
  }

  /* ------------------------------------------------------------------
     Apply the game rule.  Exactly one of the two sets decides whether
     the arrow direction is kept or inverted.  Unknown kind → keep
     (safe default so we never swipe wrong on an unrecognised sprite).
     ------------------------------------------------------------------ */
  const opp = d => d==='up'?'down' : d==='down'?'up' : d==='left'?'right' : 'left';

  function applyRule(kind, arrowDir){
    if(INVERT_KINDS.has(kind)) return { dir: opp(arrowDir), rule: 'INVERT' };
    if(SAME_KINDS.has(kind))   return { dir: arrowDir,      rule: 'SAME'   };
    return { dir: arrowDir, rule: 'SAME(default)' };
  }

  /* Speed measurement: use recent successful swipe intervals to detect when
     the game speeds up, without reading the score or sprite size. */
  function medianSwipeInterval(){
    const arr = S.swipeIntervals;
    if(arr.length < 3) return 1000; // default = slow
    const sorted = [...arr].sort((a,b) => a - b);
    return sorted[Math.floor(sorted.length/2)];
  }

  function speedFactor(interval){
    if(interval > 250) return 1.0;   // slow / early game
    if(interval > 180) return 0.80;
    if(interval > 140) return 0.68;
    if(interval > 110) return 0.58;
    if(interval > 90)  return 0.50;
    if(interval > 70)  return 0.42;
    return 0.36;                     // very fast
  }

  function hook(w){
    if(!w || w.__P7__) return false;
    w.__P7__ = true;
    const proto = w.CanvasRenderingContext2D.prototype;

    const MISSING = window.__P7_MISSING__;
    const nameOf = img => {
      try{
        if(MISSING && img && MISSING.get(img)) return MISSING.get(img);
      }catch(_){}
      const raw = (img && (img.currentSrc || img.src)) || '';
      return raw.split('/').pop().split('?')[0];
    };

    /* drawImage hook: registers each new box instance */
    const oDI = proto.drawImage;
    proto.drawImage = function(img, ...a){
      let r;
      try{ r = oDI.apply(this, [img, ...a]); }
      catch(_){ return; }   // 404'd sprite → don't kill hook

      try{
        let dw,dh,dx,dy;
        if(a.length>=8){ dw=a[6]; dh=a[7]; dx=a[4]; dy=a[5]; }
        else if(a.length>=4){ dw=a[2]; dh=a[3]; dx=a[0]; dy=a[1]; }
        else return r;
        if(dw<60||dh<60||dw>260||dh>260) return r;

        const nm = nameOf(img);
        if(!nm || !BOX_RE.test(nm)) return r;

        const now = performance.now();
        const sameName   = S.box && S.box.name === nm;
        const stillAlive = S.box && (now - S.box.t) < CFG.boxGoneMs;

        // Cache sprite center / radius for multi-method validation
        S.spriteCenter = { x: dx + dw/2, y: dy + dh/2, r: Math.hypot(dw,dh)/2, t: now };

        if(sameName && stillAlive){
          S.box.t = now;
          // Update box stable start time if not already set
          if(S.boxStableStartTime === 0) S.boxStableStartTime = now;
          return r;
        }

        // Adapt per-box thresholds to measured game speed (swipe intervals).
        // No score or sprite size is used.
        const factor = speedFactor(medianSwipeInterval());
        const reactionMinEff = Math.max(15, Math.round(CFG.reactionMin * factor));
        const reactionMaxEff = Math.max(reactionMinEff + 5, Math.round(CFG.reactionMax * factor));
        const minVisibleEff = Math.max(22, Math.round(CFG.minBoxVisibleMs * factor));
        const minSamplesEff = Math.max(3, Math.round(CFG.minAngleSamples * factor));
        const lockFramesEff = Math.max(2, Math.round(CFG.directionLockFrames * factor));
        const varianceEff = CFG.maxAngleVariance + (1 - factor) * 0.15;
        const angleChangeEff = CFG.maxAngleChangePerFrame + (1 - factor) * 0.6;

        S.boxIdCounter++;
        S.box = {
          id: S.boxIdCounter,
          name: nm,
          kind: boxKind(nm),
          t: now,
          first: now,
          readyAt: now + rnd(reactionMinEff, reactionMaxEff),
          minVisible: minVisibleEff,
          minSamples: minSamplesEff,
          lockFrames: lockFramesEff,
          maxVariance: varianceEff,
          maxAngleChange: angleChangeEff
        };
        S.swiped = false;
        S.lastAngle = null;
        S.boxStableStartTime = now;  // Set box stable start time
        clearAngleReadings();  // Reset angle buffer for new box
      }catch(_){}
      return r;
    };

    /* fill hook: captures the arrow's rotation from getTransform()
       MULTI-METHOD: Now uses addAngleReading for validation.
       Only accepts fills whose origin is inside/near the current box,
       ignoring score/text/particle fills that pollute the angle buffer. */
    const oF = proto.fill;
    proto.fill = function(...args){
      try{
        if(!S.box) return oF.apply(this, args); // no active box yet
        const t = this.getTransform();
        if(Math.hypot(t.a,t.b) > 0.3){
          const angle = Math.atan2(t.b,t.a);
          const ts = performance.now();

          // Only keep fills originating from inside the current box.
          if(S.spriteCenter){
            const dtx = t.e - S.spriteCenter.x;
            const dty = t.f - S.spriteCenter.y;
            if(Math.hypot(dtx, dty) > S.spriteCenter.r * 1.4){
              return oF.apply(this, args);
            }
          }

          // Store raw angle for fallback
          S.lastAngle = { angle, t: ts };

          // Add to multi-sample buffer for validation
          addAngleReading(angle, ts);
        }
      }catch(_){}
      return oF.apply(this,args);
    };

    /* stroke hook: some arrow variants are stroked instead of filled */
    const oS = proto.stroke;
    proto.stroke = function(...args){
      try{
        if(!S.box) return oS.apply(this, args); // no active box yet
        const t = this.getTransform();
        if(Math.hypot(t.a,t.b) > 0.3){
          const angle = Math.atan2(t.b,t.a);
          const ts = performance.now();

          // Only keep strokes originating from inside the current box.
          if(S.spriteCenter){
            const dtx = t.e - S.spriteCenter.x;
            const dty = t.f - S.spriteCenter.y;
            if(Math.hypot(dtx, dty) > S.spriteCenter.r * 1.4){
              return oS.apply(this, args);
            }
          }

          S.lastAngle = { angle, t: ts };
          addAngleReading(angle, ts);
        }
      }catch(_){}
      return oS.apply(this,args);
    };
    return true;
  }

  function swipe(dir){
    const c = cv(), w = win(); if(!c||!w) return false;
    const dist = Math.min(c.width, c.height) * rnd(CFG.distMin, CFG.distMax);
    const rect = c.getBoundingClientRect();
    const cx = rect.left + rect.width/2  + rnd(-CFG.jitterPx, CFG.jitterPx);
    const cy = rect.top  + rect.height/2 + rnd(-CFG.jitterPx, CFG.jitterPx);

    let dx=0, dy=0;
    if(dir==='up')    dy=-dist;
    if(dir==='down')  dy= dist;
    if(dir==='left')  dx=-dist;
    if(dir==='right') dx= dist;

    const mx1=cx+dx*0.35+rnd(-1,1), my1=cy+dy*0.35+rnd(-1,1);
    const mx2=cx+dx*0.75+rnd(-1,1), my2=cy+dy*0.75+rnd(-1,1);
    const ex =cx+dx+rnd(-1,1),      ey =cy+dy+rnd(-1,1);

    const fire=(t,x,y)=>{
      const o={bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y};
      try{ c.dispatchEvent(new w.PointerEvent(t,{...o,pointerId:1,pointerType:'touch',isPrimary:true,button:0})); }catch(_){}
      try{ c.dispatchEvent(new w.MouseEvent(t.replace('pointer','mouse'),{...o,button:0})); }catch(_){}
    };

    /* 1 ms gaps — the tightest pointer cadence browsers still deliver
       without coalescing the gesture into a single tap. */
    const g1 = rndi(CFG.evGapMin, CFG.evGapMax);
    const g2 = rndi(CFG.evGapMin, CFG.evGapMax);
    const g3 = rndi(CFG.evGapMin, CFG.evGapMax);

    fire('pointerdown', cx, cy);
    setTimeout(()=>{
      fire('pointermove', mx1, my1);
      setTimeout(()=>{
        fire('pointermove', mx2, my2);
        setTimeout(()=>fire('pointerup', ex, ey), g3);
      }, g2);
    }, g1);

    const grace = Math.max(5, Math.round(CFG.postSwipeGraceMs * speedFactor(medianSwipeInterval())));
    S.busyUntil = performance.now() + g1 + g2 + g3 + grace;
    return true;
  }

  let running = true;
  function tick(){
    if(!running) return;
    const now = performance.now();

    if(S.swipeInProgress && now >= S.busyUntil){ S.swipeInProgress = false; }
    if(S.swipeInProgress){ requestAnimationFrame(tick); return; }
    if(now < S.busyUntil){ requestAnimationFrame(tick); return; }
    if(S.swiped){ requestAnimationFrame(tick); return; }
    if(!S.box || S.box.id === S.lastSwipedBoxId){ requestAnimationFrame(tick); return; }
    if(!S.lastAngle){ requestAnimationFrame(tick); return; }
    if(now < S.box.readyAt){ requestAnimationFrame(tick); return; }
    if(S.lastAngle.t < S.box.first){ requestAnimationFrame(tick); return; }
    if((now - S.box.first) > 1500){ requestAnimationFrame(tick); return; }

    /* ================================================================
       FAST + ACCURATE DIRECTION VALIDATION - Quick response for rapid boxes
       Balanced validation that's fast enough for quick box sequences.
       ================================================================ */
    let arrowDir, angleUsed, confidence = 0, validated = null;
    const boxAge = now - S.box.first;
    
    // Always add current reading to buffer
    validated = addAngleReading(S.lastAngle.angle, now);
    confidence = validated.confidence;
    
    // Check if box has been visible long enough (per-box adaptive threshold)
    const boxVisibleLongEnough = boxAge >= S.box.minVisible;
    const hasLockedDirection = validated.lockedDir !== null;
    
    // HIGH SCORE MODE: Stricter validation only when manually enabled
    const minSamplesForHighScore = CFG.highScoreMode ? 8 : S.box.minSamples;
    const confidenceForHighScore = CFG.highScoreMode ? 0.98 : CFG.angleConfidenceMin;
    
    // BALANCED VALIDATION: Must pass key checks but faster
    const allChecksPass = 
      validated.passesAllChecks &&                    // validation passed
      validated.readingCount >= minSamplesForHighScore && // enough consistent samples
      confidence >= confidenceForHighScore &&         // confidence threshold
      boxVisibleLongEnough &&                         // box visible long enough
      hasLockedDirection;                             // direction is locked
    
    if(allChecksPass){
      // Use locked direction if available, otherwise use validated direction
      arrowDir = validated.lockedDir || validated.dir;
      angleUsed = validated.avgAngle;
      L(`✓ VALIDATED [${arrowDir.toUpperCase()}] conf=${confidence.toFixed(3)}, samples=${validated.readingCount}`, '#22c55e');
    } else {
      // DO NOT SWIPE - wait for more readings or box to stabilize
      const reasons = [];
      if(!validated.passesAllChecks) reasons.push('!checks');
      if(confidence < CFG.angleConfidenceMin) reasons.push('!conf');
      if(!boxVisibleLongEnough) reasons.push('!visible');
      if(!hasLockedDirection) reasons.push('!locked');
      L(`⏳ WAITING: ${reasons.join(', ')} | conf=${confidence.toFixed(3)}, samples=${validated.readingCount}, minVis=${S.box.minVisible}`, '#f59e0b');
      requestAnimationFrame(tick);
      return;
    }
    
    const { dir: swipeDir, rule } = applyRule(S.box.kind, arrowDir);

    S.swiped = true;
    S.swipeInProgress = true;
    S.lastSwipedBoxId = S.box.id;
    S.count++;
    S.stats[swipeDir]++;
    S.stats[S.box.kind]++;

    if(S.log.length>80) S.log.shift();
    S.log.push({
      id: S.box.id,
      name: S.box.name,
      kind: S.box.kind,
      angle: (angleUsed*180/Math.PI).toFixed(0),
      arrow: arrowDir,
      rule,
      swipe: swipeDir,
      delay: Math.round(now - S.box.first),
      confidence: confidence,
      variance: validated.variance,
      samples: validated.readingCount
    });

    const tag = S.box.kind === 'trap' ? '[TRAP→OPP]'
              : S.box.kind === 'life' ? '[LIFE]'
              : '[ARROW]';
    const col = S.box.kind === 'trap' ? '#f59e0b'
              : S.box.kind === 'life' ? '#ef4444'
              : '#22d3ee';

    L(`→ ${swipeDir.toUpperCase()} #${S.count} ${tag} rule=${rule} arrow=${arrowDir} sprite=${S.box.name} delay=${Math.round(now-S.box.first)}ms`, col);

    swipe(swipeDir);
    S.swipeAt = performance.now();
    // Track swipe cadence so thresholds can adapt to speed without reading score.
    if(S.swipeAt > 0){
      const interval = S.swipeAt - (S.swipeAtBefore || 0);
      if(interval > 10 && interval < 2000){
        S.swipeIntervals.push(interval);
        if(S.swipeIntervals.length > 12) S.swipeIntervals.shift();
      }
      S.swipeAtBefore = S.swipeAt;
    }
    S.lastBoxName = S.box.name;

    // Clear angle buffer after successful swipe
    clearAngleReadings();

    requestAnimationFrame(tick);
  }

  if(!hook(win())){
    const mo = new MutationObserver(()=>{ if(hook(win())) mo.disconnect(); });
    mo.observe(document.body,{childList:true,subtree:true});
  }

  let tries=0;
  const boot = setInterval(()=>{
    const c=cv();
    if(c){
      clearInterval(boot);
      L(`✓ canvas ${c.width}x${c.height} — one-swipe-per-box loop started`,'#22c55e');
      requestAnimationFrame(tick);
    }
    else if(++tries>100){ clearInterval(boot); L('canvas nahi mila — "Play" dabao','#f59e0b'); }
  },200);

  window.PLAY7 = {
    __live:true,
    stop(){ running=false; L('stopped. swipes='+S.count); console.table(S.stats); },
    stats(){ console.table(S.stats); console.table(S.log); },
    box(){return S.box;},
    angle(){return S.lastAngle;},
    cfg(){return {...CFG};},
    rules(){return {invert:[...INVERT_KINDS], same:[...SAME_KINDS]};},
    setRule(kind, mode){
      if(mode==='invert'){ SAME_KINDS.delete(kind); INVERT_KINDS.add(kind); }
      else              { INVERT_KINDS.delete(kind); SAME_KINDS.add(kind); }
      L(`rule ${kind} → ${mode.toUpperCase()}`);
    },
    setCfg(k,v){ if(k in CFG){ CFG[k]=v; L('cfg.'+k+' = '+v); } },
    fast(){
      CFG.reactionMin=40; CFG.reactionMax=80; CFG.evGapMin=2; CFG.evGapMax=4;
      CFG.boxGoneMs=60; CFG.postSwipeGraceMs=150;
      CFG.angleConfidenceMin=0.95; CFG.minAngleSamples=5; CFG.maxAngleVariance=0.15;
      CFG.consecutiveRequired=5; CFG.boxStableWaitMs=60;
      CFG.maxReadingsBuffer=12; CFG.minBoxVisibleMs=80;
      CFG.maxAngleChangePerFrame=0.5; CFG.directionLockFrames=5;
      CFG.minSwipeWindowMs=70;
      L('FAST mode - Quick response for rapid boxes')
    },
    ultra(){
      CFG.reactionMin=80; CFG.reactionMax=120; CFG.evGapMin=3; CFG.evGapMax=6;
      CFG.boxGoneMs=80; CFG.postSwipeGraceMs=250;
      CFG.angleConfidenceMin=0.999; CFG.minAngleSamples=10; CFG.maxAngleVariance=0.04;
      CFG.consecutiveRequired=10; CFG.boxStableWaitMs=150;
      CFG.maxReadingsBuffer=20; CFG.minBoxVisibleMs=180;
      CFG.maxAngleChangePerFrame=0.25; CFG.directionLockFrames=12;
      CFG.minSwipeWindowMs=100;
      L('ULTRA RELIABLE mode - Maximum accuracy')
    },
    human(){
      CFG.reactionMin=100; CFG.reactionMax=150; CFG.evGapMin=4; CFG.evGapMax=8;
      CFG.boxGoneMs=100; CFG.postSwipeGraceMs=300;
      CFG.angleConfidenceMin=0.9999; CFG.minAngleSamples=12; CFG.maxAngleVariance=0.03;
      CFG.consecutiveRequired=12; CFG.boxStableWaitMs=180;
      CFG.maxReadingsBuffer=25; CFG.minBoxVisibleMs=200;
      CFG.maxAngleChangePerFrame=0.2; CFG.directionLockFrames=15;
      CFG.minSwipeWindowMs=120;
      L('HUMAN MODE - Slow human-like timing')
    },
    highscore(){
      // Manual timing preset only; sprite size is never used to infer score.
      CFG.reactionMin=30; CFG.reactionMax=60; CFG.evGapMin=1; CFG.evGapMax=3;
      CFG.boxGoneMs=50; CFG.postSwipeGraceMs=100;
      CFG.angleConfidenceMin=0.97; CFG.minAngleSamples=7; CFG.maxAngleVariance=0.12;
      CFG.consecutiveRequired=7; CFG.boxStableWaitMs=50;
      CFG.maxReadingsBuffer=15; CFG.minBoxVisibleMs=60;
      CFG.maxAngleChangePerFrame=0.6; CFG.directionLockFrames=6;
      CFG.minSwipeWindowMs=80; CFG.highScoreMode=true;
      L('HIGH SCORE MODE - Optimized for 1500+ scores with large fast boxes','#f59e0b');
    }
  };
  L('PLAY7 FAST ready - Optimized for rapid boxes with accurate swipes. Thunder/Gully/Firefox/Heart=SAME dir, Trap=OPPOSITE. Use PLAY7.fast() for speed, PLAY7.ultra() for accuracy, or PLAY7.highscore() for 1500+ scores.','#22c55e');
})();
c2
