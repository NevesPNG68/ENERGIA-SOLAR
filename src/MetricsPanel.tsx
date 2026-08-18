import React, { useEffect, useMemo, useState } from 'react';

const defaults = {
  cdi: 14.65, prazo: 25, tarifaGrowth: 8, manutGrowth: 5, vidaUtil: 25, manutCapex: 1,
  pkInvest: 35900, pkBenefAno1: 10379.90, pkDep: 0.9543570712,
  topInvest: 26766.88, topBenefAno1: 7607.33, topDep: 0.6645641486, fioB: 16,
};

type S = Record<string, number | string>;
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(v)?v:0);
const pct=(v:number)=>`${(Number.isFinite(v)?v:0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;

function load():S{
  try { const raw=localStorage.getItem('comparativo_solar_editavel_v2'); if(raw) return {...defaults,...JSON.parse(raw)}; } catch(_) {}
  return {...defaults};
}
function rows(s:S){
  const prazo=Math.max(1,Math.round(Number(s.prazo)||1)), cdi=Number(s.cdi||0)/100, tg=Number(s.tarifaGrowth||0)/100,
  mg=Number(s.manutGrowth||0)/100, life=Math.max(1,Number(s.vidaUtil)||1), maint=Number(s.manutCapex||0)/100,
  fio=Number(s.fioB||0)/100, pkDep=Number(s.pkDep||0)/100, topDep=Number(s.topDep||0)/100;
  let cdiPk=Number(s.pkInvest||0), cdiTop=Number(s.topInvest||0), pkAcc=0, topAcc=0; const out:any[]=[];
  for(let ano=1;ano<=prazo;ano++){
    cdiPk*=1+cdi; cdiTop*=1+cdi;
    const pkAnual=Number(s.pkBenefAno1||0)*(1-fio)*Math.pow(1+tg,ano-1)*Math.pow(1-pkDep,ano-1)-Number(s.pkInvest||0)*maint*Math.pow(1+mg,ano-1);
    const topAnual=Number(s.topBenefAno1||0)*(1-fio)*Math.pow(1+tg,ano-1)*Math.pow(1-topDep,ano-1)-Number(s.topInvest||0)*maint*Math.pow(1+mg,ano-1);
    pkAcc+=pkAnual; topAcc+=topAnual;
    const pkResidual=Math.max(Number(s.pkInvest||0)*(1-ano/life),0), topResidual=Math.max(Number(s.topInvest||0)*(1-ano/life),0);
    out.push({ano,cdiPk,cdiTop,pkAnual,topAnual,pkAcc,topAcc,pkTotal:pkAcc+pkResidual,topTotal:topAcc+topResidual});
  } return out;
}
function payback(invest:number, annuals:number[], rate=0){let acc=0,df=1;for(let i=0;i<annuals.length;i++){df*=1+rate;const cf=rate?annuals[i]/df:annuals[i],prev=acc;acc+=cf;if(acc>=invest&&cf>0)return i+(invest-prev)/cf;}return null;}
function years(v:number|null){if(v==null||!Number.isFinite(v))return 'Não atingido';const y=Math.floor(v),m=Math.round((v-y)*12);return y===0?`${m} meses`:m?`${y} anos e ${m} meses`:`${y} anos`;}
function irr(invest:number,a:number[]){const c=[-invest,...a],f=(r:number)=>c.reduce((s,x,i)=>s+x/Math.pow(1+r,i),0);let lo=-.99,hi=5;if(f(lo)*f(hi)>0)return null;for(let i=0;i<180;i++){const m=(lo+hi)/2,v=f(m);if(Math.abs(v)<.01)return m*100;if(f(lo)*v<=0)hi=m;else lo=m;}return ((lo+hi)/2)*100;}
function npv(invest:number,a:number[],r:number,n:number){return -invest+a.slice(0,n).reduce((s,x,i)=>s+x/Math.pow(1+r,i+1),0);}
function reinv(r:any[],kind:'pk'|'top',rate:number,n:number){let acc=0;for(let i=0;i<Math.min(n,r.length);i++)acc=acc*(1+rate)+Number(kind==='pk'?r[i].pkAnual:r[i].topAnual);const x=r[Math.min(n,r.length)-1];if(!x)return acc;const residual=kind==='pk'?Number(x.pkTotal)-Number(x.pkAcc):Number(x.topTotal)-Number(x.topAcc);return acc+Math.max(residual,0);}

export default function MetricsPanel(){
  const [s,setS]=useState<S>(()=>load());
  useEffect(()=>{const refresh=()=>setTimeout(()=>setS(load()),50);document.addEventListener('click',refresh);return()=>document.removeEventListener('click',refresh);},[]);
  const r=useMemo(()=>rows(s),[s]); if(!r.length)return null;
  const pk=Number(s.pkInvest||0), top=Number(s.topInvest||0), net=Number(s.cdi||0)/100*.85, h=Math.min(10,r.length), f=r.length;
  const pka=r.map(x=>Number(x.pkAnual)), toa=r.map(x=>Number(x.topAnual));
  const pkpb=payback(pk,pka), toppb=payback(top,toa), pkpbd=payback(pk,pka,net), toppbd=payback(top,toa,net), pkirr=irr(pk,pka), topirr=irr(top,toa);
  const pkv=npv(pk,pka,net,h), topv=npv(top,toa,net,h), pkroi=pk?((pka.slice(0,h).reduce((a,b)=>a+b,0)-pk)/pk)*100:0, toproi=top?((toa.slice(0,h).reduce((a,b)=>a+b,0)-top)/top)*100:0;
  const pk10=reinv(r,'pk',net,h), top10=reinv(r,'top',net,h), pkf=reinv(r,'pk',net,f), topf=reinv(r,'top',net,f);
  const metrics=[['Investimento inicial',money(pk),money(top)],['Payback simples',years(pkpb),years(toppb)],['Payback descontado',years(pkpbd),years(toppbd)],['TIR estimada',pkirr==null?'N/D':pct(pkirr),topirr==null?'N/D':pct(topirr)],[`VPL (${h} anos)`,money(pkv),money(topv)],[`ROI acumulado (${h} anos)`,pct(pkroi),pct(toproi)],[`Patrimônio reinvestido (${h} anos)`,money(pk10),money(top10)],[`Patrimônio reinvestido (${f} anos)`,money(pkf),money(topf)]];
  return <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-8 pb-8"><section className="bg-[#0d1117] border border-white/5 rounded-3xl shadow-2xl p-5 sm:p-6 md:p-8"><div className="text-emerald-400 text-[11px] font-bold tracking-[0.2em] uppercase mb-3">Retorno do investimento</div><h2 className="text-white text-3xl font-bold">Payback e métricas financeiras</h2><p className="text-zinc-400 mt-3 mb-6 text-sm">PK e TOPSUN analisados separadamente. CDI líquido usado no desconto: {pct(net*100)} a.a. (IR estimado de 15%).</p><div className="overflow-x-auto rounded-2xl border border-white/5"><table className="w-full min-w-[650px] text-sm"><thead className="bg-white/[0.03]"><tr><th className="text-left px-4 py-3 text-zinc-400">Métrica</th><th className="text-right px-4 py-3 text-indigo-300">PK</th><th className="text-right px-4 py-3 text-amber-300">TOPSUN</th></tr></thead><tbody>{metrics.map(([l,a,b])=><tr key={l} className="border-t border-white/5"><td className="px-4 py-3 text-zinc-400">{l}</td><td className="px-4 py-3 text-right text-white font-semibold">{a}</td><td className="px-4 py-3 text-right text-white font-semibold">{b}</td></tr>)}</tbody></table></div></section></div>;
}
