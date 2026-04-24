import { useState } from "react";
import Dashboard from "./Dashboard";
import Budget from "./Budget";
import Expense from "./Expense";
import Analysis from "./Analysis";
import Settings from "./Settings";

const TABS = [
  { id: "dashboard", label: "대시보드", icon: "📊" },
  { id: "budget", label: "예산", icon: "📋" },
  { id: "expense", label: "지출", icon: "💸" },
  { id: "analysis", label: "분석", icon: "📈" },
  { id: "settings", label: "설정", icon: "⚙️" },
];

export default function Layout({ user, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const renderTab = () => {
    const props = { user, month };
    if (tab === "dashboard") return <Dashboard {...props} />;
    if (tab === "budget") return <Budget {...props} />;
    if (tab === "expense") return <Expense {...props} />;
    if (tab === "analysis") return <Analysis {...props} />;
    if (tab === "settings") return <Settings user={user} />;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="app-title">💰 가계부</span>
          {tab !== "settings" && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="month-picker"
            />
          )}
        </div>
        <div className="header-right">
          <span className="user-name">{user.displayName?.split(" ")[0]}</span>
          <button onClick={onLogout} className="logout-btn">로그아웃</button>
        </div>
      </header>

      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`nav-btn ${tab === t.id ? "active" : ""}`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">{renderTab()}</main>
    </div>
  );
}