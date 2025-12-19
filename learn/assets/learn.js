class BlochView {
  constructor(canvas, probBars) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theta = 0; // polar: 0 at |0>
    this.phi = 0;   // azimuth
    this.probBars = probBars; // {p0El, p1El}
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    this.draw();
  }
  resize(){
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.max(300, w) * dpr;
    this.canvas.height = Math.max(300, h) * dpr;
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.draw();
  }
  set(theta, phi){ this.theta = theta; this.phi = phi; this.draw(); }
  animateTo(theta, phi, ms=800){
    const t0 = performance.now();
    const sT = this.theta, sP = this.phi;
    const dT = theta - sT, dP = phi - sP;
    const ease = t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    const step = (t)=>{
      const k = Math.min(1, (t - t0)/ms);
      const e = ease(k);
      this.theta = sT + dT*e;
      this.phi = sP + dP*e;
      this.draw();
      if (k<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  probs(){
    const p1 = Math.sin(this.theta/2)**2;
    const p0 = 1 - p1;
    return {p0, p1};
  }
  updateBars(){
    if (!this.probBars) return;
    const {p0, p1} = this.probs();
    const max = Math.max(0.001, p0, p1);
    const p0h = (p0/max)*100, p1h = (p1/max)*100;
    this.probBars.p0El.style.height = p0h+"%";
    this.probBars.p1El.style.height = p1h+"%";
    this.probBars.p0Val.textContent = p0.toFixed(2);
    this.probBars.p1Val.textContent = p1.toFixed(2);
  }
  draw(){
    const ctx = this.ctx;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    const cx = w/2, cy = h/2, R = Math.min(w,h)/2 - 20;
    // sphere outline (projected circle)
    ctx.strokeStyle = '#223044'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
    // equator
    ctx.beginPath(); ctx.ellipse(cx, cy, R, R*0.35, 0, 0, Math.PI*2); ctx.stroke();
    // axes markers
    ctx.fillStyle = '#9fb0c3'; ctx.font = '12px sans-serif';
    ctx.fillText('+Z |0>', cx-18, cy-R-8);
    ctx.fillText('-Z |1>', cx-18, cy+R+14);
    ctx.fillText('+X', cx+R+6, cy+4);
    // vector projection
    const th = this.theta, ph = this.phi;
    // Bloch vector endpoint in 3D: (sin th cos ph, sin th sin ph, cos th)
    const x = Math.sin(th)*Math.cos(ph);
    const y = Math.sin(th)*Math.sin(ph);
    const z = Math.cos(th);
    // project y as vertical, x as horizontal, z as “depth” via ellipse scaling
    const px = cx + x*R;
    const py = cy - (z*0.0 + y*R*0.35); // simple faux projection
    // draw vector
    ctx.strokeStyle = '#6aa6ff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
    // head
    ctx.fillStyle = '#6aa6ff'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill();
    this.updateBars();
  }
}

export function initLearnTrack(QCEngineRunner){
  const canvas = document.getElementById('bloch');
  const p0Bar = document.getElementById('p0');
  const p1Bar = document.getElementById('p1');
  const p0Val = document.getElementById('p0v');
  const p1Val = document.getElementById('p1v');
  const bloch = new BlochView(canvas, {p0El:p0Bar, p1El:p1Bar, p0Val, p1Val});
  // Controls
  const thetaSlider = document.getElementById('theta');
  const phiSlider = document.getElementById('phi');
  const applyAngles = ()=>{
    const th = parseFloat(thetaSlider.value);
    const ph = parseFloat(phiSlider.value);
    bloch.set(th, ph);
  };
  thetaSlider.addEventListener('input', applyAngles);
  phiSlider.addEventListener('input', applyAngles);

  // Step logic
  const steps = [
    { id:'qubit', title:'Qubit & Reset', text:'A fresh qubit starts at |0⟩ (north pole).', animate:()=>bloch.animateTo(0,0), code:`qc.reset(1);\nqc.measure();` },
    { id:'had', title:'Hadamard (fair coin)', text:'H moves |0⟩ to |+⟩ (equator) → 50/50.', animate:()=>bloch.animateTo(Math.PI/2,0), code:`qc.reset(1);\nqc.had(0);\nqc.measure();` },
    { id:'ry', title:'RY(θ) changes probability', text:'RY tilts down by θ: p(1)=sin²(θ/2).', animate:()=>{}, code:`qc.reset(1);\nqc.ry(0, Math.PI/3);\nqc.measure();` },
    { id:'rz', title:'RZ(φ) changes phase', text:'Phase alone doesn’t change p — but affects interference.', animate:()=>{}, code:`// Compare two circuits:\n// A: RZ only (no change in p)\nqc.reset(1); qc.rz(0, Math.PI/2); qc.measure();\n// B: H→RZ→H (phase becomes probability)\n// qc.reset(1); qc.had(0); qc.rz(0, Math.PI/2); qc.had(0); qc.measure();` },
    { id:'pauli', title:'Pauli X/Y/Z', text:'X flips, Z changes sign of |1⟩, Y mixes both with phase.', animate:()=>bloch.animateTo(Math.PI,0), code:`qc.reset(1);\nqc.x(0);\nqc.measure();` },
    { id:'bell', title:'Build a tiny circuit', text:'H on q0 + CNOT creates a Bell state (00/11).', animate:()=>{}, code:`qc.reset(2);\nqc.had(0);\nqc.cnot(0,1);\nqc.measure();` },
  ];

  let idx = 0;
  const titleEl = document.getElementById('stepTitle');
  const textEl = document.getElementById('stepText');
  const codeEl = document.getElementById('code');
  const shotsEl = document.getElementById('shots');
  const histEl = document.getElementById('hist');
  const logEl = document.getElementById('log');
  function renderStep(){
    const s = steps[idx];
    titleEl.textContent = `${idx+1}. ${s.title}`;
    textEl.textContent = s.text;
    codeEl.value = s.code;
    if (s.id==='qubit') bloch.animateTo(0,0);
    if (s.id==='had') bloch.animateTo(Math.PI/2,0);
    if (s.id==='ry') bloch.animateTo(Math.PI/3,0);
    if (s.id==='rz') bloch.animateTo(Math.PI/2,Math.PI/2);
    if (s.id==='pauli') bloch.animateTo(Math.PI,0);
  }
  function run(shots){
    const {counts, nQubits, log} = QCEngineRunner.runProgram(codeEl.value, shots);
    const m = Math.max(1, ...counts);
    histEl.innerHTML='';
    counts.forEach((c,i)=>{
      const b=document.createElement('div'); b.className='bar'; b.style.height=`${(c/m)*100}%`;
      const lab=document.createElement('div'); lab.className='label'; lab.textContent=i.toString(2).padStart(nQubits,'0');
      const val=document.createElement('div'); val.className='value'; val.textContent=String(c);
      b.appendChild(lab); b.appendChild(val); histEl.appendChild(b);
    });
    logEl.textContent = log.join('\n');
  }

  document.getElementById('prev').addEventListener('click',()=>{ idx=Math.max(0, idx-1); renderStep(); });
  document.getElementById('next').addEventListener('click',()=>{ idx=Math.min(steps.length-1, idx+1); renderStep(); });
  document.getElementById('play').addEventListener('click',()=>{ (steps[idx].animate||(()=>{}))(); });
  document.getElementById('run').addEventListener('click',()=>{ const s=Math.max(1, Math.min(100000, parseInt(shotsEl.value,10)||300)); run(s); });

  // Initialize defaults
  thetaSlider.value = 0; phiSlider.value = 0; applyAngles();
  renderStep();
}
