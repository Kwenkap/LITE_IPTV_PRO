import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initApiInterceptor } from './lib/apiInterceptor.ts';

// Initialiser l'intercepteur API pour activer le fallback client-side (Netlify, etc.)
initApiInterceptor().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
