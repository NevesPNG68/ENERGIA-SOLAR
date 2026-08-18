import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import MetricsPanel from './MetricsPanel.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="min-h-screen bg-[#050505]">
      <App />
      <MetricsPanel />
    </div>
  </StrictMode>,
);
