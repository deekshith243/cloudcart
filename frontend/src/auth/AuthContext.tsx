import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, authApi, type AuthUser } from './api';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(() => authApi.hasToken());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authApi.hasToken()) return;
    void authApi
      .me()
      .then(setUser)
      .catch(() => {
        authApi.logout();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const run = async (operation: () => Promise<AuthUser>) => {
    setError(null);
    try {
      setUser(await operation());
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Authentication failed');
      throw requestError;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login: (email, password) => run(() => authApi.login(email, password)),
        register: (name, email, password) => run(() => authApi.register(name, email, password)),
        logout: () => {
          authApi.logout();
          setUser(null);
          setError(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
