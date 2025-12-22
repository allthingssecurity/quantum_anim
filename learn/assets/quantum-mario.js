// Quantum Mario — minimal platformer + quantum gates + histogram
// Uses window.QCEngineRunner to maintain a simple 1–2 qubit state via code snippets

(function(){
  const canvas = document.getElementById('qm-canvas');
  const ctx = canvas.getContext('2d');
  const shotsEl = document.getElementById('qm-shots');
  const runBtn = document.getElementById('qm-run');
  const codePre = document.getElementById('qm-code');
  const histEl = document.getElementById('qm-hist');
  const resetBtn = document.getElementById('qm-reset');
  const newBtn = document.getElementById('qm-new');
  const saveBtn = document.getElementById('qm-save');
  const loadBtn2 = document.getElementById('qm-load');
  const levelEl = document.getElementById('qm-level');
  const levelSelect = document.getElementById('qm-level-select');
  const startBtn = document.getElementById('qm-start');
  const nextBtn = document.getElementById('qm-next');
  const SAVE_KEY = 'qm_save_v1';
  // QC program state (as editable code lines)
  let program = [];
  function renderCode(){ codePre.textContent = program.join('\n'); }

  let W = 800, H = 400; canvas.width=W; canvas.height=H;

  const groundY = H-60;
  const gravity = 0.58;      // tuned gravity for Mario-like feel
  const friction = 0.86;

  const player = {x:80,y:groundY-40,w:26,h:36, vx:0, vy:0, onGround:true, jumps:0, maxJumps:2, coyote:0, jumpBuffer:0, dead:false};
  let lives = 3;
  let score = 0;
  const keys = {left:false,right:false,up:false};
  let gameEnd = false;

  // World objects: platforms + gate collectibles
  // Simple tile-like layout (still rects but arranged like tiles)
  let platforms = [];
  let gates = [];

  const gateInfo = {
    H: {title:'Hadamard (H)', text:'Turns |0⟩ into a fair superposition (|0⟩+|1⟩)/√2 → 50/50.'},
    X: {title:'Pauli-X (X)', text:'Flips a qubit (0↔1). Changes basis state probabilities.'},
    Z: {title:'Pauli-Z (Z)', text:'Adds a -1 phase to |1⟩. Alone it doesn’t change probabilities; with H it changes them via interference.'},
    CNOT: {title:'CNOT (0→1)', text:'If control q0=1, flip target q1. With H on q0, creates entanglement.'}
  };
  let infoOverlay = {t:0,title:'',text:''};

  // Question blocks (hit from below to learn concept / spawn coin)
  let blocks = [];

  // Simple enemies (patrol like goombas)
  let enemies = [];
  let goals = [];
  let showLegend = true;
  let lastCounts = []; let lastN = 0; let lastShots = 0;

  // Levels
  const levels = [
    {
      id:'L1', title:'Level 1: 1‑Qubit Basics', qubits:1,
      setup(){
        platforms = [ {x:0,y:groundY,w:W,h:60}, {x:240,y:groundY-90,w:180,h:16}, {x:520,y:groundY-150,w:180,h:16} ];
        gates = [ {id:'H0',label:'H q0',x:260,y:groundY-120,w:24,h:24,type:'H',target:0}, {id:'X0',label:'X q0',x:560,y:groundY-180,w:24,h:24,type:'X',target:0}, {id:'Z0',label:'Z q0',x:680,y:groundY-60-24,w:24,h:24,type:'Z',target:0} ];
        blocks = [ {x:200,y:groundY-120,w:32,h:18,topic:'H',text:'H makes 50/50 from |0⟩.',hit:false}, {x:480,y:groundY-180,w:32,h:18,topic:'Z',text:'Z adds phase; use H to see interference.',hit:false} ];
        enemies = [ {x:360,y:groundY-36,w:26,h:26,vx:-1.2,dead:false} ];
        goals = [ {x:740,y:groundY-60-20,w:20,h:20} ];
        objective = {text:'Collect H and try shots (≈50/50). Then collect Z and try H again to see interference. Reach the ⭐ to complete.', required: ['H0']};
      }
    },
    {
      id:'L2', title:'Level 2: 2‑Qubit Entanglement', qubits:2,
      setup(){
        platforms = [ {x:0,y:groundY,w:W,h:60}, {x:260,y:groundY-90,w:180,h:16}, {x:520,y:groundY-160,w:180,h:16}, {x:700,y:groundY-220,w:120,h:16} ];
        gates = [ {id:'H0',label:'H q0',x:280,y:groundY-120,w:24,h:24,type:'H',target:0}, {id:'CNOT01',label:'CNOT 0→1',x:560,y:groundY-190,w:38,h:24,type:'CNOT',control:0,target:1} ];
        blocks = [ {x:500,y:groundY-190,w:32,h:18,topic:'CNOT',text:'CNOT flips target when control=1. With H on q0, creates Bell state.',hit:false} ];
        enemies = [ {x:420,y:groundY-36,w:26,h:26,vx:1.0,dead:false} ];
        goals = [ {x:740,y:groundY-240,w:20,h:20} ];
        objective = {text:'Create Bell state: collect H then CNOT. Observe only 00 and 11. Reach the ⭐ to complete.', required: ['H0','CNOT01']};
      }
    },
    {
      id:'L3', title:'Level 3: 3‑Qubit GHZ', qubits:3,
      setup(){
        // Adjusted layout for reachability: add an intermediate step and slightly lower top
        platforms = [
          {x:0,y:groundY,w:W,h:60},
          {x:220,y:groundY-90,w:180,h:16},
          {x:460,y:groundY-150,w:180,h:16},
          {x:660,y:groundY-195,w:140,h:16}
        ];
        gates = [
          {id:'H0',label:'H q0',x:245,y:groundY-120,w:24,h:24,type:'H',target:0},
          {id:'CNOT01',label:'CNOT 0→1',x:520,y:groundY-180,w:38,h:24,type:'CNOT',control:0,target:1},
          {id:'CNOT12',label:'CNOT 1→2',x:705,y:groundY-195-26,w:38,h:24,type:'CNOT',control:1,target:2}
        ];
        blocks = [ {x:450,y:groundY-180,w:32,h:18,topic:'CNOT',text:'Chain CNOTs to spread correlation (GHZ).',hit:false} ];
        enemies = [ {x:360,y:groundY-36,w:26,h:26,vx:-1.0,dead:false},{x:610,y:groundY-166,w:26,h:26,vx:1.0,dead:false} ];
        goals = [ {x:760,y:groundY-195-22,w:20,h:20} ];
        objective = {text:'Make GHZ: H on q0, then CNOT 0→1 and 1→2. Reach the ⭐ to complete.', required: ['H0','CNOT01','CNOT12']};
      }
    },
    {
      id:'L4', title:'Level 4: Gates Lab', qubits:1,
      setup(){
        platforms = [ {x:0,y:groundY,w:W,h:60}, {x:240,y:groundY-90,w:180,h:16}, {x:520,y:groundY-150,w:180,h:16} ];
        gates = [ {id:'Y0',label:'Y q0',x:260,y:groundY-120,w:24,h:24,type:'Y',target:0}, {id:'RY0',label:'RY π/3',x:560,y:groundY-180,w:26,h:24,type:'RY',target:0, angle:Math.PI/3}, {id:'RZ0',label:'RZ π/2',x:680,y:groundY-60-24,w:26,h:24,type:'RZ',target:0, angle:Math.PI/2} ];
        blocks = [ {x:200,y:groundY-120,w:32,h:18,topic:'H',text:'Combine H with Z to see interference.',hit:false} ];
        enemies = [];
        goals = [ {x:740,y:groundY-60-20,w:20,h:20} ];
        objective = {text:'Experiment with Y, RY, RZ and observe histogram changes. Reach the ⭐ when done.', required: []};
      }
    },
    {
      id:'L5', title:'Level 5: Circuits (Grover Taste)', qubits:2,
      setup(){
        platforms = [ {x:0,y:groundY,w:W,h:60}, {x:240,y:groundY-90,w:180,h:16}, {x:520,y:groundY-150,w:180,h:16} ];
        gates = [ {id:'H0',label:'H q0',x:260,y:groundY-120,w:24,h:24,type:'H',target:0}, {id:'H1',label:'H q1',x:560,y:groundY-180,w:24,h:24,type:'H',target:1}, {id:'ORCL',label:'Oracle |11>',x:700,y:groundY-60-24,w:36,h:24,type:'ORACLE',value:"11"}, {id:'DIFF',label:'Diffuse',x:740,y:groundY-60-24-40,w:36,h:24,type:'DIFF'} ];
        blocks = [ {x:500,y:groundY-180,w:32,h:18,topic:'Grover',text:'Mark target with a phase flip, then diffuse to amplify.',hit:false} ];
        enemies = [];
        // Star will appear after |11⟩ > 60%
        goals = [];
        objective = {text:'Prepare H⊗H, apply oracle and diffuser. Run until |11⟩ > 60% to spawn ⭐.', required: ['H0','H1','ORCL','DIFF']};
      }
    },
    {
      id:'L6', title:'Level 6: TSP Toy (3‑Q)', qubits:3,
      setup(){
        platforms = [ {x:0,y:groundY,w:W,h:60}, {x:220,y:groundY-90,w:180,h:16}, {x:480,y:groundY-150,w:180,h:16}, {x:680,y:groundY-195,w:140,h:16} ];
        gates = [
          {id:'H0',label:'H q0',x:240,y:groundY-120,w:24,h:24,type:'H',target:0},
          {id:'H1',label:'H q1',x:520,y:groundY-180,w:24,h:24,type:'H',target:1},
          {id:'H2',label:'H q2',x:700,y:groundY-195-26,w:24,h:24,type:'H',target:2},
          {id:'ORCL',label:'Oracle best 101',x:740,y:groundY-60-24,w:74,h:24,type:'ORACLE',value:"101"},
          {id:'DIFF',label:'Diffuse',x:740,y:groundY-60-24-40,w:36,h:24,type:'DIFF'}
        ];
        blocks = [ {x:460,y:groundY-180,w:32,h:18,topic:'TSP',text:'Mark best route via phase, then diffuse to amplify.',hit:false} ];
        enemies = [ {x:360,y:groundY-36,w:26,h:26,vx:-1.0,dead:false} ];
        goals = [];
        objective = {text:'Create H⊗H⊗H. Mark 101 as best, then Diffuse. Run until |101⟩ > 50% to spawn ⭐.', required: ['H0','H1','H2','ORCL','DIFF']};
      }
    }
  ];

  let currentLevel = 0;
  let objective = {text:'', required:[]};
  let levelBanner = {t:0, text:''};

  function populateLevelSelect(){ levelSelect.innerHTML=''; levels.forEach((lv,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=lv.title; levelSelect.appendChild(o); }); levelSelect.value=String(currentLevel); }
  function setLevel(i){
    currentLevel = Math.max(0, Math.min(levels.length-1, i));
    const lv = levels[currentLevel];
    levelEl.textContent = lv.title;
    program = [`qc.reset(${lv.qubits});`]; renderCode();
    gates=[]; platforms=[]; blocks=[]; enemies=[]; lv.setup();
    histEl.innerHTML='';
    player.x=80; player.y=groundY-40; player.vx=0; player.vy=0; player.onGround=true; player.jumps=0; player.coyote=0; player.dead=false;
    gameEnd=false; lives=3; score=0; infoOverlay.t=0; levelBanner.t=180; levelBanner.text='Level Start';
    saveGame();
  }
  function completeGame(){ gameEnd = true; levelBanner.t=240; levelBanner.text='Game Complete!'; }
  function nextLevel(){ if (currentLevel < levels.length-1) setLevel(currentLevel+1); else completeGame(); }
  function saveGame(){ try{ const data={level:currentLevel,lives,score,program}; localStorage.setItem(SAVE_KEY, JSON.stringify(data)); levelBanner.t=120; levelBanner.text='Saved'; }catch(e){} }
  function markCollectedFromProgram(){ const ids=[]; const re=/id:([A-Za-z0-9]+)/g; const src=program.join('\n'); let m; while((m=re.exec(src))){ ids.push(m[1]); } for (const g of gates){ if (ids.includes(g.id)) g.done=true; } }
  function loadGame(){ try{ const raw=localStorage.getItem(SAVE_KEY); if(!raw) return false; const data=JSON.parse(raw); if (typeof data.level==='number'){ setLevel(data.level); program = Array.isArray(data.program)? data.program : program; renderCode(); lives = data.lives||3; score = data.score||0; markCollectedFromProgram(); autoRun(); levelBanner.t=180; levelBanner.text='Loaded'; return true; } }catch(e){} return false; }
  populateLevelSelect();
  // Start fresh at Level 0 by default (no auto-load)
  setLevel(0);

  // initial render after setLevel/loadGame
  renderCode();

  function rect(a,b){ return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y); }

  function update(){
    // input
    if (keys.left) player.vx -= 0.5;
    if (keys.right) player.vx += 0.5;
    // buffered jump & coyote time
    if (keys.up) { player.jumpBuffer = 8; keys.up = false; }
    if (player.onGround) player.coyote = 6; else if (player.coyote>0) player.coyote--;
    if (player.jumpBuffer>0){
      if (player.onGround || player.coyote>0 || player.jumps < player.maxJumps){
        player.vy = -15; player.onGround=false; player.jumps += 1; player.jumpBuffer=0; player.coyote=0;
      } else {
        player.jumpBuffer--;
      }
    }
    // physics
    player.vy += gravity; player.x += player.vx; player.y += player.vy; player.vx *= friction;
    // bounds
    if (player.x < 0) player.x = 0;
    if (player.x+player.w > W) player.x = W-player.w;
    // collisions
    player.onGround=false;
    for (const p of platforms){
      // simple floor/platform collision
      if (rect(player,{x:p.x,y:p.y,w:p.w,h:p.h})){
        const overlapY = player.y+player.h - p.y;
        const overlapX = (player.x < p.x) ? (player.x+player.w - p.x) : (p.x+p.w - player.x);
        if (player.vy>0 && overlapY < 24){ // land on top
          player.y = p.y - player.h; player.vy=0; player.onGround=true; player.jumps=0; player.coyote=0;
        } else if (Math.abs(overlapX) < 20){ // simple side stop
          if (player.x < p.x) player.x = p.x - player.w; else player.x = p.x + p.w;
          player.vx = 0;
        }
      }
    }
    // hit blocks from below
    if (player.vy < 0){
      for (const b of blocks){ if (b.hit) continue; if (rect(player, b)){
        // Adjust player below the block
        player.y = b.y + b.h; player.vy = 3;
        b.hit = true; score += 50; showInfo({type:b.topic});
        // optionally spawn related coin nearby
        if (b.topic==='Z'){ gates.push({id:'RZ0', label:'RZ π/2', x:b.x+12, y:b.y-28, w:26, h:24, type:'RZ', target:0, angle:Math.PI/2}); }
        break;
      }}
    }
    // gate pickups
    for (const g of gates){ if (g.done) continue; if (rect(player, g)) { applyGate(g); g.done=true; score += 100; showInfo(g); autoRun(); } }
    // enemies update and collisions
    for (const e of enemies){ if (e.dead) continue; e.x += e.vx; // edge turn
      // turn around at platform edges or bounds
      if (e.x < 0 || e.x+e.w > W) e.vx *= -1;
      // simple platform top alignment
      const ground = platforms.find(p=> e.x+e.w/2 >= p.x && e.x+e.w/2 <= p.x+p.w && Math.abs((e.y+e.h) - p.y) < 22);
      if (ground) e.y = ground.y - e.h; else e.y = groundY- e.h;
      // player collision
      if (rect(player, e)){
        // stomp check: coming from above
        if (player.vy > 0 && (player.y + player.h - e.y) < 18){
          e.dead = true; score += 200; player.vy = -12;
        } else {
          // hurt
          loseLife(); return;
        }
      }
    }
    if (infoOverlay.t>0) infoOverlay.t--;
    if (levelBanner.t>0) levelBanner.t--;
    // Objective completion check
    const allDone = !objective.required || objective.required.every(id => gates.find(g=>g.id===id && g.done));
    // goal star completion
    if (allDone){ for (const goal of goals){ if (rect(player,goal)){ levelBanner.t=180; levelBanner.text='Level Complete'; setTimeout(()=> nextLevel(), 2000); goals=[]; break; } } }
  }

  function applyGate(g){
    const tag = (id)=>` // id:${id}`;
    if (g.type==='H') program.push(`qc.had(${g.target}); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='X') program.push(`qc.x(${g.target}); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='Z') program.push(`qc.z(${g.target}); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='RZ') program.push(`qc.rz(${g.target}, ${g.angle.toFixed(2)}); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='CNOT') program.push(`qc.cnot(${g.control},${g.target}); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='Y') program.push(`qc.y(${g.target}); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='RY') program.push(`qc.ry(${g.target}, ${g.angle.toFixed(2)}); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='ORACLE') program.push(`qc.phase_flip('${g.value}'); // picked ${g.label}${tag(g.id)}`);
    if (g.type==='DIFF') program.push(`diffusion(); // picked ${g.label}${tag(g.id)}`);
    renderCode();
  }

  function showInfo(g){
    const m = gateInfo[g.type] || {title:g.label, text:''};
    infoOverlay = {t:240,title:m.title,text:m.text}; // show ~4s at 60fps
  }

  function draw(){
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(0,0,W,H);
    // Start-of-level legend
    if (showLegend){
      ctx.fillStyle = 'rgba(11,15,20,0.92)';
      ctx.fillRect(40, 60, W-80, 110);
      ctx.strokeStyle = '#243041'; ctx.strokeRect(40, 60, W-80, 110);
      ctx.fillStyle = '#e6edf3'; ctx.font='16px sans-serif';
      ctx.fillText('Legend: Collect blue coins (gates). Hit ? blocks to learn. Avoid red enemies. Reach the ⭐ to finish.', 54, 88);
      ctx.fillStyle = '#93a1b0'; ctx.font='13px sans-serif';
      ctx.fillText('Gates update the circuit at right and auto-run shots to update the histogram.', 54, 112);
      ctx.fillText('Controls: ← → move, Space/↑ jump, double-jump enabled. Press N to skip to next level.', 54, 134);
      ctx.fillText('Press any arrow key to start.', 54, 156);
    }
    // platforms
    ctx.fillStyle = '#243041';
    for (const p of platforms){ ctx.fillRect(p.x,p.y,p.w,p.h); }
    // blocks
    for (const b of blocks){
      ctx.fillStyle = b.hit ? '#1b2533' : '#41536b';
      ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.fillStyle = '#e6edf3'; ctx.font='10px sans-serif'; ctx.fillText('?', b.x + b.w/2 - 3, b.y + b.h/2 + 3);
    }
    // gates
    for (const g of gates){ if (g.done) continue; ctx.fillStyle = '#68a2ff';
      // coin circle
      ctx.beginPath(); ctx.arc(g.x+g.w/2, g.y+g.h/2, Math.max(g.w,g.h)/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#e6edf3'; ctx.font='11px sans-serif'; ctx.fillText(g.label, g.x-8, g.y-8);
    }
    // goals (star)
    for (const s of goals){ ctx.fillStyle = '#ffb24a'; drawStar(ctx, s.x, s.y, 5, s.w/2, s.w/4); }
    // enemies
    for (const e of enemies){ if (e.dead) continue; ctx.fillStyle = '#ff5f56'; ctx.fillRect(e.x, e.y, e.w, e.h); // eyes
      ctx.fillStyle='#0b0f14'; ctx.fillRect(e.x+6,e.y+8,4,4); ctx.fillRect(e.x+e.w-10,e.y+8,4,4); }
    // player (quantum avatar)
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    const r = Math.min(player.w, player.h)/2;
    // aura
    ctx.fillStyle = 'rgba(55,214,122,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, r+8, 0, Math.PI*2); ctx.fill();
    // body
    ctx.fillStyle = '#37d67a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0b0f14'; ctx.font='12px sans-serif'; ctx.fillText('ψ', cx-4, cy+4);
    // HUD
    ctx.fillStyle = '#93a1b0'; ctx.font='12px sans-serif'; ctx.fillText(`Lives: ${'❤'.repeat(lives)}   Score: ${score}`, 20, 24);
    // objective box
    ctx.fillStyle = 'rgba(16,23,34,0.92)'; ctx.fillRect(W-360, 14, 340, 54);
    ctx.strokeStyle = '#243041'; ctx.strokeRect(W-360, 14, 340, 54);
    ctx.fillStyle = '#e6edf3'; ctx.fillText('Objective:', W-348, 32);
    ctx.fillStyle = '#93a1b0'; wrapText(ctx, objective.text, W-348, 48, 320, 14);

    // gate info overlay
    if (infoOverlay.t>0){
      const bw = 360, bh = 88; const bx = 20, by = 40;
      ctx.fillStyle = 'rgba(16,23,34,0.95)'; ctx.fillRect(bx,by,bw,bh);
      ctx.strokeStyle = '#243041'; ctx.strokeRect(bx,by,bw,bh);
      ctx.fillStyle = '#e6edf3'; ctx.font='14px sans-serif'; ctx.fillText(infoOverlay.title, bx+12, by+24);
      ctx.fillStyle = '#93a1b0'; ctx.font='12px sans-serif'; wrapText(ctx, infoOverlay.text, bx+12, by+44, bw-24, 14);
    }
    if (levelBanner.t>0){
      ctx.fillStyle = 'rgba(11,15,20,0.75)'; ctx.fillRect(0, H/2-30, W, 60);
      ctx.fillStyle = '#e6edf3'; ctx.font='22px sans-serif'; const w=ctx.measureText(levelBanner.text).width; ctx.fillText(levelBanner.text, (W-w)/2, H/2+6);
    }
    if (gameEnd){
      ctx.fillStyle = 'rgba(11,15,20,0.85)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#e6edf3'; ctx.font='26px sans-serif'; const title='Congratulations! You finished the course'; const tw=ctx.measureText(title).width; ctx.fillText(title, (W-tw)/2, H/2-24);
      ctx.font='18px sans-serif'; const s=`Score: ${score}   Lives left: ${lives}`; const sw=ctx.measureText(s).width; ctx.fillText(s, (W-sw)/2, H/2+8);
      ctx.font='14px sans-serif'; const hint='Press New Game to restart'; const hw=ctx.measureText(hint).width; ctx.fillText(hint, (W-hw)/2, H/2+32);
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    const words=text.split(' '); let line='';
    for (let n=0;n<words.length;n++){
      const test=line+words[n]+' '; const w=ctx.measureText(test).width;
      if (w>maxWidth && n>0){ ctx.fillText(line, x, y); line=words[n]+' '; y+=lineHeight; }
      else { line=test; }
    }
    ctx.fillText(line, x, y);
  }
  function drawStar(ctx, x, y, spikes, outerR, innerR){
    let rot = Math.PI / 2 * 3;
    let cx = x + outerR, cy = y + outerR;
    let step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outerR);
    for (let i=0; i<spikes; i++){
      let x1 = cx + Math.cos(rot) * outerR;
      let y1 = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x1, y1); rot += step;
      x1 = cx + Math.cos(rot) * innerR;
      y1 = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x1, y1); rot += step;
    }
    ctx.lineTo(cx, cy - outerR); ctx.closePath(); ctx.fill();
  }

  function loop(){ update(); draw(); requestAnimationFrame(loop); }
  loop();

  // Histogram
  function renderHist(counts, n){ const m=Math.max(1,...counts); histEl.innerHTML=''; counts.forEach((c,i)=>{ const bar=document.createElement('div'); bar.className='bar'; bar.style.height=`${(c/m)*100}%`; const lab=document.createElement('div'); lab.className='label'; lab.textContent=i.toString(2).padStart(n,'0'); const val=document.createElement('div'); val.className='value'; val.textContent=String(c); bar.appendChild(lab); bar.appendChild(val); histEl.appendChild(bar); }); }

  runBtn.addEventListener('click', ()=>{
    const shots = Math.max(1, Math.min(100000, parseInt(shotsEl.value,10)||300));
    const src = program.join('\n') + '\nqc.measure();';
    const {counts, nQubits, log} = window.QCEngineRunner.runProgram(src, shots);
    lastCounts = counts.slice(); lastN = nQubits; lastShots = shots;
    renderHist(counts, nQubits);
    maybeSpawnGroverStar();
  });
  function autoRun(){
    // small auto-run on pickup to reinforce concept
    const shots = Math.max(1, Math.min(100000, parseInt(shotsEl.value,10)||200));
    const src = program.join('\n') + '\nqc.measure();';
    const {counts, nQubits} = window.QCEngineRunner.runProgram(src, shots);
    lastCounts = counts.slice(); lastN = nQubits; lastShots = shots;
    renderHist(counts, nQubits);
    maybeSpawnGroverStar();
  }

  function maybeSpawnGroverStar(){
    const lv = levels[currentLevel]; if (!lv || (lv.id!=='L5' && lv.id!=='L6')) return;
    // Require all gates collected first
    const reqOK = !objective.required || objective.required.every(id => gates.find(g=>g.id===id && g.done));
    if (!reqOK) return;
    if (lv.id==='L5'){
      if (lastN!==2 || !lastCounts || lastCounts.length<4 || lastShots<=0) return;
      const p11 = lastCounts[3]/lastShots; // index 3 = |11>
      if (p11 > 0.6 && goals.length===0){ goals.push({x:740,y:groundY-150-20,w:20,h:20}); levelBanner.t=120; levelBanner.text='Target |11⟩ amplified — ⭐ appeared!'; }
    } else if (lv.id==='L6'){
      if (lastN!==3 || !lastCounts || lastCounts.length<8 || lastShots<=0) return;
      const p101 = lastCounts[0b101]/lastShots; // index 5 = |101>
      if (p101 > 0.5 && goals.length===0){ goals.push({x:740,y:groundY-150-20,w:20,h:20}); levelBanner.t=120; levelBanner.text='Best route |101⟩ amplified — ⭐ appeared!'; }
    }
  }

  function loseLife(){
    lives -= 1;
    if (lives <= 0){
      infoOverlay = {t:600, title:'Game Over', text:'Press Reset to try again. Explore blocks and coins to learn quantum gates.'};
      player.dead = true; return;
    }
    // respawn
    player.x=80; player.y=groundY-40; player.vx=0; player.vy=0; player.onGround=true; player.jumps=0; player.coyote=0;
  }
  resetBtn.addEventListener('click', ()=>{ setLevel(currentLevel); });
  newBtn && newBtn.addEventListener('click', ()=>{ try{ localStorage.removeItem(SAVE_KEY);}catch(e){} setLevel(0); });
  saveBtn && saveBtn.addEventListener('click', saveGame);
  loadBtn2 && loadBtn2.addEventListener('click', ()=>{ if (!loadGame()) { levelBanner.t=120; levelBanner.text='No save found'; } });

  // input handlers
  window.addEventListener('keydown', (e)=>{
    if (showLegend && (e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key===' ')) showLegend=false;
    if (e.key==='ArrowLeft'||e.key==='a') keys.left=true;
    if (e.key==='ArrowRight'||e.key==='d') keys.right=true;
    if (e.key==='ArrowUp'||e.key==='w'||e.key===' ') keys.up=true;
    if (e.key==='n') nextLevel();
  });
  window.addEventListener('keyup', (e)=>{
    if (e.key==='ArrowLeft'||e.key==='a') keys.left=false;
    if (e.key==='ArrowRight'||e.key==='d') keys.right=false;
  });

  // UI events
  if (startBtn) startBtn.addEventListener('click', ()=> setLevel(parseInt(levelSelect.value,10)));
  if (nextBtn) nextBtn.addEventListener('click', nextLevel);
})();
