'use client';

import { Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UPProvider } from '@/providers/UpProvider';
import { TxProvider } from '@/providers/TxContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>
        <UPProvider>
          <TxProvider>{children}</TxProvider>
        </UPProvider>
      </Suspense>
    </QueryClientProvider>
  );
}
