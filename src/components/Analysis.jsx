import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#2196F3","#4CAF50","#FF9800","#E91E63","#9C27B0","#00BCD4","#FF5722","#8BC34A"];

export default function Analysis({ user, month }) {
  const uid = user.uid;
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    const load = async () => {
      const eSnap = await get(ref(db, `users/${uid}/expenses/${month}`));
      setExpenses(Object.values(eSnap.val() || {}));
      const bSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
      setBudgets(Object.values(bSnap.val() || {}));
    };
    load();
  }, [uid, month]);

  const catMap = {};
  expenses.forEach((e) => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });

  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const barData = budgets.map((b) => ({
    name: b.category,
    예산: b.amount,
    지출: catMap[b.category] || 0,
  }));

  const fmt = (n) => n.toLocaleString("ko-KR") + "원";

  return (
    <div className="page">
      <h2>{month} 분석</h2>

      {pieData.length === 0 ? (
        <p className="empty">분석할 지출 데이터가 없어요</p>
      ) : (
        <>
          <div className="card">
            <h3>카테고리별 지출 비율</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {barData.length > 0 && (
            <div className="card">
              <h3>예산 vs 실제 지출</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => (v / 10000) + "만"} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="예산" fill="#2196F3" />
                  <Bar dataKey="지출" fill="#F44336" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3>카테고리 상세</h3>
            <table className="analysis-table">
              <thead>
                <tr><th>카테고리</th><th>지출</th><th>예산</th><th>잔액</th></tr>
              </thead>
              <tbody>
                {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const bud = budgets.find((b) => b.category === cat)?.amount || 0;
                  const diff = bud - amt;
                  return (
                    <tr key={cat}>
                      <td>{cat}</td>
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