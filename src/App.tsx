import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Settings, RotateCcw, Calculator, TrendingUp, Info, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Format Utilities ---
const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const num = (v: number, d = 2) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number, d = 2) => num(v, d) + '%';

// --- Defaults and Config ---
const defaults = {
  cdi: 14.65,
  prazo: 25,
  tarifaGrowth: 8.0,
  manutGrowth: 5.0,
  vidaUtil: 25,
  manutCapex: 1.0,
  pkInvest: 35900,
  pkBenefAno1: 10379.90,
  pkDep: 0.9543570712 * 100, // Stored as percentage in state originally it was decimal, wait. 
  // Let's check original. Original used e.g. 0.9543570712 directly as value but the UI might have shown something else? 
  // Original default: pkDep: 0.9543570712. But the input was showing that directly. The math divided by 100?
  // Let's look at original math: pkDep = Number(state.pkDep||0)/100;
  // So the input was 0.9543570712 %.
  topInvest: 26766.88,
  topBenefAno1: 7607.33,
  topDep: 0.6645641486, // Original input was %
  topDegrad1: 2.5,
  topDegradSeg: 0.6,
  fioB: 16.0,
};

// Fixing default so it exactly matches original raw state values
const defaultSettings = {
  cdi: 14.65,
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

const STORAGE_KEY = 'comparativo_solar_editavel_v2'; // Using original key for compatibility

function loadState(): SettingsType {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...defaultSettings };
}

function saveState(state: SettingsType) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

const fields = [
  { key: 'cdi', label: 'CDI anual', suffix: '%', step: 0.01 },
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

// --- Business Logic exactly from original ---
function computeRows(state: SettingsType) {
  const prazo = Math.max(1, Math.round(Number(state.prazo) || 1));
  const cdi = Number(state.cdi || 0) / 100;
  const tg = Number(state.tarifaGrowth || 0) / 100;
  const mg = Number(state.manutGrowth || 0) / 100;
  const life = Math.max(1, Number(state.vidaUtil) || 1);
  const maint = Number(state.manutCapex || 0) / 100;
  const fio = Number(state.fioB || 0) / 100;
  const pkDep = Number(state.pkDep || 0) / 100;
  const topDep = Number(state.topDep || 0) / 100;

  let cdiPk = Number(state.pkInvest || 0);
  let cdiTop = Number(state.topInvest || 0);
  let pkAcc = 0, topAcc = 0;
  const rows = [];
  
  for (let ano = 1; ano <= prazo; ano++) {
    cdiPk *= 1 + cdi;
    cdiTop *= 1 + cdi;
    
    const pkAnual =
      Number(state.pkBenefAno1 || 0) * (1 - fio) * Math.pow(1 + tg, ano - 1) * Math.pow(1 - pkDep, ano - 1) -
      Number(state.pkInvest || 0) * maint * Math.pow(1 + mg, ano - 1);
      
    const topAnual =
      Number(state.topBenefAno1 || 0) * (1 - fio) * Math.pow(1 + tg, ano - 1) * Math.pow(1 - topDep, ano - 1) -
      Number(state.topInvest || 0) * maint * Math.pow(1 + mg, ano - 1);
      
    pkAcc += pkAnual;
    topAcc += topAnual;
    
    const pkResidual = Math.max(Number(state.pkInvest || 0) * (1 - ano / life), 0);
    const topResidual = Math.max(Number(state.topInvest || 0) * (1 - ano / life), 0);
    
    rows.push({
      ano,
      cdiPk,
      cdiTop,
      pkAnual,
      topAnual,
      pkAcc,
      topAcc,
      pkTotal: pkAcc + pkResidual,
      topTotal: topAcc + topResidual,
    });
  }
  return rows;
}

function byYear(rows: any[], y: number) {
  return rows.find((r) => r.ano === y) || rows[rows.length - 1];
}

function better(a: number, b: number, nameA: string, nameB: string) {
  return a > b ? nameA : b > a ? nameB : 'Empate';
}

// --- Layout Components ---
const Section = ({ title, kicker, subtitle, children, className }: any) => (
  <div className={cn("bg-[#0d1117] border border-white/5 rounded-3xl shadow-2xl p-5 sm:p-6 md:p-8 mb-6 relative overflow-hidden", className)}>
    <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
    <div className="text-indigo-400 text-[11px] font-bold tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span> {kicker}
    </div>
    <h2 className="text-white text-3xl font-bold m-0 tracking-tight">{title}</h2>
    {subtitle && <p className="text-zinc-400 mt-3 mb-6 text-sm leading-relaxed max-w-3xl">{subtitle}</p>}
    <div className={subtitle ? "" : "mt-6"}>{children}</div>
  </div>
);

// --- Main App ---
export default function App() {
  const [draft, setDraft] = useState<SettingsType>(defaultSettings);
  const [saved, setSaved] = useState<SettingsType>(defaultSettings);
  const [isClient, setIsClient] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  useEffect(() => {
    const s = loadState();
    setDraft(s);
    setSaved(s);
    setIsClient(true);
  }, []);

  const rows = useMemo(() => computeRows(saved), [saved]);

  if (!isClient) return <div className="min-h-screen bg-[#08111f]"></div>;

  const handleChange = (k: string, val: string) => {
    setDraft((prev) => ({ ...prev, [k]: val }));
  };

  const applyCalculations = () => {
    setSaved(draft);
    saveState(draft);
  };

  const restoreDefaults = () => {
    setDraft(defaultSettings);
    setSaved(defaultSettings);
    saveState(defaultSettings);
  };

  const yr5 = byYear(rows, Math.min(5, rows.length));
  const yr10 = byYear(rows, Math.min(10, rows.length));
  const yr15 = byYear(rows, Math.min(15, rows.length));
  const yr25 = byYear(rows, rows.length);

  const best10 = better(yr10.topTotal, yr10.pkTotal, 'TOPSUN', 'PK');
  const bestFim = better(yr25.topTotal, yr25.pkTotal, 'TOPSUN', 'PK');
  const checkpoints = [5, 10, 15, rows.length];

  const compareBlocks = [
    { title: 'TOPSUN vs CDI', invest: Number(saved.topInvest || 0), years: checkpoints, kind: 'top' },
    { title: 'PK vs CDI', invest: Number(saved.pkInvest || 0), years: checkpoints, kind: 'pk' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-sans selection:bg-indigo-500/30 p-3 sm:p-5 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Premissas Editáveis */}
        <Section 
          kicker="Premissas editáveis" 
          title="Comparativo Solar × CDI" 
          subtitle={<>As premissas ficam no topo e rolam junto com a página, sem sobrepor os dados. Depois de mudar qualquer campo, toque em <strong>Recalcular</strong>. Também salvo localmente no aparelho.</>}
          className="relative"
        >
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={applyCalculations}
              className="bg-white text-[#050505] rounded-xl px-6 py-3 font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg active:scale-95 flex items-center gap-2"
            >
              <Calculator size={18} />
              Recalcular Relatório
            </button>
            <button
              onClick={restoreDefaults}
              className="bg-zinc-900 border border-white/10 text-white rounded-xl px-6 py-3 font-bold text-sm hover:bg-zinc-800 transition-colors active:scale-95 flex items-center gap-2"
            >
              <RotateCcw size={18} />
              Restaurar Original
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {fields.map((f) => {
              const isFocused = focusedKey === f.key;
              const rawValue = draft[f.key as keyof SettingsType];
              
              let displayValue = rawValue;
              if (!isFocused && rawValue !== '' && rawValue !== null) {
                const numeric = Number(String(rawValue).replace(',', '.'));
                if (!isNaN(numeric)) {
                  const digits = f.step === 0.0001 ? 4 : f.step === 1 ? 0 : 2;
                  displayValue = numeric.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
                }
              }

              return (
              <div key={f.key} className="bg-[#050505] border border-white/5 text-zinc-200 rounded-2xl p-4 shadow-inner shadow-black/50">
                <label className="block text-[11px] font-bold mb-2 text-zinc-400 uppercase tracking-widest">{f.label}</label>
                <div className="flex items-center gap-2 bg-[#0a0f1a] border border-white/5 rounded-xl overflow-hidden focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  {'prefix' in f && f.prefix && (
                    <div className="px-3 py-2 text-zinc-500 text-[13px] whitespace-nowrap border-r border-white/5 bg-white/[0.02]">
                      {f.prefix}
                    </div>
                  )}
                  <input
                    type={isFocused ? "number" : "text"}
                    step={f.step}
                    value={displayValue}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    onFocus={() => setFocusedKey(f.key)}
                    onBlur={() => setFocusedKey(null)}
                    className="w-full px-3 py-2 bg-transparent text-white text-sm outline-none font-medium"
                  />
                  {'suffix' in f && f.suffix && (
                    <div className="px-3 py-2 text-zinc-500 text-[13px] whitespace-nowrap border-l border-white/5 bg-white/[0.02]">
                      {f.suffix}
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        </Section>

        {/* Resumo Executivo */}
        <Section kicker="Indicadores" title="Resumo executivo">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity"><TrendingUp size={64} /></div>
              <div className="text-[11px] uppercase tracking-widest text-indigo-400 mb-2 font-bold">CDI informado</div>
              <div className="text-4xl font-extrabold text-white tracking-tight">{pct(saved.cdi)}</div>
              <div className="text-sm text-zinc-500 mt-2 font-medium">No horizonte de {num(saved.prazo,0)} anos</div>
            </div>
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity"><TrendingUp size={64} /></div>
              <div className="text-[11px] uppercase tracking-widest text-purple-400 mb-2 font-bold">Fio B médio</div>
              <div className="text-4xl font-extrabold text-white tracking-tight">{pct(saved.fioB)}</div>
              <div className="text-sm text-zinc-500 mt-2 font-medium">Aplicado sobre a economia</div>
            </div>
            <div className={cn(
              "border rounded-2xl p-5 relative overflow-hidden transition-all",
              "bg-gradient-to-br from-[#050505] to-[#04120a] border-emerald-900/40"
            )}>
              <div className="text-[11px] uppercase tracking-widest text-emerald-400 mb-2 font-bold">Maior Acúmulo (10 anos)</div>
              <div className="text-4xl font-extrabold text-emerald-400 tracking-tight">{best10}</div>
              <div className="text-[13px] text-zinc-400 mt-3 font-medium space-y-1">
                <div className="flex justify-between items-center text-emerald-400/80">
                  <span>{best10 === 'TOPSUN' ? 'TOP (Vencedor):' : 'TOP:'}</span>
                  <span>{money(yr10.topTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400/80">
                  <span>{best10 === 'PK' ? 'PK (Vencedor):' : 'PK:'}</span>
                  <span>{money(yr10.pkTotal)}</span>
                </div>
              </div>
            </div>
            
            <div className={cn(
              "border rounded-2xl p-5 relative overflow-hidden transition-all",
              "bg-gradient-to-br from-[#050505] to-[#04120a] border-emerald-900/40"
            )}>
              <div className="text-[11px] uppercase tracking-widest text-emerald-400 mb-2 font-bold">Maior Acúmulo ({num(saved.prazo,0)} anos)</div>
              <div className="text-4xl font-extrabold text-emerald-400 tracking-tight">{bestFim}</div>
              <div className="text-[13px] text-zinc-400 mt-3 font-medium space-y-1">
                <div className="flex justify-between items-center text-emerald-400/80">
                  <span>{bestFim === 'TOPSUN' ? 'TOP (Vencedor):' : 'TOP:'}</span>
                  <span>{money(yr25.topTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400/80">
                  <span>{bestFim === 'PK' ? 'PK (Vencedor):' : 'PK:'}</span>
                  <span>{money(yr25.pkTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </Section>
        
        {/* NOVO: Gráfico Moderno com Recharts (Bônus modernizado que foi pedido) */}
        <Section kicker="Gráficos" title="Evolução do Patrimônio">
          <div className="h-[450px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPK" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTOP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
                <XAxis dataKey="ano" stroke="#71717a" tickFormatter={(v) => `Ano ${v}`} tickMargin={12} axisLine={false} tickLine={false} />
                <YAxis stroke="#71717a" tickFormatter={(v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)} width={110} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value: number) => [money(value)]}
                  labelFormatter={(label) => `Resultados no Ano ${label}`}
                  contentStyle={{ backgroundColor: '#050505', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)', padding: '12px 16px' }}
                  itemStyle={{ fontWeight: 'bold', padding: '4px 0' }}
                  labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Line type="monotone" name="Patrimônio PK" dataKey="pkTotal" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, stroke: '#050505', strokeWidth: 3 }} />
                <Line type="monotone" name="Patrimônio TOPSUN" dataKey="topTotal" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, stroke: '#050505', strokeWidth: 3 }} />
                <Line type="monotone" name="CDI Rendimento" dataKey="cdiTop" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Comparação ORIGINAL Projeto x CDI */}
        <Section kicker="Comparação" title="Projeto x CDI">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {compareBlocks.map((block) => (
              <div key={block.title} className="bg-[#050505] border border-white/5 rounded-2xl p-5 shadow-inner">
                <div className="text-[11px] uppercase tracking-widest text-indigo-400 mb-1 font-bold">{block.title}</div>
                <div className="text-[13px] text-zinc-400 mt-1 leading-[1.4] mb-6 font-medium">Investimento inicial: {money(block.invest)}</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {block.years.map(y => {
                    const r = byYear(rows, y);
                    const proj = block.kind === 'top' ? r.topTotal : r.pkTotal;
                    const cdi = block.kind === 'top' ? r.cdiTop : r.cdiPk;
                    const max = Math.max(proj, cdi, 1);
                    return (
                      <div key={y} className="bg-[#0a0f1a] border border-white/5 rounded-xl p-4">
                        <div className="font-bold text-white mb-4 flex items-center justify-between">
                          <span className="text-lg">{y} Anos</span>
                          <span className={cn("text-xs px-2.5 py-1 rounded-full font-bold", proj > cdi ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" : "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20")}>
                            {proj > cdi ? 'PROJETO VENCE' : 'CDI VENCE'}
                          </span>
                        </div>
                        <div className="space-y-5">
                          <div>
                            <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                              <span>Projeto: {money(proj)}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all duration-500", block.kind === 'top' ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${(proj / max) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                              <span>CDI Alocado: {money(cdi)}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${(cdi / max) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Conferência Rápida */}
        <Section kicker="Premissas Atuais" title="Conferência rápida">
          <div className="overflow-auto border border-white/5 rounded-2xl bg-[#050505]">
            <table className="w-full border-collapse min-w-[760px] text-[14px]">
              <thead className="bg-[#0a0f1a] border-b border-white/5">
                <tr>
                  <th className="px-5 py-4 text-left text-zinc-400 font-bold uppercase tracking-widest text-[11px]">Premissa</th>
                  <th className="px-5 py-4 text-right text-zinc-400 font-bold uppercase tracking-widest text-[11px]">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {fields.map(f => {
                  let valDisplay = '';
                  const val = saved[f.key as keyof SettingsType];
                  if ('prefix' in f && f.prefix === 'R$') valDisplay = money(val);
                  else if ('suffix' in f && f.suffix === 'anos') valDisplay = num(val,0) + ' anos';
                  else valDisplay = pct(val, f.step === 0.0001 ? 4 : 2);
                  
                  return (
                    <tr key={f.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-left font-medium text-zinc-300">{f.label}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-white tracking-tight">{valDisplay}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Fluxo Anual */}
        <Section kicker="Fluxo anual" title="Detalhe resumido">
          <div className="overflow-auto border border-white/5 rounded-2xl bg-[#050505]">
            <table className="w-full border-collapse min-w-[900px] text-[14px]">
              <thead className="bg-[#0a0f1a] border-b border-white/5">
                <tr>
                  <th className="px-4 py-4 text-left text-zinc-400 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">Ano</th>
                  <th className="px-4 py-4 text-right text-blue-400/70 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">CDI sobre PK</th>
                  <th className="px-4 py-4 text-right text-zinc-400 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">PK anual</th>
                  <th className="px-4 py-4 text-right text-zinc-400 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">PK acumulado</th>
                  <th className="px-4 py-4 text-right text-amber-500 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">PK total</th>
                  <th className="px-4 py-4 text-right text-blue-400/70 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">CDI sobre TOPSUN</th>
                  <th className="px-4 py-4 text-right text-zinc-400 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">TOPSUN anual</th>
                  <th className="px-4 py-4 text-right text-zinc-400 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">TOPSUN acumulado</th>
                  <th className="px-4 py-4 text-right text-emerald-500 font-bold uppercase tracking-widest text-[11px] sticky top-0 z-10 bg-[#0a0f1a]">TOPSUN total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 tabular-nums">
                {rows.map((r) => (
                  <tr key={r.ano} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5 text-left font-bold text-zinc-300">Ano {r.ano}</td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">{money(r.cdiPk)}</td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">{money(r.pkAnual)}</td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">{money(r.pkAcc)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-amber-400 tracking-tight">{money(r.pkTotal)}</td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">{money(r.cdiTop)}</td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">{money(r.topAnual)}</td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">{money(r.topAcc)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-400 tracking-tight">{money(r.topTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[12px] text-zinc-500 mt-4 px-2">Modelo simplificado para comparação econômica. O Fio B entra como redução média da economia anual.</div>
        </Section>
        
      </div>
    </div>
  );
}
