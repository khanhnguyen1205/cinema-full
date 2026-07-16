import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { fetchMe, refreshSession, logoutUser } from "services/auth";

const AuthContext = createContext(null);

const IDLE_MS = 30 * 60 * 1000;    // 30' khong thao tac -> tu dang xuat
const REFRESH_MS = 13 * 60 * 1000; // xoay access token truoc khi het han (15')
const CHANNEL = "cinema-auth";     // dong bo trang thai giua cac tab

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // dang kiem tra phien ban dau
  const bcRef = useRef(null);
  const idleRef = useRef(null);

  // Kenh dong bo da tab: dang xuat/nhap o 1 tab lan sang cac tab khac tuc thi
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(CHANNEL);
    bcRef.current = bc;
    bc.onmessage = (e) => {
      if (e.data?.type === "logout") setUser(null);
      else if (e.data?.type === "login") setUser(e.data.user);
    };
    return () => { bc.close(); bcRef.current = null; };
  }, []);

  const broadcast = useCallback((msg) => { bcRef.current?.postMessage(msg); }, []);

  // Hydrate phien tu cookie httpOnly khi tai app (khong doc localStorage nua)
  useEffect(() => {
    let alive = true;
    fetchMe().then((u) => { if (alive) { setUser(u); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
    broadcast({ type: "login", user: userData });
  }, [broadcast]);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    broadcast({ type: "logout" });
  }, [broadcast]);

  // Silent refresh dinh ky de phien khong dut giua chung
  useEffect(() => {
    if (!user) return;
    const id = setInterval(async () => {
      const u = await refreshSession();
      if (!u) { setUser(null); broadcast({ type: "logout" }); } // refresh het han -> ket thuc phien
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [user, broadcast]);

  // Tu dang xuat khi khong thao tac qua IDLE_MS
  useEffect(() => {
    if (!user) return;
    const reset = () => {
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => { logout(); }, IDLE_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(idleRef.current);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
