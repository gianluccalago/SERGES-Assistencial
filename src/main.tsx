import React from 'react';
import ReactDOM from 'react-dom/client';
import './ui/theme/theme.css';
import { App } from './App';
import { StoreProvider } from './state/store';
import { ComercialProvider } from './comercial/store';
import { ApresentacaoProvider } from './apresentacao/store';
import { ToastProvider } from './ui/components/Toast';
import { AuthProvider } from './auth/AuthProvider';
import { AuthGate } from './auth/AuthGate';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate>
        <StoreProvider>
          <ComercialProvider>
            <ApresentacaoProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </ApresentacaoProvider>
          </ComercialProvider>
        </StoreProvider>
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>,
);
