(function(){
  const canvas = document.getElementById('qq-canvas');
  const ctx = canvas.getContext('2d');
  const shotsEl = document.getElementById('qq-shots');
  const runBtn = document.getElementById('qq-run');
  const resetBtn = document.getElementById('qq-reset');
  const codePre = document.getElementById('qq-code');
  const histEl = document.getElementById('qq-hist');
  const scoreEl = document.getElementById('qq-score');
  const levelEl = document.getElementById('qq-level');
  const learnTitle = document.getElementById('qq-learnTitle');
  const learnBody = document.getElementById('qq-learnBody');
  const overlay = document.getElementById('qq-overlay');

  let W=800, H=400; canvas.width=W; canvas.height=H;
  let program=[]; function renderCode(){ codePre.textContent = program.join('\n'); }
  let score=0; function setScore(s){ score=s; scoreEl.textContent=`Score: ${score}`; }
  let level=0; const levels=[];

  function renderHist(counts, n){ const m=Math.max(1,...counts); histEl.innerHTML=''; counts.forEach((c,i)=>{ const bar=document.createElement('div'); bar.className='bar'; bar.style.height=`${(c/m)*100}%`; const lab=document.createElement('div'); lab.className='label'; lab.textContent=i.toString(2).padStart(n,'0'); const val=document.createElement('div'); val.className='value'; val.textContent=String(c); bar.appendChild(lab); bar.appendChild(val); histEl.appendChild(bar); }); }
  function run(shots){ const src=program.join('\n')+'\nqc.measure();'; const {counts,nQubits}=window.QCEngineRunner.runProgram(src, shots); renderHist(counts,nQubits); }

  function disc(x,y,r,label,concept,apply){ return {x,y,r,label,concept,apply,hit:false}; }
  function star(x,y){ return {x,y,r:12,star:true}; }

  levels.push({
    title:'1. Qubit & Hadamard', qubits:1,
    discs:[], goal:null,
    setup(){
      this.discs=[
        disc(200,180,22,'H','Hadamard: |0⟩ → (|0⟩+|1⟩)/√2 ≈ 50/50', ()=> program.push('qc.had(0);')),
        disc(360,120,22,'Z','Z adds a −1 phase on |1⟩. Combine with H to change probabilities.', ()=> program.push('qc.z(0);'))
      ];
      this.goal=star(700,280);
    }
  });
  levels.push({
    title:'2. Bell state', qubits:2,
    discs:[], goal:null,
    setup(){
      this.discs=[
        disc(220,220,22,'H₀','H on q0: create superposition.', ()=> program.push('qc.had(0);')),
        disc(420,160,26,'CNOT','CNOT 0→1 entangles: (|00⟩+|11⟩)/√2', ()=> program.push('qc.cnot(0,1);'))
      ]; this.goal=star(720,240);
    }
  });
  levels.push({
    title:'3. Interference', qubits:1,
    discs:[], goal:null,
    setup(){ this.discs=[disc(240,200,22,'H','H', ()=> program.push('qc.had(0);')), disc(420,160,22,'RZ','RZ π/2 — phase shift', ()=> program.push('qc.rz(0, Math.PI/2);')), disc(560,180,22,'H','H', ()=> program.push('qc.had(0);'))]; this.goal=star(720,260); }
  });
  levels.push({
    title:'4. GHZ (3‑qubit)', qubits:3,
    discs:[], goal:null,
    setup(){ this.discs=[disc(200,200,22,'H₀','H on q0', ()=> program.push('qc.had(0);')), disc(360,160,26,'CNOT01','CNOT 0→1', ()=> program.push('qc.cnot(0,1);')), disc(520,160,26,'CNOT12','CNOT 1→2', ()=> program.push('qc.cnot(1,2);'))]; this.goal=star(720,200); }
  });
  levels.push({
    title:'5. Grover taste', qubits:2,
    discs:[], goal:null,
    setup(){ this.discs=[disc(220,220,22,'H₀','H on q0', ()=> program.push('qc.had(0);')), disc(360,200,22,'H₁','H on q1', ()=> program.push('qc.had(1);')), disc(520,160,28,'Oracle 11','Mark |11⟩ with phase', ()=> program.push("qc.phase_flip('11');")), disc(620,180,28,'Diffuse','Grover diffuser', ()=> program.push('diffusion();'))]; this.goal=star(740,140); }
  });
  levels.push({
    title:'6. TSP toy (3‑q)', qubits:3,
    discs:[], goal:null,
    setup(){ this.discs=[disc(200,220,22,'H₀','H on q0', ()=> program.push('qc.had(0);')), disc(320,200,22,'H₁','H on q1', ()=> program.push('qc.had(1);')), disc(440,180,22,'H₂','H on q2', ()=> program.push('qc.had(2);')), disc(580,160,28,'Oracle 101','Mark best route 101', ()=> program.push("qc.phase_flip('101');")), disc(660,160,28,'Diffuse','Diffuse to amplify best', ()=> program.push('diffusion();'))]; this.goal=star(750,240); }
  });

  function setLevel(i){ level = Math.max(0, Math.min(levels.length-1, i)); levelEl.textContent = `Level ${level+1}/${levels.length}`; program=[`qc.reset(${levels[level].qubits});`]; renderCode(); levels[level].setup(); }

  function drawDisc(d){ ctx.fillStyle='rgba(34,211,238,0.25)'; ctx.beginPath(); ctx.arc(d.x,d.y,d.r+8,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#22d3ee'; ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#0b1120'; ctx.font='12px sans-serif'; const w=ctx.measureText(d.label).width; ctx.fillText(d.label, d.x-w/2, d.y+4); }
  function drawStar(s){ ctx.fillStyle='#ffb24a'; const R=s.r, cx=s.x, cy=s.y; let rot=Math.PI/2*3; const step=Math.PI/5; ctx.beginPath(); ctx.moveTo(cx, cy-R); for (let i=0;i<5;i++){ let x=cx+Math.cos(rot)*R, y=cy+Math.sin(rot)*R; ctx.lineTo(x,y); rot+=step; x=cx+Math.cos(rot)*(R/2); y=cy+Math.sin(rot)*(R/2); ctx.lineTo(x,y); rot+=step; } ctx.lineTo(cx, cy-R); ctx.closePath(); ctx.fill(); }
  function draw(){ ctx.clearRect(0,0,W,H); ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,W,H); const L=levels[level]; L.discs.forEach(d=>{ if(!d.hit) drawDisc(d); }); drawStar(L.goal); }

  function hitDisc(mx,my){ const L=levels[level]; for (const d of L.discs){ if (d.hit) continue; const dx=mx-d.x, dy=my-d.y; if (dx*dx+dy*dy <= d.r*d.r){ d.hit=true; setScore(score+100); learnTitle.textContent=d.label; learnBody.textContent=d.concept; d.apply(); renderCode(); autoRun(); return; } } }
  function hitGoal(mx,my){ const s=levels[level].goal; const dx=mx-s.x, dy=my-s.y; return (dx*dx+dy*dy <= s.r*s.r); }

  function autoRun(){ const shots=Math.max(1, Math.min(100000, parseInt(shotsEl.value,10)||200)); run(shots); }
  canvas.addEventListener('click', (e)=>{ const r=canvas.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top; if (overlay.style.display!=='none'){ overlay.style.display='none'; return; } if (hitGoal(mx,my)){ if (levels[level].discs.every(d=>d.hit)){ if (level < levels.length-1){ setLevel(level+1); } else { overlay.style.display='grid'; document.getElementById('qq-card').innerHTML = '<h2>Quest Complete</h2><p>You explored core quantum ideas. Open the Playground to go deeper.</p>'; } } return; } hitDisc(mx,my); });

  runBtn.addEventListener('click', ()=>{ const s=Math.max(1,Math.min(100000, parseInt(shotsEl.value,10)||300)); run(s); });
  resetBtn.addEventListener('click', ()=>{ setLevel(level); });

  setLevel(0); draw(); (function loop(){ draw(); requestAnimationFrame(loop); })();
})();

