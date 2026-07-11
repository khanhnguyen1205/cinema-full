import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("cinema_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (userData) => {
    // Never store password in localStorage
    const safe = { id: userData.id, fullName: userData.fullName, email: userData.email };
    localStorage.setItem("cinema_user", JSON.stringify(safe));
    setUser(safe);
  };

  const logout = () => {
    localStorage.removeItem("cinema_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
