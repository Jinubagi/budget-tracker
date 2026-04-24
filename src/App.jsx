import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "./firebase";
import Layout from "./components/Layout";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  if (loading) return <div className="loading">로딩 중...</div>;

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>💰 가계부</h1>
          <p>스마트하게 관리하는 나의 가계부</p>
          <button onClick={login} className="login-btn">
            Google로 시작하기
          </button>
        </div>
      </div>
    );
  }

  return <Layout user={user} onLogout={logout} />;
}