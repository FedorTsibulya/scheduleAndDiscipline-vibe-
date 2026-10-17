import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupAppUpdates } from './lib/appUpdate';
import './styles.css';

setupAppUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
