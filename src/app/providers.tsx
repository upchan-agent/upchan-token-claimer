'use client';

import { Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UPProvider } from '@/lib/up-provider';

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
        <UPProvider>{children}</UPProvider>
      </Suspense>
    </QueryClientProvider>
  );
}
