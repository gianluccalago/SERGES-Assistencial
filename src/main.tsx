import React from 'react';
import ReactDOM from 'react-dom/client';
import './ui/theme/theme.css';
import { App } from './App';
import { StoreProvider } from './state/store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
