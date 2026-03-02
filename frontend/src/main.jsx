import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { SyncProvider } from './context/SyncContext';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import './index.css';

import './utils/testGeminiAPI';

const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.has('_')) {
    params.delete('_');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
  }
}

async function clearLocalServiceWorkersAndCaches() {
  if (!isLocalDev) return;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches?.keys) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
    console.log('[local-clean] service workers and caches cleared');
  } catch (error) {
    console.warn('Local SW/cache cleanup failed:', error);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

const ensurePersistentStorage = async () => {
  try {
    if (!navigator.storage?.persist) return;
    const persisted = await navigator.storage.persisted();
    if (!persisted) await navigator.storage.persist();
  } catch (error) {
    console.warn('Storage persistence not available:', error);
  }
};

if (!isLocalDev && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    ensurePersistentStorage();
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(
      (registration) => {
        console.log('Service Worker registered:', registration.scope);
      },
      (error) => {
        console.log('Service Worker error:', error);
      }
    );
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    clearLocalServiceWorkersAndCaches();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <SubscriptionProvider>
              <SyncProvider>
                <App />
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 3000,
                    style: {
                      background: '#1a2234',
                      color: '#fff',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    },
                    success: {
                      iconTheme: {
                        primary: '#10b981',
                        secondary: '#fff',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                      },
                    },
                  }}
                />
              </SyncProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
