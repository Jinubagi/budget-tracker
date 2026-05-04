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
  const [filterCat, setFilterCat] = useState("전체");

  useEffect(() => {
    const uid = user.uid;
    const loadData = async () => {
      const budSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
      setBudgets(Object.values(budSnap.val() || {}));

      const [y, m] = month.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      const expSnap = await get(ref(db, `users/${uid}/expenses/${month}`));
      const nextExpSnap = await get(ref(db, `users/${uid}/expenses/${nextMonth}`));
      setAllExpenses([
        ...Object.values(expSnap.val() || {}),
        ...Object.values(nextExpSnap.val() || {}),
      ]);

      const tplSnap = await get(ref(db, `users/${uid}/template`));
      setTemplate(tplSnap.val());
    };
    loadData();
  }, [user, month]);

  const expenses = allExpenses.filter((e) => inPeriod(e.date, period));
  const salary = template?.salary || 0;

  const savingExpenses = expenses.filter((e) => isSaving(e.category));
  const spendingExpenses = expenses.filter((e) => !isSaving(e.category));

  // 대카테고리별 지출 집계
  const bigSpentMap = {};
  spendingExpenses.forEach((e) => {
    const big = (e.category || "기타").split(">")[0].trim();
    bigSpentMap[big] = (bigSpentMap[big] || 0) + e.amount;
  });

  // 대카테고리별 예산 집계
  const bigBudgetMap = {};
  budgets.filter((b) => !isSaving(b.category)).forEach((b) => {
    const big = (b.category || "").split(">")[0].trim();
    bigBudgetMap[big] = (bigBudgetMap[big] || 0) + b.amount;
  });

  const totalSpendingBudget = Object.values(bigBudgetMap).reduce((s, v) => s + v, 0);
  const totalSavingBudget = budgets.filter((b) => isSaving(b.category)).reduce((s, b) => s + b.amount, 0);
  const totalExpense = spendingExpenses.reduce((s, e) => s + e.amount, 0);
  const totalSaving = savingExpenses.reduce((s, e) => s + e.amount, 0);
  const totalRemaining = totalSpendingBudget - totalExpense;

  const fmt = (n) => n.toLocaleString("ko-KR") + "원";

  const cards = [
    { label: "이번 달 월급", value: salary, color: "#4CAF50" },
    { label: "지출 예산", value: totalSpendingBudget, color: "#2196F3" },
    { label: "실제 지출", value: totalExpense, color: "#F44336" },
    { label: "예산 잔여액", value: totalRemaining, color: totalRemaining >= 0 ? "#FF9800" : "#F44336" },
    { label: "저축 목표", value: totalSavingBudget, color: "#9C27B0" },
    { label: "이번 달 저축", value: totalSaving, color: "#00BCD4" },
  ];

  // 필터 옵션
  const bigCats = ["전체", ...Object.keys(bigSpentMap)];

  // 필터 적용된 대카테고리 목록
  const displayCats = filterCat === "전체"
    ? Object.keys({ ...bigBudgetMap, ...bigSpentMap })
    : [filterCat];

  return (
    <div className="page">
      <h2>{period.label} 현황</h2>

      {/* 요약 카드 */}
      <div className="card-grid">
        {cards.map((c) => (
          <div key={c.label} className="summary-card" style={{ borderTop: `4px solid ${c.color}` }}>
            <div className="card-label">{c.label}</div>
            <div className="card-value" style={{ color: c.color }}>{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      {/* 전체 예산 진행바 */}
      {totalSpendingBudget > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="cat-header" style={{ marginBottom: 6 }}>
            <span>전체 지출 진행률</span>
            <span>{((totalExpense / totalSpendingBudget) * 100).toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{
              width: `${Math.min((totalExpense / totalSpendingBudget) * 100, 100)}%`,
              background: totalExpense > totalSpendingBudget ? "#F44336" : "#2196F3"
            }} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "#888", marginTop: 6, textAlign: "right" }}>
            잔여 {fmt(totalRemaining)}
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="filter-wrap">
        {bigCats.map((cat) => (
          <button key={cat} onClick={() => setFilterCat(cat)} className={`filter-btn ${filterCat === cat ? "active" : ""}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* 대카테고리별 지출 */}
      <h3>카테고리별 현황</h3>
      {displayCats.length === 0 ? (
        <p className="empty">이번 기간 지출 내역이 없어요</p>
      ) : (
        <div className="cat-list">
          {displayCats.map((cat) => {
            const bud = bigBudgetMap[cat] || 0;
            const spent = bigSpentMap[cat] || 0;
            const remaining = bud - spent;
            const pct = bud ? Math.min((spent / bud) * 100, 100) : 100;
            const over = bud > 0 && spent > bud;
            return (
              <div key={cat} className="cat-item">
                <div className="cat-header">
                  <span style={{ fontWeight: 600 }}>{cat}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {bud > 0 && (
                      <span className="pct-badge" style={{ color: over ? "#F44336" : "#888" }}>
                        {((spent / bud) * 100).toFixed(1)}%
                      </span>
                    )}
                    <span className={over ? "over" : ""}>{fmt(spent)}{bud ? ` / ${fmt(bud)}` : ""}</span>
                  </div>
                </div>
                {bud > 0 && (
                  <div className="progress-bar" style={{ marginBottom: 4 }}>
                    <div className="progress-fill" style={{
                      width: `${pct}%`,
                      background: over ? "#F44336" : "#2196F3"
                    }} />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginTop: 2 }}>
                  <span style={{ color: "#888" }}>지출 {fmt(spent)}</span>
                  {bud > 0 && (
                    <span style={{ color: over ? "#F44336" : "#4CAF50", fontWeight: 600 }}>
                      잔액 {fmt(remaining)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 저축 현황 */}
      {savingExpenses.length > 0 && (
        <>
          <h3>💜 저축 현황</h3>
          <div className="cat-list">
            {Object.entries(
              savingExpenses.reduce((acc, e) => {
                const big = (e.category || "").split(">")[0].trim();
                acc[big] = (acc[big] || 0) + e.amount;
                return acc;
              }, {})
            ).map(([cat, amt]) => {
              const bud = budgets.filter((b) => (b.category || "").split(">")[0].trim() === cat)
                .reduce((s, b) => s + b.amount, 0);
              const pct = bud ? Math.min((amt / bud) * 100, 100) : 100;
              return (
                <div key={cat} className="cat-item">
                  <div className="cat-header">
                    <span style={{ fontWeight: 600 }}>{cat}</span>
                    <span>{fmt(amt)}{bud ? ` / ${fmt(bud)}` : ""}</span>
                  </div>
                  {bud > 0 && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: "#9C27B0" }} />
                    </div>
                  )}
                  {bud > 0 && (
                    <div style={{ fontSize: "0.78rem", color: "#9C27B0", textAlign: "right", marginTop: 4 }}>
                      잔액 {fmt(bud - amt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}