import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { inPeriod } from "../utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#2196F3","#4CAF50","#FF9800","#E91E63","#9C27B0","#00BCD4","#FF5722","#8BC34A"];

const isSaving = (category) => {
  const big = (category || "").split(">")[0].trim();
  return big.includes("저축") || big.includes("적금") || big.includes("투자");
};

export default function Analysis({ user, month, period }) {
  const uid = user.uid;
  const [allExpenses, setAllExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [y, m] = month.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

      const eSnap = await get(ref(db, `users/${uid}/expenses/${month}`));
      const nextSnap = await get(ref(db, `users/${uid}/expenses/${nextMonth}`));

      const all = [
        ...Object.values(eSnap.val() || {}),
        ...Object.values(nextSnap.val() || {}),
      ];
      setAllExpenses(all);

      const bSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
      setBudgets(Object.values(bSnap.val() || {}));
    };
    load();
  }, [uid, month]);

  const fmt = (n) => n.toLocaleString("ko-KR") + "원";

  // 월급 기간 필터
  const expenses = allExpenses.filter((e) => inPeriod(e.date, period));

  const spendingList = expenses.filter((e) => !isSaving(e.category));
  const savingList = expenses.filter((e) => isSaving(e.category));

  const catMap = {};
  spendingList.forEach((e) => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });

  const savingMap = {};
  savingList.forEach((e) => {
    savingMap[e.category] = (savingMap[e.category] || 0) + e.amount;
  });

  const payMap = {};
  spendingList.forEach((e) => {
    const key = e.payment || "미분류";
    payMap[key] = (payMap[key] || 0) + e.amount;
  });

  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const savingPieData = Object.entries(savingMap).map(([name, value]) => ({ name, value }));
  const payPieData = Object.entries(payMap).map(([name, value]) => ({ name, value }));
  const barData = budgets.filter((b) => !isSaving(b.category)).map((b) => ({
    name: b.category,
    예산: b.amount,
    지출: catMap[b.category] || 0,
  }));
  const savingBarData = budgets.filter((b) => isSaving(b.category)).map((b) => ({
    name: b.category,
    목표: b.amount,
    저축: savingMap[b.category] || 0,
  }));

  const totalSpending = spendingList.reduce((s, e) => s + e.amount, 0);
  const totalSaving = savingList.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="page">
      <h2>{period.label} 분석</h2>

      {expenses.length === 0 ? (
        <p className="empty">분석할 데이터가 없어요</p>
      ) : (
        <>
          <div className="card-grid" style={{ marginBottom: 16 }}>
            <div className="summary-card" style={{ borderTop: "4px solid #F44336" }}>
              <div className="card-label">총 지출</div>
              <div className="card-value" style={{ color: "#F44336" }}>{fmt(totalSpending)}</div>
            </div>
            <div className="summary-card" style={{ borderTop: "4px solid #9C27B0" }}>
              <div className="card-label">총 저축</div>
              <div className="card-value" style={{ color: "#9C27B0" }}>{fmt(totalSaving)}</div>
            </div>
          </div>

          {pieData.length > 0 && (
            <>
              <div className="card">
                <h3>💸 카테고리별 지출 비율</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {barData.length > 0 && (
                <div className="card">
                  <h3>💸 예산 vs 실제 지출</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => (v / 10000) + "만"} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="예산" fill="#2196F3" />
                      <Bar dataKey="지출" fill="#F44336" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {payPieData.length > 0 && (
            <div className="card">
              <h3>💳 결제수단별 지출</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={payPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {payPieData.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pay-summary">
                {payPieData.sort((a, b) => b.value - a.value).map((p, i) => (
                  <div key={i} className="pay-summary-item">
                    <div className="pay-dot" style={{ background: COLORS[(i + 3) % COLORS.length] }} />
                    <span>{p.name}</span>
                    <span className="pay-amount">{fmt(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {savingPieData.length > 0 && (
            <>
              <div className="card">
                <h3>💜 저축 현황</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={savingPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {savingPieData.map((_, i) => <Cell key={i} fill={["#9C27B0","#CE93D8","#7B1FA2","#E1BEE7"][i % 4]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {savingBarData.length > 0 && (
                <div className="card">
                  <h3>💜 저축 목표 vs 실적</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={savingBarData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => (v / 10000) + "만"} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="목표" fill="#CE93D8" />
                      <Bar dataKey="저축" fill="#9C27B0" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          <div className="card">
            <h3>카테고리 상세</h3>
            <table className="analysis-table">
              <thead>
                <tr><th>카테고리</th><th>금액</th><th>예산/목표</th><th>잔액</th></tr>
              </thead>
              <tbody>
                {Object.entries({ ...catMap, ...savingMap }).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const bud = budgets.find((b) => b.category === cat)?.amount || 0;
                  const diff = bud - amt;
                  const saving = isSaving(cat);
                  return (
                    <tr key={cat}>
                      <td>{saving ? "💜 " : ""}{cat}</td>
                      <td>{fmt(amt)}</td>
                      <td>{bud ? fmt(bud) : "-"}</td>
                      <td className={diff < 0 ? "over" : ""}>{bud ? fmt(diff) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}