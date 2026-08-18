import fs from 'node:fs';

const path = 'src/App.tsx';
let src = fs.readFileSync(path, 'utf8');

const importLine = "import MetricsPanel from './MetricsPanel';";
if (!src.includes(importLine)) {
  const marker = "import { twMerge } from 'tailwind-merge';";
  if (!src.includes(marker)) throw new Error('Marcador de import não encontrado em App.tsx');
  src = src.replace(marker, `${marker}\n${importLine}`);
}

const panelCall = '<MetricsPanel saved={saved} rows={rows} />';
if (!src.includes(panelCall)) {
  const marker = '        {/* Resumo Executivo */}';
  if (!src.includes(marker)) throw new Error('Marcador do Resumo Executivo não encontrado em App.tsx');
  src = src.replace(marker, `        ${panelCall}\n\n${marker}`);
}

fs.writeFileSync(path, src);
console.log('Painel de métricas injetado com sucesso.');
