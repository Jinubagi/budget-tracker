import { useEffect, useState } from "react";
import { ref, get, push, remove } from "firebase/database";
import { db } from "../firebase";
import { inPeriod } from "../utils";

const isSaving = (category) => {
  const big = (category || "").split(">")[0].trim();
  return big.includes("저축") || big.includes("적금") || big.includes("투자");
};

export default function Expense({ user, month, period }) {
  const uid = user.uid;
  const [allExpenses, setAllExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "",
    payment: "",
    memo: "",
    amount: "",
  });
  const [budgets, setBudgets] = useState([]);
  const [tab, setTab] = useState("지출");

  const load = async () => {
    // 기간이 두 달에 걸칠 수 있어서 현재 월 + 다음 달 모두 로드
    const [y, m] = month.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

    const snap = await get(ref(db, `users/${uid}/expenses/${month}`));
    const nextSnap = await get(ref(db, `users/${uid}/expenses/${nextMonth}`));

    const thisList = Object.entries(snap.val() || {}).map(([k, v]) => ({ _key: k, _month: month, ...v }));
    const nextList = Object.entries(nextSnap.val() || {}).map(([k, v]) => ({ _key: k, _month: nextMonth, ...v }));

    const all = [...thisList, ...nextList].sort((a, b) => b.date.localeCompare(a.date));
    setAllExpenses(all);

    const catSnap = await get(ref(db, `users/${uid}/categories`));
    setCategories(Object.values(catSnap.val() || {}));

    const budSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
    setBudgets(Object.values(budSnap.val() || {}));

    const paySnap = await get(ref(db, `users/${uid}/payments`));
    setPayments(Object.values(paySnap.val() || {}));
  };

  useEffect(() => { load(); }, [uid, month]);

  const submit = async () => {
    const rawAmount = Number(form.amount.replace(/,/g, ""));
    if (!rawAmount || !form.category) return alert("카테고리와 금액을 입력하세요");

    // 입력한 날짜의 월에 저장
    const expMonth = form.date.slice(0, 7);
    await push(ref(db, `users/${uid}/expenses/${expMonth}`), {
      date: form.date,
      category: form.category,
      payment: form.payment,
      memo: form.memo,
      amount: rawAmount,
    });
    setForm({ date: form.date, category: "", payment: "", memo: "", amount: "" });
    load();
  };

  const del = async (key, expMonth) => {
    await remove(ref(db, `users/${uid}/expenses/${expMonth}/${key}`));
    load();
  };

  const fmt = (n) => Number(n).toLocaleString("ko-KR");

  const handleAmountChange = (val) => {
    const raw = val.replace(/,/g, "").replace(/[^0-9]/g, "");
    setForm({ ...form, amount: raw ? Number(raw).toLocaleString("ko-KR") : "" });
  };

  // 월급 기간 내 항목만 필터
  const expenses = allExpenses.filter((e) => inPeriod(e.date, period));

  const spentMap = {};
  expenses.forEach((e) => {
    spentMap[e.category] = (spentMap[e.category] || 0) + e.amount;
  });

  const filteredExpenses = expenses.filter((e) =>
    tab === "저축" ? isSaving(e.category) : !isSaving(e.category)
  );

  const totalSpending = expenses.filter((e) => !isSaving(e.category)).reduce((s, e) => s + e.amount, 0);
  const totalSaving = expenses.filter((e) => isSaving(e.category)).reduce((s, e) => s + e.amount, 0);

  const catOptions = categories.flatMap((big) =>
    (big.subs || []).flatMap((mid) =>
      (mid.subs || []).map((small) => `${big.name} > ${mid.name} > ${small.name}`)
        .concat([`${big.name} > ${mid.name}`])
    ).concat([big.name])
  );

  return (
    <div className="page">
      <h2>{period.label} 지출/저축</h2>

      <div className="expense-form card">
        <h3>내역 추가</h3>
        <div className="form-grid">
          <label>날짜
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>카테고리
            <input
              list="cat-opts"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="카테고리"
            />
            <datalist id="cat-opts">
              {catOptions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label>결제수단
            <select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })} className="pay-select">
              <option value="">선택 안 함</option>
              {payments.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>금액 (원)
            <input
              type="text"
              value={form.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0"
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>메모
            <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="메모 (선택)" />
          </label>
        </div>
        <button onClick={submit} className="btn-primary full">추가</button>
      </div>

      <div className="exp-tabs">
        <button onClick={() => setTab("지출")} className={`exp-tab ${tab === "지출" ? "active" : ""}`}>
          💸 지출 {fmt(totalSpending)}원
        </button>
        <button onClick={() => setTab("저축")} className={`exp-tab ${tab === "저축" ? "active" : ""}`}>
          💜 저축 {fmt(totalSaving)}원
        </button>
      </div>

      {filteredExpenses.length === 0 ? (
        <p className="empty">{tab === "저축" ? "이번 기간 저축 내역이 없어요" : "이번 기간 지출 내역이 없어요"}</p>
      ) : (
        <div className="expense-list">
          {filteredExpenses.map((e) => {
            const bud = budgets.find((b) => b.category === e.category)?.amount;
            const spent = spentMap[e.category] || 0;
            const saving = isSaving(e.category);
            return (
              <div key={e._key} className="expense-item">
                <div className="exp-left">
                  <span className="exp-date">{e.date.slice(5)}</span>
                  <div>
                    <div className="exp-cat">{e.category}</div>
                    <div className="exp-sub">
                      {e.payment && <span className="exp-payment">💳 {e.payment}</span>}
                      {e.memo && <span className="exp-memo">{e.memo}</span>}
                    </div>
                  </div>
                </div>
                <div className="exp-right">
                  <span className="exp-amount" style={{ color: saving ? "#9C27B0" : "#F44336" }}>
                    {saving ? "+" : "-"}{fmt(e.amount)}원
                  </span>
                  {bud && !saving && (
                    <span className={`exp-remaining ${spent > bud ? "over" : ""}`}>
                      잔액 {fmt(bud - spent)}원
                    </span>
                  )}
                  <button onClick={() => del(e._key, e._month)} className="btn-del">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}