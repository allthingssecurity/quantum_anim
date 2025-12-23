(function(){
  const video = document.getElementById('video');
  const canvas = document.getElementById('landmarks');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const statusEl = document.getElementById('status');
  const progressEl = document.getElementById('progress');
  const chapterEl = document.getElementById('chapter');
  const titleEl = document.getElementById('title');
  const bodyEl = document.getElementById('body');
  const takeawayEl = document.getElementById('takeaway');
  const oldEl = document.getElementById('old');
  const newEl = document.getElementById('new');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const levelModal = document.getElementById('levelModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const quizEl = document.getElementById('quiz');
  const modalNext = document.getElementById('modalNext');

  let W=innerWidth, H=innerHeight; canvas.width=W; canvas.height=H;
  function disc(x,y,label,content){ return {x,y,label,content,hit:false,hold:0}; }

  const chapters = [
    { name:'Qubits', slides:[
      disc(0.25,0.55,'|0⟩/|1⟩', {title:'Basis states', body:'A single qubit has two basis states: |0⟩ and |1⟩. A fresh qubit starts at |0⟩.', takeaway:'Think: a coin that hasn’t been flipped yet.'}),
      disc(0.55,0.40,'Bloch', {title:'Bloch sphere', body:'Any pure qubit state is a point on the Bloch sphere. Poles are |0⟩ and |1⟩.', takeaway:'We’ll only need “north” and “equator” intuitions.'}),
    ], quiz:{q:'Which is the default start state?', opts:[{t:'|0⟩',ok:true},{t:'|1⟩'},{t:'|+⟩'}] }},
    { name:'Superposition', slides:[
      disc(0.3,0.6,'Hadamard', {title:'Hadamard (H)', body:'H maps |0⟩ → (|0⟩+|1⟩)/√2. Measurement gives 0/1 with ~50/50 chance.', takeaway:'We create a fair quantum coin.'}),
      disc(0.6,0.45,'Interf.', {title:'Interference', body:'Phase changes (like Z or RZ) do not change probabilities directly but change interference with other gates (e.g., H).', takeaway:'Where the wave peaks or cancels matters.'}),
    ], quiz:{q:'Does Z change measurement on |0⟩ directly?', opts:[{t:'No (phase only)',ok:true},{t:'Yes, to |1⟩'},{t:'Sometimes flips'}] }},
    { name:'Entanglement', slides:[
      disc(0.25,0.6,'CNOT', {title:'CNOT', body:'Controlled‑NOT flips target only when the control is 1. With H on control, it creates correlation.', takeaway:'Outputs move together (e.g., 00 or 11).'}),
      disc(0.55,0.5,'Bell', {title:'Bell state', body:'H on q0 + CNOT 0→1 creates (|00⟩+|11⟩)/√2. Measuring one predicts the other.', takeaway:'Not classical randomness.'}),
    ], quiz:{q:'What pair appears in Φ⁺?', opts:[{t:'00 and 11',ok:true},{t:'01 and 10'},{t:'11 only'}] }},
    { name:'Algorithms', slides:[
      disc(0.3,0.6,'Grover', {title:'Grover idea', body:'Mark the target state with a phase flip (oracle), then “invert about the mean” (diffuse) to amplify it.', takeaway:'Right answers get louder; others get quieter.'}),
      disc(0.65,0.5,'TSP', {title:'TSP sketch', body:'Score routes by phase; diffusion amplifies the “best” (lowest cost) routes.', takeaway:'Amplitude ≈ preference strength.'}),
    ], quiz:{q:'Grover’s “diffuse” step does what?', opts:[{t:'Inverts about the mean',ok:true},{t:'Randomizes phases'},{t:'Resets to |0…0⟩'}] }},
  ];

  let ch=0; let cleared=false;
  function setChapter(i){ ch=Math.max(0,Math.min(chapters.length-1,i)); const C=chapters[ch]; C.slides.forEach(s=>{ s.hit=false; s.hold=0; }); progressEl.textContent = `Slide 1/${C.slides.length}`; chapterEl.textContent = `Chapter: ${C.name}`; titleEl.textContent='Hover a disc'; bodyEl.textContent='Point index finger to reveal the slide.'; takeawayEl.textContent=''; oldEl.textContent=''; newEl.textContent=''; cleared=false; }

  function showSlide(s){ titleEl.textContent=s.content.title; bodyEl.textContent=s.content.body; takeawayEl.textContent=s.content.takeaway||''; oldEl.textContent=s.content.old||''; newEl.textContent=s.content.new||''; }

  // Quiz modal
  function showQuiz(){ const C=chapters[ch]; levelModal.classList.add('show'); modalTitle.textContent='Quick Check'; modalBody.textContent=C.quiz.q; quizEl.innerHTML=''; C.quiz.opts.forEach((o,idx)=>{ const b=document.createElement('button'); b.className='quizBtn'; b.textContent=o.t; b.onclick=()=>{ if (o.ok){ b.classList.add('correct'); setTimeout(()=>{ levelModal.classList.remove('show'); setChapter(ch+1); }, 600); } else { b.classList.add('wrong'); } }; quizEl.appendChild(b); }); }
  modalNext.addEventListener('click', ()=>{ levelModal.classList.remove('show'); setChapter(ch+1); });

  prevBtn.addEventListener('click', ()=> setChapter(ch-1));
  nextBtn.addEventListener('click', ()=> setChapter(ch+1));

  // Hand tracking
  function onResults(res){ ctx.clearRect(0,0,W,H); ctx.save(); ctx.translate(W,0); ctx.scale(-1,1); if (res.multiHandLandmarks && res.multiHandLandmarks.length){ const lm=res.multiHandLandmarks[0]; const tip=lm[8]; const mx=(1-tip.x)*W, my=tip.y*H; statusEl.textContent='Hover a disc to reveal'; ctx.fillStyle='#22d3ee'; ctx.beginPath(); ctx.arc(mx,my,6,0,Math.PI*2); ctx.fill(); const C=chapters[ch]; let idx=0, seen=0; for (const s of C.slides){ const x=s.x*W, y=s.y*H; // draw disc
      ctx.strokeStyle='rgba(34,211,238,0.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,30,0,Math.PI*2); ctx.stroke(); ctx.fillStyle=s.hit?'rgba(34,197,94,0.25)':'rgba(34,211,238,0.18)'; ctx.beginPath(); ctx.arc(x,y,30,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#e6edf3'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.fillText(s.label, x, y+4);
      if (s.hit) { seen++; continue; }
      const d2=(mx-x)*(mx-x)+(my-y)*(my-y); if (d2<34*34){ s.hold++; if (s.hold>28){ s.hit=true; showSlide(s); seen++; } } else { s.hold=0; }
      idx++; }
    progressEl.textContent = `Slide ${Math.min(seen+1, C.slides.length)}/${C.slides.length}`; if (!cleared && seen===C.slides.length){ cleared=true; showQuiz(); }
  } else { statusEl.textContent='Show your hand to start'; }
    ctx.restore(); }

  async function start(){ overlay.style.display='none'; try{ const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false}); video.srcObject=stream; const h = new Hands({locateFile:(f)=>`vendor/mediapipe/${f}`}); h.setOptions({ maxNumHands:1, modelComplexity:1, minDetectionConfidence:0.5, minTrackingConfidence:0.5 }); h.onResults(onResults); const cam = new Camera(video, { onFrame: async ()=>{ await h.send({image: video}); }, width: W, height: H }); cam.start(); }catch(e){ statusEl.textContent='Camera blocked; allow access'; } }
  overlay.addEventListener('click', start);

  setChapter(0);
})();

