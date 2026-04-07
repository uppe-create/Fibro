import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { Valida } from './modules/Valida.tsx';
import './index.css';

const isValidaRoute = window.location.pathname.startsWith('/valida/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isValidaRoute ? <Valida /> : <App />}
  </StrictMode>,
);
