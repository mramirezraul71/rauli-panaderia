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

// Utilidades de diagnóstico de Gemini (disponibles en consola)
import './utils/testGeminiAPI';

// React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      cacheTime: 1000 * 60 * 30, // 30 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ensurePersistentStorage = async () => {
  try {
    if (!navigator.storage?.persist) return;
    const persisted = await navigator.storage.persisted();
    if (!persisted) await navigator.storage.persist();
  } catch (error) {
    console.warn("Persistencia de storage no disponible:", error);
  }
};

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    ensurePersistentStorage();
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('✓ Service Worker registrado:', registration.scope);
      },
      (error) => {
        console.log('✗ Service Worker error:', error);
      }
    );
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
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
