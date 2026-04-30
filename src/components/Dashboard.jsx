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

  const totalSavingBudget = budgets.filter((b) => isSaving(b.category)).reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpendingBudget = budgets.filter((b) => !isSaving(b.category)).reduce((s, b) => s + (b.amount || 0), 0);
  const totalSaving = savingExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpense = spendingExpenses.reduce((s, e) => s + e.amount, 0);
  const totalRemaining = totalSpendingBudget - totalExpense;

  const fmt = (n) => n.toLocaleString("ko-KR") + "원";

  // 대카테고리별 집계
  const bigCatMap = {};
  spendingExpenses.forEach((e) => {
    const big = (e.category || "기타").split(">")[0].trim();
    bigCatMap[big] = (bigCatMap[big] || 0) + e.amount;
  });

  // 대카테고리별 예산 집계
  const bigBudgetMap = {};
  budgets.filter((b) => !isSaving(b.category)).forEach((b) => {
    const big = (b.category || "").split(">")[0].trim();
    bigBudgetMap[big] = (bigBudgetMap[big] || 0) + b.amount;
  });

  // 세부 카테고리별 집계 (필터용)
  const catMap = {};
  spendingExpenses.forEach((e) => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });

  // 필터 적용
  const filteredEntries = filterCat === "전체"
    ? Object.entries(bigCatMap)
    : Object.entries(catMap).filter(([cat]) => cat.startsWith(filterCat));

  // 필터 옵션 (대카테고리)
  const bigCats = ["전체", ...Object.keys(bigCatMap)];

  const cards = [
    { label: "이번 달 월급", value: salary, color: "#4CAF50" },
    { label: "지출 예산", value: totalSpendingBudget, color: "#2196F3" },
    { label: "실제 지출", value: totalExpense, color: "#F44336" },
    { label: "예산 잔여액", value: totalRemaining, color: totalRemaining >= 0 ? "#FF9800" : "#F44336" },
    { label: "저축 목표", value: totalSavingBudget, color: "#9C27B0" },
    { label: "이번 달 저축", value: totalSaving, color: "#00BCD4" },
  ];

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

      {/* 전체 예산 대비 진행바 */}
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

      {/* 카테고리 필터 */}
      <div className="filter-wrap">
        {bigCats.map((cat) => (
          <button key={cat} onClick={() => setFilterCat(cat)} className={`filter-btn ${filterCat === cat ? "active" : ""}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* 카테고리별 지출 */}
      <h3>카테고리별 지출</h3>
      {filteredEntries.length === 0 ? (
        <p className="empty">이번 기간 지출 내역이 없어요</p>
      ) : (
        <div className="cat-list">
          {filteredEntries.sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
            const bud = filterCat === "전체" ? (bigBudgetMap[cat] || 0) : (budgets.find((b) => b.category === cat)?.amount || 0);
            const pct = bud ? Math.min((amt / bud) * 100, 100) : 100;
            const over = bud && amt > bud;
            const pctLabel = bud ? `${((amt / bud) * 100).toFixed(1)}%` : "";
            return (
              <div key={cat} className="cat-item">
                <div className="cat-header">
                  <span>{cat}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {pctLabel && <span className="pct-badge" style={{ color: over ? "#F44336" : "#888" }}>{pctLabel}</span>}
                    <span className={over ? "over" : ""}>{fmt(amt)}{bud ? ` / ${fmt(bud)}` : ""}</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: over ? "#F44336" : "#2196F3" }} />
                </div>
                {bud > 0 && (
                  <div style={{ fontSize: "0.78rem", color: over ? "#F44336" : "#4CAF50", textAlign: "right", marginTop: 4 }}>
                    잔여 {fmt(bud - amt)}
                  </div>
                )}
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
                  {bud > 0 && (
                    <div style={{ fontSize: "0.78rem", color: "#9C27B0", textAlign: "right", marginTop: 4 }}>
                      잔여 {fmt(bud - amt)}
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