import React from 'react';
import ReactDOM from 'react-dom/client';
import './ui/theme/theme.css';
import { App } from './App';
import { StoreProvider } from './state/store';
import { ToastProvider } from './ui/components/Toast';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </React.StrictMode>,
);
