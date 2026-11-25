import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ignore noise thrown solely by third-party browser extensions (e.g. MetaMask inpage.js) inside iframes
const isExtensionError = (source: unknown): boolean => {
  const text = typeof source === 'string' ? source : '';
  return text.includes('chrome-extension://') || text.includes('moz-extension://');
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { stack?: string; message?: string } | undefined;
  const stack = reason?.stack ?? '';
  const message = reason?.message ?? String(reason ?? '');
  if (isExtensionError(stack) || message.includes('Failed to connect to MetaMask')) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (isExtensionError(event.filename) || isExtensionError(event.error?.stack)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
