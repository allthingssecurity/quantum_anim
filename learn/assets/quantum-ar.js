(function(){
  // Elements
  const video = document.getElementById('video');
  const canvas = document.getElementById('landmarks');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const scoreEl = document.getElementById('score');
  const levelBox = document.getElementById('levelBox');
  const statusEl = document.getElementById('status');
  const learnTitle = document.getElementById('learnTitle');
  const learnBody = document.getElementById('learnBody');
  const codePre = document.getElementById('code');
  const histEl = document.getElementById('hist');
  const shotsEl = document.getElementById('shots');
  const runBtn = document.getElementById('run');
  const resetBtn = document.getElementById('reset');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');

  let W=innerWidth, H=innerHeight; canvas.width=W; canvas.height=H;
  let score=0; function setScore(s){ score=s; scoreEl.textContent = `Score: ${score}`; }
  let program=[]; function renderCode(){ codePre.textContent = program.join('\n'); }

  // Targets per level
  function target(x,y,label,concept,apply){ return {x,y,label,concept,apply,hit:false,hold:0}; }
  function star(x,y){ return {x,y,star:true,show:false}; }

  const levels=[
    { title:'1. Hadamard & Z', n:1, t:[], goal:star(0,0),
      setup(){ this.t=[
        target(0.25,0.55,'H','Hadamard: |0⟩ → (|0⟩+|1⟩)/√2 (≈50/50).', ()=> program.push('qc.had(0);')),
        target(0.55,0.40,'Z','Z adds −1 phase on |1⟩. Combine with H to change probabilities.', ()=> program.push('qc.z(0);'))
      ]; this.goal=star(0.85,0.65); }
    },
    { title:'2. Bell', n:2, t:[], goal:star(0,0),
      setup(){ this.t=[ target(0.3,0.6,'H₀','H on q0', ()=> program.push('qc.had(0);')), target(0.6,0.45,'CNOT','CNOT 0→1 entangles (00/11)', ()=> program.push('qc.cnot(0,1);')) ]; this.goal=star(0.85,0.6); }
    },
    { title:'3. Interference', n:1, t:[], goal:star(0,0),
      setup(){ this.t=[ target(0.25,0.6,'H','H', ()=> program.push('qc.had(0);')), target(0.5,0.5,'RZ','RZ π/2 phase', ()=> program.push('qc.rz(0, Math.PI/2);')), target(0.7,0.55,'H','H', ()=> program.push('qc.had(0);')) ]; this.goal=star(0.9,0.7); }
    },
    { title:'4. GHZ', n:3, t:[], goal:star(0,0),
      setup(){ this.t=[ target(0.25,0.6,'H₀','H on q0', ()=> program.push('qc.had(0);')), target(0.5,0.5,'CNOT01','CNOT 0→1', ()=> program.push('qc.cnot(0,1);')), target(0.75,0.5,'CNOT12','CNOT 1→2', ()=> program.push('qc.cnot(1,2);')) ]; this.goal=star(0.9,0.6); }
    },
    { title:'5. Grover (2q)', n:2, t:[], goal:star(0,0),
      setup(){ this.t=[ target(0.25,0.6,'H₀','H on q0', ()=> program.push('qc.had(0);')), target(0.45,0.55,'H₁','H on q1', ()=> program.push('qc.had(1);')), target(0.65,0.5,'Oracle 11','Mark |11⟩ (phase flip)', ()=> program.push("qc.phase_flip('11');")), target(0.8,0.5,'Diffuse','Grover diffuser', ()=> program.push('diffusion();')) ]; this.goal=star(0.9,0.7); }
    },
    { title:'6. TSP (3q)', n:3, t:[], goal:star(0,0),
      setup(){ this.t=[ target(0.22,0.62,'H₀','H on q0', ()=> program.push('qc.had(0);')), target(0.42,0.56,'H₁','H on q1', ()=> program.push('qc.had(1);')), target(0.62,0.50,'H₂','H on q2', ()=> program.push('qc.had(2);')), target(0.76,0.46,'Oracle 101','Mark best route 101', ()=> program.push("qc.phase_flip('101');")), target(0.86,0.46,'Diffuse','Diffuser', ()=> program.push('diffusion();')) ]; this.goal=star(0.92,0.75); }
    }
  ];

  let cur=0; function setLevel(i){ cur=Math.max(0,Math.min(levels.length-1,i)); levelBox.textContent = `Level ${cur+1}/${levels.length}`; program=[`qc.reset(${levels[cur].n});`]; renderCode(); levels[cur].setup(); learnTitle.textContent=levels[cur].title; learnBody.textContent='Collect all targets, then reach the star.'; starShown=false; }
  prevBtn.addEventListener('click', ()=> setLevel(cur-1));
  nextBtn.addEventListener('click', ()=> setLevel(cur+1));

  function renderHist(counts, n){ const m=Math.max(1,...counts); histEl.innerHTML=''; counts.forEach((c,i)=>{ const bar=document.createElement('div'); bar.className='bar'; bar.style.height=`${(c/m)*100}%`; const lab=document.createElement('div'); lab.className='label'; lab.textContent=i.toString(2).padStart(n,'0'); const val=document.createElement('div'); val.className='value'; val.textContent=String(c); bar.appendChild(lab); bar.appendChild(val); histEl.appendChild(bar); }); }
  function autoRun(){ const s=Math.max(1,Math.min(100000, parseInt(shotsEl.value,10)||200)); const src=program.join('\n')+'\nqc.measure();'; const {counts,nQubits} = window.QCEngineRunner.runProgram(src, s); lastCounts=counts; lastShots=s; lastN=nQubits; renderHist(counts,nQubits); maybeSpawnStar(); }
  runBtn.addEventListener('click', ()=> autoRun());
  resetBtn.addEventListener('click', ()=> setLevel(cur));

  // Spawn star based on histogram thresholds for Grover/TSP
  let lastCounts=[], lastShots=0, lastN=0, starShown=false;
  function maybeSpawnStar(){ const L=levels[cur]; if (starShown) return; const allHit=L.t.every(t=>t.hit); if (!allHit) return; if (L.n===2){ if (lastN!==2||lastShots<=0||!lastCounts||lastCounts.length<4) return; const p11=lastCounts[3]/lastShots; if (p11>0.6) { L.goal.show=true; starShown=true; statusEl.textContent='Star appeared!'; } } else if (L.n===3 && L.title.includes('TSP')){ if (lastN!==3||lastShots<=0||!lastCounts||lastCounts.length<8) return; const p101=lastCounts[0b101]/lastShots; if (p101>0.5){ L.goal.show=true; starShown=true; statusEl.textContent='Star appeared!'; } } else { L.goal.show=true; starShown=true; } }

  // Draw targets and star
  function draw(){ ctx.clearRect(0,0,W,H); const L=levels[cur]; // draw targets
    L.t.forEach(t=>{ if (t.hit) return; const x=t.x*W, y=t.y*H; ctx.strokeStyle='rgba(34,211,238,0.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,24,0,Math.PI*2); ctx.stroke(); ctx.fillStyle='rgba(34,211,238,0.18)'; ctx.beginPath(); ctx.arc(x,y,24,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#e6edf3'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.fillText(t.label, x, y+4); });
    if (L.goal && L.goal.show){ const gx=L.goal.x*W, gy=L.goal.y*H; ctx.fillStyle='#ffb24a'; ctx.beginPath(); const R=14; let rot=Math.PI/2*3; const step=Math.PI/5; ctx.moveTo(gx, gy-R); for(let i=0;i<5;i++){ let x=gx+Math.cos(rot)*R, y=gy+Math.sin(rot)*R; ctx.lineTo(x,y); rot+=step; x=gx+Math.cos(rot)*(R/2); y=gy+Math.sin(rot)*(R/2); ctx.lineTo(x,y); rot+=step; } ctx.lineTo(gx, gy-R); ctx.closePath(); ctx.fill(); }
  }

  // Hand tracking via MediaPipe Hands (through included hands.js/camera_utils.js)
  let hands=null; let ready=false; let lastTip=[0,0];
  function onResults(res){ ctx.save(); ctx.translate(W,0); ctx.scale(-1,1); // mirror coords
    if (res.multiHandLandmarks && res.multiHandLandmarks.length){ const lm=res.multiHandLandmarks[0]; const tip=lm[8]; // index fingertip
      const mx=(1-tip.x)*W, my=tip.y*H; lastTip=[mx,my]; statusEl.textContent='Point at a target to collect';
      // draw tip
      ctx.fillStyle='#22d3ee'; ctx.beginPath(); ctx.arc(mx,my,6,0,Math.PI*2); ctx.fill();
      // hit detection with hold
      const L=levels[cur]; for (const t of L.t){ if (t.hit) continue; const tx=t.x*W, ty=t.y*H; const d2=(mx-tx)*(mx-tx)+(my-ty)*(my-ty); if (d2<26*26){ t.hold+=1; if (t.hold>36){ t.hit=true; setScore(score+100); learnTitle.textContent=t.label; learnBody.textContent=t.concept; t.apply(); renderCode(); autoRun(); } } else { t.hold=0; } }
      // collect star
      if (L.goal && L.goal.show){ const gx=L.goal.x*W, gy=L.goal.y*H; const d2=(mx-gx)*(mx-gx)+(my-gy)*(my-gy); if (d2<18*18){ if (levels[cur].t.every(t=>t.hit)){ if (cur<levels.length-1){ setLevel(cur+1); } else { overlay.style.display='grid'; document.getElementById('card').innerHTML='<h2>Quest Complete</h2><p>You explored core quantum ideas. Open the Playground to go deeper.</p>'; } } } }
    } else {
      statusEl.textContent='Show your hand to start';
    }
    ctx.restore(); draw();
  }

  async function start(){ overlay.style.display='none'; try{
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false});
      video.srcObject = stream;
      const h = new Hands({locateFile:(f)=>`vendor/mediapipe/${f}`});
      h.setOptions({ maxNumHands:1, modelComplexity:1, minDetectionConfidence:0.5, minTrackingConfidence:0.5 });
      h.onResults(onResults); hands=h; ready=true;
      const cam = new Camera(video, { onFrame: async ()=>{ await hands.send({image: video}); }, width: W, height: H }); cam.start();
    }catch(e){ statusEl.textContent='Camera blocked; allow access to play.'; }
  }
  overlay.addEventListener('click', start);

  // QCEngine helpers
  function renderHist(counts, n){ const m=Math.max(1,...counts); histEl.innerHTML=''; counts.forEach((c,i)=>{ const bar=document.createElement('div'); bar.className='bar'; bar.style.height=`${(c/m)*100}%`; const lab=document.createElement('div'); lab.className='label'; lab.textContent=i.toString(2).padStart(n,'0'); const val=document.createElement('div'); val.className='value'; val.textContent=String(c); bar.appendChild(lab); bar.appendChild(val); histEl.appendChild(bar); }); }

  setLevel(0); draw();
})();

