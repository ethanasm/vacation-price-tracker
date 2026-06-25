/**
 * Creates the REST client once and binds its getToken/refresh to useAuth(),
 * via refs so the client isn't recreated on every token change. P3 screens
 * call useApiClient().listTrips() etc.
 */
import React from 'react';
import { API_URL } from '@/lib/env';
import { useAuth } from '@/lib/auth';
import { createApiClient, type ApiClient } from './client';

const ApiClientContext = React.createContext<ApiClient | null>(null);

export function ApiClientProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { token, refresh } = useAuth();
  const tokenRef = React.useRef<string | null>(token);
  const refreshRef = React.useRef(refresh);
  React.useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  React.useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const [client] = React.useState<ApiClient>(() =>
    createApiClient({
      baseUrl: API_URL,
      getToken: () => tokenRef.current,
      refresh: () => refreshRef.current(),
    }),
  );

  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = React.useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient must be used within ApiClientProvider');
  return client;
}
