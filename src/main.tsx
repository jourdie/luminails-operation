import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { App } from './app/App';
import './app/styles.css';
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: false } },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
