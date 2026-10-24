import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FirebaseProvider } from './components/FirebaseProvider';

// Suppress benign WebSocket errors from Vite/HMR in AI Studio environment and popup cancellations
if (typeof window !== 'undefined') {
  const isIgnoredMessage = (msg: string) => {
    return (
      msg.includes('WebSocket') ||
      msg.includes('websocket') ||
      msg.includes('failed to connect') ||
      msg.includes('popup-closed-by-user') ||
      msg.includes('cancelled-popup-request')
    );
  };

  // 1. Global Rejection Handler
  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event.reason?.message || event.reason || '');
    if (isIgnoredMessage(reason)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });

  // 2. Global Error Handler
  window.addEventListener('error', (event) => {
    const message = String(event.message || '');
    if (isIgnoredMessage(message)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  // 3. Intercept Console Errors (Vite prints some directly, or harmless popup cancellations)
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const msg = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ');
    if (isIgnoredMessage(msg)) {
      return; // Ignore benign cancellation errors
    }
    originalConsoleError.apply(console, args);
  };

  // 4. Intercept Console Logs (Vite sometimes logs connection failures)
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    const msg = args.join(' ');
    if (isIgnoredMessage(msg)) {
      return; // Ignore
    }
    originalConsoleLog.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirebaseProvider>
      <App />
    </FirebaseProvider>
  </StrictMode>,
);
