import React from 'react';

type Props = {
  saved: Record<string, number | string>;
  rows: any[];
};

const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function payback(invest: number, annuals: number[], discountRate = 0) {
  let acc = 0;
  let discountFactor = 1;
  for (let i = 0; i < annuals.length; i++) {
    discountFactor *= 1 + discountRate;
    const cf = discountRate > 0 ? annuals[i] / discountFactor : annuals[i];
    const prev = acc;
    acc += cf;
    if (acc >= invest && cf > 0) return i + (invest - prev) / cf;
  }
  return null;
}

function formatYears(v: number | null) {
  if (v == null || !Number.isFinite(v)) return 'Não atingido';
  const years = Math.floor(v);
  let months = Math.round((v - years) * 12);
  if (months === 12) return `${years + 1} anos`;
  if (years === 0) return `${months} meses`;
  return months ? `${years} anos e ${months} meses` : `${years} anos`;
}

function irr(invest: number, annuals: number[]) {
  const cash = [-invest, ...annuals];
  const npv = (r: number) => cash.reduce((sum, cf, i) => sum + cf / Math.pow(1 + r, i), 0);
  let lo = -0.99;
  let hi = 5;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 180; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 0.01) return mid * 100;
    if (npv(lo) * v <= 0) hi = mid; else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

function npv(invest: number, annuals: number[], rate: number, years: number) {
  return -invest + annuals.slice(0, years).reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i + 1), 0);
}

function reinvested(rows: any[], kind: 'pk' | 'top', rate: number, year: number) {
  let acc = 0;
  for (let i = 0; i < Math.min(year, rows.length); i++) {
    const annual = kind === 'pk' ? Number(rows[i].pkAnual || 0) : Number(rows[i].topAnual || 0);
    acc = acc * (1 + rate) + annual;
  }
  const r = rows[Math.min(year, rows.length) - 1];
  if (!r) return acc;
  const residual = kind === 'pk'
    ? Number(r.pkTotal || 0) - Number(r.pkAcc || 0)
    : Number(r.topTotal || 0) - Number(r.topAcc || 0);
  return acc + Math.max(residual, 0);
}

function crossover(rows: any[], kind: 'pk' | 'top', invest: number, rate: number) {
  for (let year = 1; year <= rows.length; year++) {
    const project = reinvested(rows, kind, rate, year);
    const cdi = invest * Math.pow(1 + rate, year);
    if (project >= cdi) return `Ano ${year}`;
  }
  return 'Não ultrapassa';
}

export default function MetricsPanel({ saved, rows }: Props) {
  if (!rows?.length) return null;

  const pkInvest = Number(saved.pkInvest || 0);
  const topInvest = Number(saved.topInvest || 0);
  const cdiGross = Number(saved.cdi || 0) / 100;
  const assumedIr = 0.15;
  const cdiNet = cdiGross * (1 - assumedIr);
  const horizon = Math.min(10, rows.length);
  const finalYear = rows.length;
  const pkAnnuals = rows.map(r => Number(r.pkAnual || 0));
  const topAnnuals = rows.map(r => Number(r.topAnual || 0));

  const pkPB = payback(pkInvest, pkAnnuals);
  const topPB = payback(topInvest, topAnnuals);
  const pkPBD = payback(pkInvest, pkAnnuals, cdiNet);
  const topPBD = payback(topInvest, topAnnuals, cdiNet);
  const pkIRR = irr(pkInvest, pkAnnuals);
  const topIRR = irr(topInvest, topAnnuals);
  const pkNPV = npv(pkInvest, pkAnnuals, cdiNet, horizon);
  const topNPV = npv(topInvest, topAnnuals, cdiNet, horizon);
  const pkROI = pkInvest > 0 ? (pkAnnuals.slice(0, horizon).reduce((a, b) => a + b, 0) - pkInvest) / pkInvest * 100 : 0;
  const topROI = topInvest > 0 ? (topAnnuals.slice(0, horizon).reduce((a, b) => a + b, 0) - topInvest) / topInvest * 100 : 0;
  const pkReinv10 = reinvested(rows, 'pk', cdiNet, horizon);
  const topReinv10 = reinvested(rows, 'top', cdiNet, horizon);
  const pkReinvFinal = reinvested(rows, 'pk', cdiNet, finalYear);
  const topReinvFinal = reinvested(rows, 'top', cdiNet, finalYear);
  const pkCross = crossover(rows, 'pk', pkInvest, cdiNet);
  const topCross = crossover(rows, 'top', topInvest, cdiNet);

  const metrics = [
    ['Investimento inicial', money(pkInvest), money(topInvest)],
    ['Payback simples', formatYears(pkPB), formatYears(topPB)],
    ['Payback descontado', formatYears(pkPBD), formatYears(topPBD)],
    ['TIR estimada', pkIRR == null ? 'N/D' : pct(pkIRR), topIRR == null ? 'N/D' : pct(topIRR)],
    [`VPL (${horizon} anos)`, money(pkNPV), money(topNPV)],
    [`ROI acumulado (${horizon} anos)`, pct(pkROI), pct(topROI)],
    ['Ultrapassa CDI líquido', pkCross, topCross],
    [`Patrimônio reinvestido (${horizon} anos)`, money(pkReinv10), money(topReinv10)],
    [`Patrimônio reinvestido (${finalYear} anos)`, money(pkReinvFinal), money(topReinvFinal)],
  ];

  const bestPB = pkPB != null && topPB != null ? (pkPB < topPB ? 'PK' : topPB < pkPB ? 'TOPSUN' : 'Empate') : '—';
  const bestVPL = pkNPV > topNPV ? 'PK' : topNPV > pkNPV ? 'TOPSUN' : 'Empate';
  const bestFinal = pkReinvFinal > topReinvFinal ? 'PK' : topReinvFinal > pkReinvFinal ? 'TOPSUN' : 'Empate';

  return (
    <section className="bg-[#0d1117] border border-white/5 rounded-3xl shadow-2xl p-5 sm:p-6 md:p-8 mb-6 relative overflow-hidden">
      <div className="text-emerald-400 text-[11px] font-bold tracking-[0.2em] uppercase mb-3">Retorno do investimento</div>
      <h2 className="text-white text-3xl font-bold m-0 tracking-tight">Payback e métricas financeiras</h2>
      <p className="text-zinc-400 mt-3 mb-6 text-sm leading-relaxed max-w-4xl">
        Comparação individual de PK e TOPSUN. Para payback descontado e VPL, o CDI líquido estimado considera IR de 15% sobre o CDI informado, resultando em {pct(cdiNet * 100)} a.a.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-5">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">Menor payback</div>
          <div className="text-3xl text-white font-extrabold mt-2">{bestPB}</div>
        </div>
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-5">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">Maior VPL em {horizon} anos</div>
          <div className="text-3xl text-white font-extrabold mt-2">{bestVPL}</div>
        </div>
        <div className="bg-[#050505] border border-white/5 rounded-2xl p-5">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">Maior patrimônio final</div>
          <div className="text-3xl text-white font-extrabold mt-2">{bestFinal}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5">
        <table className="w-full min-w-[650px] text-sm">
          <thead className="bg-white/[0.03]">
            <tr>
              <th className="text-left px-4 py-3 text-zinc-400 font-bold">Métrica</th>
              <th className="text-right px-4 py-3 text-indigo-300 font-bold">PK</th>
              <th className="text-right px-4 py-3 text-amber-300 font-bold">TOPSUN</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([label, pk, top]) => (
              <tr key={label} className="border-t border-white/5">
                <td className="px-4 py-3 text-zinc-400">{label}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{pk}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{top}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
