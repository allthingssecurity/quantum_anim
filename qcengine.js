// QCEngine-like interpreter with a friendly qc.* API
// Supported gates/APIs: reset(n), write(v) | write(bit, idx), had(i), x(i), y(i), z(i),
// rx(i,theta), ry(i,theta), rz(i,theta), cnot(c,t), cz(c,t), cp(c,t,theta), swap(i,j),
// measure() | measure(i), print(x), nop(), label(), phase(angleDeg, basisIndex),
// plus: qint.new(width,name).had()/cnot()/read() for compatibility.

const SQRT1_2 = 1/Math.sqrt(2);

function C(re=0, im=0){ return {re, im}; }
const cAdd = (a,b)=>C(a.re+b.re, a.im+b.im);
const cMul = (a,b)=>C(a.re*b.re - a.im*b.im, a.re*b.im + a.im*b.re);
const cAbs2 = (a)=>a.re*a.re + a.im*a.im;

class QState {
  constructor(n){ this.reset(n); }
  reset(n){ this.n=n; this.N=1<<n; this.psi=Array(this.N).fill(0).map(()=>C(0,0)); this.psi[0]=C(1,0); this._classical=0; }
  _applyU(t, U){
    const step=1<<t;
    for (let i=0;i<this.N;i+= step<<1){ for (let j=0;j<step;j++){
      const a=this.psi[i+j], b=this.psi[i+j+step];
      this.psi[i+j]     = cAdd(cMul(U[0][0],a), cMul(U[0][1],b));
      this.psi[i+j+step]= cAdd(cMul(U[1][0],a), cMul(U[1][1],b));
    }}
  }
  had(t){ const h=[[C(SQRT1_2,0),C(SQRT1_2,0)],[C(SQRT1_2,0),C(-SQRT1_2,0)]]; this._applyU(t,h); }
  x(t){ // swap amplitudes when bit t toggled
    const step=1<<t;
    for (let i=0;i<this.N;i+= step<<1){ for (let j=0;j<step;j++){ const i0=i+j, i1=i+j+step; const tmp=this.psi[i0]; this.psi[i0]=this.psi[i1]; this.psi[i1]=tmp; }}
  }
  y(t){ // [[0,-i],[i,0]]
    const U=[[C(0,0), C(0,-1)],[C(0,1), C(0,0)]]; this._applyU(t,U);
  }
  z(t){ // phase -1 on |1>
    const step=1<<t;
    for (let i=0;i<this.N;i+= step<<1){ for (let j=0;j<step;j++){ const i1=i+j+step; this.psi[i1].re*=-1; this.psi[i1].im*=-1; }}
  }
  rx(t,theta){ const c=Math.cos(theta/2), s=Math.sin(theta/2); const U=[[C(c,0), C(0,-s)],[C(0,-s), C(c,0)]]; this._applyU(t,U); }
  ry(t,theta){ const c=Math.cos(theta/2), s=Math.sin(theta/2); const U=[[C(c,0), C(-s,0)],[C(s,0), C(c,0)]]; this._applyU(t,U); }
  rz(t,theta){ const a=C(Math.cos(-theta/2), Math.sin(-theta/2)); const b=C(Math.cos(theta/2), Math.sin(theta/2)); const U=[[a, C(0,0)],[C(0,0), b]]; this._applyU(t,U); }
  cnot(c,t){ const maskC=1<<c; const step=1<<t; for (let i=0;i<this.N;i+= step<<1){ for (let j=0;j<step;j++){ const i0=i+j, i1=i+j+step; const c0=(i0 & maskC)!==0, c1=(i1 & maskC)!==0; if (c0===c1 && c0){ const tmp=this.psi[i0]; this.psi[i0]=this.psi[i1]; this.psi[i1]=tmp; } }} }
  cz(c,t){ const mask=(1<<c)|(1<<t); for (let i=0;i<this.N;i++){ if ((i & mask)===mask){ this.psi[i].re*=-1; this.psi[i].im*=-1; } } }
  cp(c,t,theta){ const mask=(1<<c)|(1<<t); const ph=C(Math.cos(theta), Math.sin(theta)); for (let i=0;i<this.N;i++){ if ((i & mask)===mask){ this.psi[i]=cMul(this.psi[i], ph); } } }
  swap(a,b){ if (a===b) return; const hi=Math.max(a,b), lo=Math.min(a,b); const mL=1<<lo, mH=1<<hi; for (let base=0;base<this.N;base++){ const bl=(base>>lo)&1, bh=(base>>hi)&1; if (bl!==bh){ const flip= base ^ mL ^ mH; if (flip>base){ const tmp=this.psi[base]; this.psi[base]=this.psi[flip]; this.psi[flip]=tmp; } } } }
  ccnot(c1,c2,t){ const mask=(1<<c1)|(1<<c2); const step=1<<t; for (let i=0;i<this.N;i+= step<<1){ for (let j=0;j<step;j++){ const i0=i+j, i1=i+j+step; const ok0=(i0 & mask)===mask, ok1=(i1 & mask)===mask; if (ok0===ok1 && ok0){ const tmp=this.psi[i0]; this.psi[i0]=this.psi[i1]; this.psi[i1]=tmp; } }} }
  probs(){ return this.psi.map(cAbs2); }
  writeAll(v){ const x=v>>>0; this._classical=x; this.psi=Array(this.N).fill(0).map(()=>C(0,0)); if (x<this.N) this.psi[x]=C(1,0); }
  writeBit(idx,bit){ const mask=1<<idx; if (bit) this._classical |= mask; else this._classical &= ~mask; this.writeAll(this._classical); }
  sampleOutcome(){ const p=this.probs(); let r=Math.random(), acc=0, out=0; for (let i=0;i<p.length;i++){ acc+=p[i]; if (r<acc){ out=i; break; } } this.writeAll(out); return out; }
  readBit(idx){ const out=this.sampleOutcome(); return (out>>idx)&1; }
}

// QInt for compatibility with oreilly examples
class QInt {
  constructor(state, width, name){ this.state=state; this.width=width; this.name=name; this.offset = QInt._alloc(width); }
  static _alloc(width){ const o = QInt._next; QInt._next += width; return o; }
  static resetAlloc(){ QInt._next = 0; }
  had(){ for (let i=0;i<this.width;i++) this.state.had(this.offset+i); }
  cnot(ctrlQInt){ const c = ctrlQInt.offset; const t = this.offset; this.state.cnot(c, t); }
  read(){ return this.state.readBit(this.offset); }
}
QInt._next = 0;

const QCEngineRunner = {
  runProgram(src, shots=1){
    let counts = [];
    let nQubits = 0;
    const log = [];
    function singleRun(){
      let state = new QState(1);
      QInt.resetAlloc();
      const qc = {
        reset(n){ state = new QState(n); QInt.resetAlloc(); nQubits = n; },
        write(a,b){ if (typeof b === 'number') state.writeBit(b, a?1:0); else state.writeAll(a); },
        nop(){} , label(){},
        print(x){ log.push(String(x)); },
        had(i){ state.had(i); }, x(i){ state.x(i); }, y(i){ state.y(i); }, z(i){ state.z(i); },
        rx(i,t){ state.rx(i,t); }, ry(i,t){ state.ry(i,t); }, rz(i,t){ state.rz(i,t); },
        cnot(c,t){ state.cnot(c,t); }, cz(c,t){ state.cz(c,t); }, cp(c,t,th){ state.cp(c,t,th); }, swap(i,j){ state.swap(i,j); },
        phase(angleDeg, basis){ const th=(angleDeg*Math.PI/180); const ph=C(Math.cos(th), Math.sin(th)); const idx=basis>>>0; state.psi[idx]=cMul(state.psi[idx], ph); },
        phase_flip(maskStr){ const idx = parseInt(maskStr, 2); state.psi[idx].re*=-1; state.psi[idx].im*=-1; },
        measure(i){ if (typeof i==='number'){ return state.readBit(i); } else { return state.sampleOutcome(); } },
      };
      const qint = { new(width,name){ return new QInt(state, width, name); } };
      function diffusion(){ for (let i=0;i<state.n;i++) state.had(i); state.psi[0].re*=-1; state.psi[0].im*=-1; for (let i=0;i<state.n;i++) state.had(i); }
      const fn = new Function('qc','qint','diffusion', src);
      fn(qc, qint, diffusion);
      // If user measured all, state already collapsed. Otherwise sample once.
      const out = state.sampleOutcome();
      return {out, n:nQubits||state.n};
    }
    for (let s=0;s<shots;s++){
      const {out, n} = singleRun();
      if (counts.length === 0) counts = Array(1<<n).fill(0);
      counts[out]++;
      nQubits = n;
    }
    return {counts, nQubits, log};
  }
};

// expose globally for the non-module script tag
// eslint-disable-next-line no-undef
window.QCEngineRunner = QCEngineRunner;
