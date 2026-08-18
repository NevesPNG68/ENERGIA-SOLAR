import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Calculator, RotateCcw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const num = (v: number, d = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number, d = 2) => `${num(v, d)}%`;

const defaultSettings = {
  cdi: 14.65,
  cdiAno2: 14.65,
  cdiAno3: 14.65,
  cdiAno4: 14.65,
  cdiAno5: 14.65,
  cdiLongo: 14.65,
  cdiIr: 15.0,
  prazo: 25,
  tarifaGrowth: 8.0,
  manutGrowth: 5.0,
  vidaUtil: 25,
  manutCapex: 1.0,
  pkInvest: 35900,
  pkBenefAno1: 10379.90,
  pkDep: 0.9543570712,
  topInvest: 26766.88,
  topBenefAno1: 7607.33,
  topDep: 0.6645641486,
  topDegrad1: 2.5,
  topDegradSeg: 0.6,
  fioB: 16.0,
};

type SettingsType = Record<keyof typeof defaultSettings, number | string>;
const STORAGE_KEY = 'comparativo_solar_editavel_v3';

function loadState(): SettingsType {
  try {
    const v3 = localStorage.getItem(STORAGE_KEY);
    if (v3) return { ...defaultSettings, ...JSON.parse(v3) };
    const old = localStorage.getItem('comparativo_solar_editavel_v2');
    if (old) {
      const parsed = JSON.parse(old);
      const baseCdi = Number(parsed.cdi ?? defaultSettings.cdi);
      return {
        ...defaultSettings,
        ...parsed,
        cdiAno2: parsed.cdiAno2 ?? baseCdi,
        cdiAno3: parsed.cdiAno3 ?? baseCdi,
        cdiAno4: parsed.cdiAno4 ?? baseCdi,
        cdiAno5: parsed.cdiAno5 ?? baseCdi,
        cdiLongo: parsed.cdiLongo ?? baseCdi,
        cdiIr: parsed.cdiIr ?? 15,
      };
    }
  } catch (_) {}
  return { ...defaultSettings };
}
function saveState(state: SettingsType) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

const fields = [
  { key: 'cdi', label: 'CDI – Ano 1', suffix: '%', step: 0.01 },
  { key: 'cdiAno2', label: 'CDI – Ano 2', suffix: '%', step: 0.01 },
  { key: 'cdiAno3', label: 'CDI – Ano 3', suffix: '%', step: 0.01 },
  { key: 'cdiAno4', label: 'CDI – Ano 4', suffix: '%', step: 0.01 },
  { key: 'cdiAno5', label: 'CDI – Ano 5', suffix: '%', step: 0.01 },
  { key: 'cdiLongo', label: 'CDI – Ano 6 em diante', suffix: '%', step: 0.01 },
  { key: 'cdiIr', label: 'IR sobre rendimento do CDI', suffix: '%', step: 0.01 },
  { key: 'prazo', label: 'Prazo da análise', suffix: 'anos', step: 1 },
  { key: 'tarifaGrowth', label: 'Crescimento anual da tarifa', suffix: '%', step: 0.01 },
  { key: 'manutGrowth', label: 'Crescimento anual da manutenção', suffix: '%', step: 0.01 },
  { key: 'vidaUtil', label: 'Vida útil econômica', suffix: 'anos', step: 1 },
  { key: 'manutCapex', label: 'Manutenção anual sobre CAPEX', suffix: '%', step: 0.01 },
  { key: 'pkInvest', label: 'PK – investimento inicial', prefix: 'R$', step: 0.01 },
  { key: 'pkBenefAno1', label: 'PK – benefício líquido ano 1', prefix: 'R$', step: 0.01 },
  { key: 'pkDep', label: 'PK – depreciação anual equivalente', suffix: '%', step: 0.0001 },
  { key: 'topInvest', label: 'TOPSUN – investimento inicial', prefix: 'R$', step: 0.01 },
  { key: 'topBenefAno1', label: 'TOPSUN – benefício líquido ano 1', prefix: 'R$', step: 0.01 },
  { key: 'topDep', label: 'TOPSUN – depreciação anual equivalente', suffix: '%', step: 0.0001 },
  { key: 'topDegrad1', label: 'TOPSUN – degradação 1º ano', suffix: '%', step: 0.01 },
  { key: 'topDegradSeg', label: 'TOPSUN – degradação anos seguintes', suffix: '%', step: 0.01 },
  { key: 'fioB', label: 'Impacto médio do Fio B', suffix: '%', step: 0.01 },
] as const;

function cdiRateForYear(state: SettingsType, ano: number) {
  const raw = ano === 1 ? state.cdi : ano === 2 ? state.cdiAno2 : ano === 3 ? state.cdiAno3 : ano === 4 ? state.cdiAno4 : ano === 5 ? state.cdiAno5 : state.cdiLongo;
  return Number(raw || 0) / 100;
}
function cdiNetRateForYear(state: SettingsType, ano: number) {
  const ir = Math.max(0, Math.min(100, Number(state.cdiIr || 0))) / 100;
  return cdiRateForYear(state, ano) * (1 - ir);
}

function projectAnnual(state: SettingsType, kind: 'pk' | 'top', ano: number) {
  const tg = Number(state.tarifaGrowth || 0) / 100;
  const mg = Number(state.manutGrowth || 0) / 100;
  const fio = Number(state.fioB || 0) / 100;
  const invest = Number(kind === 'pk' ? state.pkInvest : state.topInvest) || 0;
  const benef = Number(kind === 'pk' ? state.pkBenefAno1 : state.topBenefAno1) || 0;
  const dep = Number(kind === 'pk' ? state.pkDep : state.topDep) / 100;
  return benef * (1 - fio) * Math.pow(1 + tg, ano - 1) * Math.pow(1 - dep, ano - 1)
    - invest * (Number(state.manutCapex || 0) / 100) * Math.pow(1 + mg, ano - 1);
}

function computeRows(state: SettingsType) {
  const prazo = Math.max(1, Math.round(Number(state.prazo) || 1));
  const life = Math.max(1, Number(state.vidaUtil) || 1);
  const pkInvest = Number(state.pkInvest || 0);
  const topInvest = Number(state.topInvest || 0);
  let cdiPkBruto = pkInvest, cdiTopBruto = topInvest;
  let cdiPk = pkInvest, cdiTop = topInvest;
  let pkAcc = 0, topAcc = 0;
  let pkReinvest = 0, topReinvest = 0;
  const rows: any[] = [];

  for (let ano = 1; ano <= prazo; ano++) {
    const gross = cdiRateForYear(state, ano);
    const net = cdiNetRateForYear(state, ano);
    cdiPkBruto *= 1 + gross;
    cdiTopBruto *= 1 + gross;
    cdiPk *= 1 + net;
    cdiTop *= 1 + net;

    const pkAnual = projectAnnual(state, 'pk', ano);
    const topAnual = projectAnnual(state, 'top', ano);
    pkAcc += pkAnual;
    topAcc += topAnual;
    pkReinvest = pkReinvest * (1 + net) + pkAnual;
    topReinvest = topReinvest * (1 + net) + topAnual;

    const pkResidual = Math.max(pkInvest * (1 - ano / life), 0);
    const topResidual = Math.max(topInvest * (1 - ano / life), 0);
    rows.push({
      ano, cdiBrutoPct: gross * 100, cdiLiquidoPct: net * 100,
      cdiPkBruto, cdiTopBruto, cdiPk, cdiTop,
      pkAnual, topAnual, pkAcc, topAcc,
      pkResidual, topResidual,
      pkTotal: pkAcc + pkResidual,
      topTotal: topAcc + topResidual,
      pkReinvestTotal: pkReinvest + pkResidual,
      topReinvestTotal: topReinvest + topResidual,
    });
  }
  return rows;
}

function payback(invest: number, annuals: number[], discountRates?: number[]) {
  let acc = 0;
  for (let i = 0; i < annuals.length; i++) {
    const cf = discountRates
      ? annuals[i] / discountRates.slice(0, i + 1).reduce((p, r) => p * (1 + r), 1)
      : annuals[i];
    const prev = acc;
    acc += cf;
    if (acc >= invest && cf > 0) return i + (invest - prev) / cf;
  }
  return null;
}
function formatYears(v: number | null) {
  if (v == null || !isFinite(v)) return 'Não atingido';
  const years = Math.floor(v);
  const months = Math.max(0, Math.round((v - years) * 12));
  if (years === 0) return `${months} meses`;
  if (months === 12) return `${years + 1} anos`;
  return months ? `${years} anos e ${months} meses` : `${years} anos`;
}
function npv(invest: number, annuals: number[], rates: number[]) {
  return -invest + annuals.reduce((sum, cf, i) => sum + cf / rates.slice(0, i + 1).reduce((p, r) => p * (1 + r), 1), 0);
}
function irr(invest: number, annuals: number[]) {
  const cash = [-invest, ...annuals];
  const f = (r: number) => cash.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
  let lo = -0.99, hi = 10;
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(f(mid)) < 0.01) return mid * 100;
    if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}
function byYear(rows: any[], y: number) { return rows.find(r => r.ano === y) || rows[rows.length - 1]; }
function crossover(rows: any[], kind: 'pk' | 'top') {
  const projectKey = kind === 'pk' ? 'pkReinvestTotal' : 'topReinvestTotal';
  const cdiKey = kind === 'pk' ? 'cdiPk' : 'cdiTop';
  const r = rows.find(row => row[projectKey] >= row[cdiKey]);
  return r ? `Ano ${r.ano}` : 'Não ultrapassa';
}
function better(a: number, b: number, nameA: string, nameB: string) { return a > b ? nameA : b > a ? nameB : 'Empate'; }

const Section = ({ title, kicker, subtitle, children }: any) => (
  <div className="bg-[#0d1117] border border-white/5 rounded-3xl shadow-2xl p-5 sm:p-6 md:p-8 mb-6 relative overflow-hidden">
    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <div className="text-indigo-400 text-[11px] font-bold tracking-[0.2em] uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500" />{kicker}</div>
    <h2 className="text-white text-3xl font-bold m-0 tracking-tight">{title}</h2>
    {subtitle && <p className="text-zinc-400 mt-3 mb-6 text-sm leading-relaxed max-w-4xl">{subtitle}</p>}
    <div className={subtitle ? '' : 'mt-6'}>{children}</div>
  </div>
);

export default function App() {
  const [draft, setDraft] = useState<SettingsType>(defaultSettings);
  const [saved, setSaved] = useState<SettingsType>(defaultSettings);
  const [isClient, setIsClient] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  useEffect(() => { const s = loadState(); setDraft(s); setSaved(s); setIsClient(true); }, []);
  const rows = useMemo(() => computeRows(saved), [saved]);
  if (!isClient) return <div className="min-h-screen bg-[#08111f]" />;

  const prazo = rows.length;
  const rates = rows.map(r => r.cdiLiquidoPct / 100);
  const pkAnnuals = rows.map(r => r.pkAnual);
  const topAnnuals = rows.map(r => r.topAnual);
  const pkInvest = Number(saved.pkInvest || 0), topInvest = Number(saved.topInvest || 0);
  const pkPb = payback(pkInvest, pkAnnuals), topPb = payback(topInvest, topAnnuals);
  const pkPbd = payback(pkInvest, pkAnnuals, rates), topPbd = payback(topInvest, topAnnuals, rates);
  const pkIrr = irr(pkInvest, pkAnnuals), topIrr = irr(topInvest, topAnnuals);
  const horizon10 = Math.min(10, prazo);
  const pkVpl10 = npv(pkInvest, pkAnnuals.slice(0, horizon10), rates.slice(0, horizon10));
  const topVpl10 = npv(topInvest, topAnnuals.slice(0, horizon10), rates.slice(0, horizon10));
  const yr10 = byYear(rows, horizon10), yrFim = byYear(rows, prazo);
  const best10 = better(yr10.topReinvestTotal, yr10.pkReinvestTotal, 'TOPSUN', 'PK');
  const bestFim = better(yrFim.topReinvestTotal, yrFim.pkReinvestTotal, 'TOPSUN', 'PK');
  const checkpoints = Array.from(new Set([5, 10, 15, prazo].filter(y => y <= prazo)));

  const applyCalculations = () => { setSaved(draft); saveState(draft); };
  const restoreDefaults = () => { setDraft(defaultSettings); setSaved(defaultSettings); saveState(defaultSettings); };

  const metricRows = [
    ['Investimento', money(pkInvest), money(topInvest)],
    ['Payback simples', formatYears(pkPb), formatYears(topPb)],
    ['Payback descontado', formatYears(pkPbd), formatYears(topPbd)],
    ['TIR estimada', pkIrr == null ? 'N/D' : pct(pkIrr), topIrr == null ? 'N/D' : pct(topIrr)],
    [`VPL (${horizon10} anos)`, money(pkVpl10), money(topVpl10)],
    ['Ultrapassa CDI líquido', crossover(rows, 'pk'), crossover(rows, 'top')],
    [`Patrimônio reinvestido (${horizon10} anos)`, money(yr10.pkReinvestTotal), money(yr10.topReinvestTotal)],
    [`Patrimônio reinvestido (${prazo} anos)`, money(yrFim.pkReinvestTotal), money(yrFim.topReinvestTotal)],
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-sans p-3 sm:p-5 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        <Section kicker="Premissas editáveis" title="Comparativo Solar × CDI" subtitle={<>O CDI agora pode variar por período e a comparação usa também o CDI líquido de IR. Os valores atuais foram preservados como ponto de partida; altere a curva e toque em <strong>Recalcular Relatório</strong>.</>}>
          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={applyCalculations} className="bg-white text-[#050505] rounded-xl px-6 py-3 font-bold text-sm hover:bg-zinc-200 active:scale-95 flex items-center gap-2"><Calculator size={18}/>Recalcular Relatório</button>
            <button onClick={restoreDefaults} className="bg-zinc-900 border border-white/10 text-white rounded-xl px-6 py-3 font-bold text-sm hover:bg-zinc-800 active:scale-95 flex items-center gap-2"><RotateCcw size={18}/>Restaurar Original</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {fields.map(f => {
              const raw = draft[f.key as keyof SettingsType];
              const isFocused = focusedKey === f.key;
              let display: any = raw;
              if (!isFocused && raw !== '') {
                const n = Number(String(raw).replace(',', '.'));
                if (!isNaN(n)) display = n.toLocaleString('pt-BR', { minimumFractionDigits: f.step === 1 ? 0 : f.step === 0.0001 ? 4 : 2, maximumFractionDigits: f.step === 1 ? 0 : f.step === 0.0001 ? 4 : 2 });
              }
              return <div key={f.key} className="bg-[#050505] border border-white/5 rounded-2xl p-4">
                <label className="block text-[11px] font-bold mb-2 text-zinc-400 uppercase tracking-widest">{f.label}</label>
                <div className="flex items-center bg-[#0a0f1a] border border-white/5 rounded-xl overflow-hidden focus-within:border-indigo-500/50">
                  {'prefix' in f && f.prefix && <div className="px-3 py-2 text-zinc-500 text-[13px] border-r border-white/5">{f.prefix}</div>}
                  <input type={isFocused ? 'number' : 'text'} step={f.step} value={display} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))} onFocus={() => setFocusedKey(f.key)} onBlur={() => setFocusedKey(null)} className="w-full px-3 py-2 bg-transparent text-white text-sm outline-none"/>
                  {'suffix' in f && f.suffix && <div className="px-3 py-2 text-zinc-500 text-[13px] border-l border-white/5 whitespace-nowrap">{f.suffix}</div>}
                </div>
              </div>;
            })}
          </div>
        </Section>

        <Section kicker="Indicadores" title="Resumo executivo">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-indigo-400 mb-2 font-bold">CDI Ano 1</div><div className="text-4xl font-extrabold text-white">{pct(saved.cdi)}</div><div className="text-sm text-zinc-500 mt-2">Líquido estimado: {pct(cdiNetRateForYear(saved,1)*100)}</div></div>
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-purple-400 mb-2 font-bold">IR CDI</div><div className="text-4xl font-extrabold text-white">{pct(saved.cdiIr)}</div><div className="text-sm text-zinc-500 mt-2">Aplicado sobre o rendimento</div></div>
            <div className="bg-gradient-to-br from-[#050505] to-[#04120a] border border-emerald-900/40 rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-emerald-400 mb-2 font-bold">Maior patrimônio ({horizon10} anos)</div><div className="text-4xl font-extrabold text-emerald-400">{best10}</div><div className="text-sm text-zinc-500 mt-2">Economia reinvestida no CDI líquido</div></div>
            <div className="bg-gradient-to-br from-[#050505] to-[#04120a] border border-emerald-900/40 rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-emerald-400 mb-2 font-bold">Maior patrimônio ({prazo} anos)</div><div className="text-4xl font-extrabold text-emerald-400">{bestFim}</div><div className="text-sm text-zinc-500 mt-2">Economia reinvestida no CDI líquido</div></div>
          </div>
        </Section>

        <Section kicker="Retorno do investimento" title="Payback, TIR e VPL" subtitle="O payback simples mostra quando a economia acumulada recupera o investimento. O descontado considera o custo de oportunidade pela curva de CDI líquido. A TIR e o VPL ajudam a comparar os projetos em termos financeiros.">
          <div className="overflow-auto border border-white/5 rounded-2xl bg-[#050505]">
            <table className="w-full min-w-[760px] text-[14px]"><thead className="bg-[#0a0f1a]"><tr><th className="px-5 py-4 text-left text-zinc-400 uppercase text-[11px]">Indicador</th><th className="px-5 py-4 text-right text-amber-400 uppercase text-[11px]">PK</th><th className="px-5 py-4 text-right text-emerald-400 uppercase text-[11px]">TOPSUN</th></tr></thead><tbody className="divide-y divide-white/5">{metricRows.map(([label, pk, top]) => <tr key={label}><td className="px-5 py-3.5 text-zinc-300 font-medium">{label}</td><td className="px-5 py-3.5 text-right font-bold text-amber-400">{pk}</td><td className="px-5 py-3.5 text-right font-bold text-emerald-400">{top}</td></tr>)}</tbody></table>
          </div>
        </Section>

        <Section kicker="Gráficos" title="Evolução do patrimônio">
          <div className="h-[460px] w-full pt-4"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false}/><XAxis dataKey="ano" stroke="#71717a" tickFormatter={v => `Ano ${v}`} axisLine={false} tickLine={false}/><YAxis stroke="#71717a" tickFormatter={v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v)} width={110} axisLine={false} tickLine={false}/><Tooltip formatter={(value:number) => [money(value)]} labelFormatter={label => `Ano ${label}`} contentStyle={{backgroundColor:'#050505',borderColor:'rgba(255,255,255,.1)',borderRadius:'16px'}}/><Legend/><Line type="monotone" name="PK – economia consumida" dataKey="pkTotal" stroke="#f59e0b" strokeWidth={2} dot={false}/><Line type="monotone" name="TOPSUN – economia consumida" dataKey="topTotal" stroke="#10b981" strokeWidth={2} dot={false}/><Line type="monotone" name="PK – economia reinvestida" dataKey="pkReinvestTotal" stroke="#f97316" strokeWidth={3} dot={false}/><Line type="monotone" name="TOPSUN – economia reinvestida" dataKey="topReinvestTotal" stroke="#22c55e" strokeWidth={3} dot={false}/><Line type="monotone" name="CDI líquido (base TOPSUN)" dataKey="cdiTop" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false}/></LineChart></ResponsiveContainer></div>
        </Section>

        <Section kicker="Comparação" title="Projeto × CDI líquido">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[
            { title:'TOPSUN vs CDI', kind:'top' as const, invest:topInvest },
            { title:'PK vs CDI', kind:'pk' as const, invest:pkInvest },
          ].map(block => <div key={block.title} className="bg-[#050505] border border-white/5 rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-indigo-400 font-bold">{block.title}</div><div className="text-[13px] text-zinc-400 mt-1 mb-6">Investimento inicial: {money(block.invest)}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{checkpoints.map(y => { const r=byYear(rows,y); const proj=block.kind==='top'?r.topReinvestTotal:r.pkReinvestTotal; const cdi=block.kind==='top'?r.cdiTop:r.cdiPk; return <div key={y} className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4"><div className="font-bold text-white mb-3 flex justify-between"><span>{y} anos</span><span className={proj>cdi?'text-emerald-400':'text-blue-400'}>{proj>cdi?'PROJETO VENCE':'CDI VENCE'}</span></div><div className="text-sm text-zinc-400">Projeto: <strong className="text-white">{money(proj)}</strong></div><div className="text-sm text-zinc-400 mt-1">CDI líquido: <strong className="text-white">{money(cdi)}</strong></div></div>;})}</div></div>)}</div>
        </Section>

        <Section kicker="Fluxo anual" title="Detalhe resumido">
          <div className="overflow-auto border border-white/5 rounded-2xl bg-[#050505]"><table className="w-full min-w-[1100px] text-[14px]"><thead className="bg-[#0a0f1a]"><tr>{['Ano','CDI bruto %','CDI líquido %','CDI líquido PK','PK anual','PK acumulado','PK total','PK reinvestido','CDI líquido TOP','TOP anual','TOP acumulado','TOP total','TOP reinvestido'].map(h=><th key={h} className="px-4 py-4 text-right text-zinc-400 uppercase text-[11px] first:text-left">{h}</th>)}</tr></thead><tbody className="divide-y divide-white/5 tabular-nums">{rows.map(r=><tr key={r.ano}><td className="px-4 py-3 text-left font-bold">Ano {r.ano}</td><td className="px-4 py-3 text-right">{pct(r.cdiBrutoPct)}</td><td className="px-4 py-3 text-right">{pct(r.cdiLiquidoPct)}</td><td className="px-4 py-3 text-right">{money(r.cdiPk)}</td><td className="px-4 py-3 text-right">{money(r.pkAnual)}</td><td className="px-4 py-3 text-right">{money(r.pkAcc)}</td><td className="px-4 py-3 text-right text-amber-400 font-bold">{money(r.pkTotal)}</td><td className="px-4 py-3 text-right text-orange-400 font-bold">{money(r.pkReinvestTotal)}</td><td className="px-4 py-3 text-right">{money(r.cdiTop)}</td><td className="px-4 py-3 text-right">{money(r.topAnual)}</td><td className="px-4 py-3 text-right">{money(r.topAcc)}</td><td className="px-4 py-3 text-right text-emerald-400 font-bold">{money(r.topTotal)}</td><td className="px-4 py-3 text-right text-green-400 font-bold">{money(r.topReinvestTotal)}</td></tr>)}</tbody></table></div>
          <div className="text-[12px] text-zinc-500 mt-4 px-2">Modelo comparativo: o Fio B reduz a economia anual; a manutenção cresce pela premissa informada; o CDI líquido aplica o IR informado sobre o rendimento; o cenário reinvestido aplica cada economia anual no CDI líquido.</div>
        </Section>
      </div>
    </div>
  );
}
