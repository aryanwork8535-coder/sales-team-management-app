import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setToken, TOKEN_KEY } from './api';

type User = { id: string; employee_id: string; name: string; role: string } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (empId: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as any);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          const me = await api.me();
          setUser(me);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async (employee_id: string, password: string) => {
    const res = await api.login(employee_id, password);
    await setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
