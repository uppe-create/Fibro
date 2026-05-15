import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { sanitizeClientSessionBootstrap } from '@/lib/app-bootstrap';
import './index.css';

sanitizeClientSessionBootstrap();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
