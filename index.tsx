import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    // Defer the registration call to the next tick of the event loop.
    // This can help avoid "invalid state" errors by ensuring the document
    // is fully stable before registration is attempted, especially in complex
    // scenarios or race conditions.
    setTimeout(() => {
      const swUrl = `${window.location.origin}/sw.js`;
      navigator.serviceWorker.register(swUrl).catch(registrationError => {
        console.error('ServiceWorker registration failed: ', registrationError);
      });
    }, 0);
  }
};

// To prevent "The document is in an invalid state" errors, we must ensure
// the service worker is registered only after the page has fully loaded.
if (document.readyState === 'complete') {
  registerServiceWorker();
} else {
  window.addEventListener('load', registerServiceWorker);
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
