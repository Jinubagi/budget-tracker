import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { inPeriod } from "../utils";

const isSaving = (category) => {
  const big = (category || "").split(">")[0].trim();
  return big.includes("저축") || big.includes("적금") || big.includes("투자");
};

export default function Dashboard({ user, month, period }) {
  const [budgets, setBudgets] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    const uid = user.uid;
    const loadData = async () => {
      const budSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
      setBudgets(Object.values(budSnap.val() || {}));

      // 기간이 두 달에 걸칠 수 있어서 해당 월 + 다음 달 데이터 모두 로드
      const [y, m] = month.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

      const expSnap = await get(ref(db, `users/${uid}/expenses/${month}`));
      const nextExpSnap = await get(ref(db, `users/${uid}/expenses/${nextMonth}`));

      const all = [
        ...Object.values(expSnap.val() || {}),
        ...Object.values(nextExpSnap.val() || {}),
      ];
      setAllExpenses(all);

      const tplSnap = await get(ref(db, `users/${uid}/template`));
      setTemplate(tplSnap.val());
    };
    loadData();
  }, [user, month]);

  // 월급 기간 내 지출만 필터
  const expenses = allExpenses.filter((e) => inPeriod(e.date, period));

  const salary = template?.salary || 0;
  const savingExpenses = expenses.filter((e) => isSaving(e.category));
  const spendingExpenses = expenses.filter((e) => !isSaving(e.category));

  const totalSavingBudget = budgets.filter((b) => isSaving(b.category)).reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpendingBudget = budgets.filter((b) => !isSaving(b.category)).reduce((s, b) => s + (b.amount || 0), 0);
  const totalSaving = savingExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpense = spendingExpenses.reduce((s, e) => s + e.amount, 0);
  const remaining = totalSpendingBudget - totalExpense;

  const fmt = (n) => n.toLocaleString("ko-KR") + "원";

  const cards = [
    { label: "이번 달 월급", value: salary, color: "#4CAF50" },
    { label: "지출 예산", value: totalSpendingBudget, color: "#2196F3" },
    { label: "실제 지출", value: totalExpense, color: "#F44336" },
    { label: "지출 잔액", value: remaining, color: remaining >= 0 ? "#FF9800" : "#F44336" },
    { label: "저축 목표", value: totalSavingBudget, color: "#9C27B0" },
    { label: "이번 달 저축", value: totalSaving, color: "#00BCD4" },
  ];

  const catMap = {};
  spendingExpenses.forEach((e) => {
    const key = e.category || "기타";
    catMap[key] = (catMap[key] || 0) + e.amount;
  });

  return (
    <div className="page">
      <h2>{period.label} 현황</h2>
      <div className="card-grid">
        {cards.map((c) => (
          <div key={c.label} className="summary-card" style={{ borderTop: `4px solid ${c.color}` }}>
            <div className="card-label">{c.label}</div>
            <div className="card-value" style={{ color: c.color }}>{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      <h3>카테고리별 지출</h3>
      {Object.keys(catMap).length === 0 ? (
        <p className="empty">이번 기간 지출 내역이 없어요</p>
      ) : (
        <div className="cat-list">
          {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
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
                  <div className="progress-fill" style={{ width: `${pct}%`, background: over ? "#F44336" : "#2196F3" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {savingExpenses.length > 0 && (
        <>
          <h3>💜 저축 현황</h3>
          <div className="cat-list">
            {Object.entries(
              savingExpenses.reduce((acc, e) => {
                acc[e.category] = (acc[e.category] || 0) + e.amount;
                return acc;
              }, {})
            ).map(([cat, amt]) => {
              const bud = budgets.find((b) => b.category === cat)?.amount || 0;
              const pct = bud ? Math.min((amt / bud) * 100, 100) : 100;
              return (
                <div key={cat} className="cat-item">
                  <div className="cat-header">
                    <span>{cat}</span>
                    <span>{fmt(amt)}{bud ? ` / ${fmt(bud)}` : ""}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: "#9C27B0" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}