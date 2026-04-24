import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";

export default function Dashboard({ user, month }) {
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    const uid = user.uid;
    const loadData = async () => {
      const budSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
      const budData = budSnap.val() || {};
      setBudgets(Object.values(budData));

      const expSnap = await get(ref(db, `users/${uid}/expenses/${month}`));
      const expData = expSnap.val() || {};
      setExpenses(Object.values(expData));

      const tplSnap = await get(ref(db, `users/${uid}/template`));
      setTemplate(tplSnap.val());
    };
    loadData();
  }, [user, month]);

  const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const salary = template?.salary || 0;
  const remaining = totalBudget - totalExpense;
  const savable = salary - totalBudget;

  const cards = [
    { label: "이번 달 월급", value: salary, color: "#4CAF50" },
    { label: "총 예산", value: totalBudget, color: "#2196F3" },
    { label: "총 지출", value: totalExpense, color: "#F44336" },
    { label: "예산 잔액", value: remaining, color: remaining >= 0 ? "#FF9800" : "#F44336" },
  ];

  const fmt = (n) => n.toLocaleString("ko-KR") + "원";

  const catMap = {};
  expenses.forEach((e) => {
    const key = e.category || "기타";
    catMap[key] = (catMap[key] || 0) + e.amount;
  });

  return (
    <div className="page">
      <h2>{month} 현황</h2>
      <div className="card-grid">
        {cards.map((c) => (
          <div key={c.label} className="summary-card" style={{ borderTop: `4px solid ${c.color}` }}>
            <div className="card-label">{c.label}</div>
            <div className="card-value" style={{ color: c.color }}>{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      {savable > 0 && (
        <div className="info-box green">
          💡 예산 설정 후 <strong>{fmt(savable)}</strong>을 저축할 수 있어요
        </div>
      )}

      <h3>카테고리별 지출</h3>
      {Object.keys(catMap).length === 0 ? (
        <p className="empty">이번 달 지출 내역이 없어요</p>
      ) : (
        <div className="cat-list">
          {Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => {
              const bud = budgets.find((b) => b.category === cat)?.amount || 0;
              const pct = bud ? Math.min((amt / bud) * 100, 100) : 100;
              const over = bud && amt > bud;
              return (
                <div key={cat} className="cat-item">
                  <div className="cat-header">
                    <span>{cat}</span>
                    <span className={over ? "over" : ""}>{fmt(amt)}{bud ? ` / ${fmt(bud)}` : ""}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: over ? "#F44336" : "#2196F3" }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}