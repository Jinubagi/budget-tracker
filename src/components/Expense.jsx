import { useEffect, useState, useRef } from "react";
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
  const [budgets, setBudgets] = useState([]);
  const [listTab, setListTab] = useState("지출");
  const [inputMode, setInputMode] = useState("quick");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const fileRef = useRef();

  const today = new Date().toISOString().slice(0, 10);
  const [qDate, setQDate] = useState(today);
  const [qBig, setQBig] = useState("");
  const [qSub, setQSub] = useState("");
  const [qPay, setQPay] = useState("");
  const [qMemo, setQMemo] = useState("");
  const [qAmt, setQAmt] = useState("");

  const [rows, setRows] = useState([{ date: today, bigCat: "", subCat: "", payment: "", memo: "", amount: "" }]);

  const load = async () => {
    const [y, m] = month.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

    const snap = await get(ref(db, `users/${uid}/expenses/${month}`));
    const nextSnap = await get(ref(db, `users/${uid}/expenses/${nextMonth}`));
    const thisList = Object.entries(snap.val() || {}).map(([k, v]) => ({ _key: k, _month: month, ...v }));
    const nextList = Object.entries(nextSnap.val() || {}).map(([k, v]) => ({ _key: k, _month: nextMonth, ...v }));
    setAllExpenses([...thisList, ...nextList].sort((a, b) => b.date.localeCompare(a.date)));

    const catSnap = await get(ref(db, `users/${uid}/categories`));
    const cats = Object.values(catSnap.val() || {}).map((big) => ({
      name: big.name,
      subs: (big.subs || []).map((s) => typeof s === "string" ? s : s.name),
    }));
    setCategories(cats);

    const budSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
    setBudgets(Object.values(budSnap.val() || {}));

    const paySnap = await get(ref(db, `users/${uid}/payments`));
    setPayments(Object.values(paySnap.val() || {}));
  };

  useEffect(() => { load(); }, [uid, month]);

  const toCategory = (big, sub) => sub ? `${big} > ${sub}` : big;
  const fmt = (n) => Number(n).toLocaleString("ko-KR");
  const handleAmt = (val) => {
    const raw = val.replace(/,/g, "").replace(/[^0-9]/g, "");
    return raw ? Number(raw).toLocaleString("ko-KR") : "";
  };

  const getSubs = (bigName) => {
    const found = categories.find((c) => c.name === bigName);
    return (found?.subs || []).map((s) => typeof s === "string" ? s : s.name);
  };

  const submitQuick = async () => {
    const amt = Number(qAmt.replace(/,/g, ""));
    if (!amt || !qBig) return alert("카테고리와 금액을 입력하세요");
    const expMonth = qDate.slice(0, 7);
    await push(ref(db, `users/${uid}/expenses/${expMonth}`), {
      date: qDate, category: toCategory(qBig, qSub), payment: qPay, memo: qMemo, amount: amt,
    });
    setQBig(""); setQSub(""); setQPay(""); setQMemo(""); setQAmt("");
    load();
  };

  const submitMulti = async () => {
    const valid = rows.filter((r) => r.bigCat && r.amount);
    if (!valid.length) return alert("최소 1개 이상 입력하세요");
    await Promise.all(valid.map((row) => {
      const amt = Number(String(row.amount).replace(/,/g, ""));
      return push(ref(db, `users/${uid}/expenses/${row.date.slice(0, 7)}`), {
        date: row.date, category: toCategory(row.bigCat, row.subCat),
        payment: row.payment, memo: row.memo, amount: amt,
      });
    }));
    setRows([{ date: today, bigCat: "", subCat: "", payment: "", memo: "", amount: "" }]);
    load();
  };

  const del = async (key, expMonth) => {
    await remove(ref(db, `users/${uid}/expenses/${expMonth}/${key}`));
    load();
  };

  const expenses = allExpenses.filter((e) => inPeriod(e.date, period));
  const spentMap = {};
  expenses.forEach((e) => { spentMap[e.category] = (spentMap[e.category] || 0) + e.amount; });
  const filteredExpenses = expenses.filter((e) => listTab === "저축" ? isSaving(e.category) : !isSaving(e.category));
  const totalSpending = expenses.filter((e) => !isSaving(e.category)).reduce((s, e) => s + e.amount, 0);
  const totalSaving = expenses.filter((e) => isSaving(e.category)).reduce((s, e) => s + e.amount, 0);

  const handleAiImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAiLoading(true);
    setAiResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
              { type: "text", text: `영수증에서 지출 항목 추출해줘. JSON만 응답:\n{"items":[{"date":"YYYY-MM-DD","memo":"항목명","amount":숫자}]}\n날짜없으면 ${today} 사용.` }
            ]}]
          })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        setAiResult((parsed.items || []).map((item) => ({ ...item, bigCat: "", subCat: "" })));
      } catch { alert("인식 실패. 다시 시도해주세요."); }
      setAiLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const saveAiResult = async () => {
    if (!aiResult?.length) return;
    await Promise.all(aiResult.map((item) =>
      push(ref(db, `users/${uid}/expenses/${item.date.slice(0, 7)}`), {
        date: item.date, category: item.bigCat ? toCategory(item.bigCat, item.subCat) : "기타",
        payment: "", memo: item.memo, amount: item.amount,
      })
    ));
    setAiResult(null);
    load();
  };

  return (
    <div className="page">
      <h2>{period.label} 지출/저축</h2>

      <div className="input-mode-tabs">
        <button onClick={() => setInputMode("quick")} className={`mode-tab ${inputMode === "quick" ? "active" : ""}`}>⚡ 퀵입력</button>
        <button onClick={() => setInputMode("multi")} className={`mode-tab ${inputMode === "multi" ? "active" : ""}`}>📋 여러개</button>
        <button onClick={() => setInputMode("ai")} className={`mode-tab ${inputMode === "ai" ? "active" : ""}`}>🤖 AI인식</button>
      </div>

      {/* 퀵 입력 */}
      {inputMode === "quick" && (
        <div className="card">
          <div className="form-grid">
            <label>날짜
              <input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
            </label>
            <label>금액 (원)
              <input type="text" value={qAmt} onChange={(e) => setQAmt(handleAmt(e.target.value))} onFocus={(e) => e.target.select()} placeholder="0" />
            </label>
            <label>대카테고리
              <select value={qBig} onChange={(e) => { setQBig(e.target.value); setQSub(""); }} className="cat-select">
                <option value="">선택</option>
                {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            {qBig && getSubs(qBig).length > 0 && (
              <label>하위카테고리
                <select value={qSub} onChange={(e) => setQSub(e.target.value)} className="cat-select">
                  <option value="">선택</option>
                  {getSubs(qBig).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
            <label>결제수단
              <select value={qPay} onChange={(e) => setQPay(e.target.value)} className="pay-select">
                <option value="">선택 안 함</option>
                {payments.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>메모
              <input value={qMemo} onChange={(e) => setQMemo(e.target.value)} placeholder="메모 (선택)" />
            </label>
          </div>
          <button onClick={submitQuick} className="btn-primary full">추가</button>
        </div>
      )}

      {/* 여러개 입력 */}
      {inputMode === "multi" && (
        <div className="card">
          {rows.map((row, i) => (
            <div key={i} className="multi-row-card">
              <div className="form-grid">
                <label>날짜
                  <input type="date" value={row.date} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], date: e.target.value }; setRows(r); }} />
                </label>
                <label>금액 (원)
                  <input type="text" value={row.amount} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], amount: handleAmt(e.target.value) }; setRows(r); }} onFocus={(e) => e.target.select()} placeholder="0" />
                </label>
                <label>대카테고리
                  <select value={row.bigCat} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], bigCat: e.target.value, subCat: "" }; setRows(r); }} className="cat-select">
                    <option value="">선택</option>
                    {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </label>
                {row.bigCat && getSubs(row.bigCat).length > 0 && (
                  <label>하위카테고리
                    <select value={row.subCat} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], subCat: e.target.value }; setRows(r); }} className="cat-select">
                      <option value="">선택</option>
                      {getSubs(row.bigCat).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                )}
                <label>결제수단
                  <select value={row.payment} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], payment: e.target.value }; setRows(r); }} className="pay-select">
                    <option value="">-</option>
                    {payments.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>메모
                  <input value={row.memo} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], memo: e.target.value }; setRows(r); }} placeholder="메모" />
                </label>
              </div>
              {rows.length > 1 && <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="btn-del" style={{ float: "right" }}>✕ 삭제</button>}
            </div>
          ))}
          <div className="multi-btns">
            <button onClick={() => setRows([...rows, { date: today, bigCat: "", subCat: "", payment: "", memo: "", amount: "" }])} className="btn-add">+ 행 추가</button>
            <button onClick={submitMulti} className="btn-primary">전체 저장</button>
          </div>
        </div>
      )}

      {/* AI 인식 */}
      {inputMode === "ai" && (
        <div className="card">
          <p className="hint">영수증이나 가계부 사진을 올리면 AI가 자동으로 항목을 인식해요</p>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAiImage} />
          <button onClick={() => { fileRef.current.value = ""; fileRef.current.click(); }} className="btn-outline full" style={{ marginBottom: 12 }}>
            📷 사진 선택
          </button>
          {aiLoading && <p className="empty">🤖 AI가 분석 중이에요...</p>}
          {aiResult && (
            <>
              <h4 style={{ marginBottom: 8 }}>인식 결과 — 카테고리 선택 후 저장하세요</h4>
              {aiResult.map((item, i) => (
                <div key={i} className="ai-result-item">
                  <div className="ai-result-info">
                    <span className="exp-date">{item.date}</span>
                    <span>{item.memo}</span>
                    <strong>{fmt(item.amount)}원</strong>
                  </div>
                  <div className="cat-select-wrap">
                    <select value={item.bigCat} onChange={(e) => { const r = [...aiResult]; r[i] = { ...r[i], bigCat: e.target.value, subCat: "" }; setAiResult(r); }} className="cat-select">
                      <option value="">대카테고리</option>
                      {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    {item.bigCat && getSubs(item.bigCat).length > 0 && (
                      <select value={item.subCat} onChange={(e) => { const r = [...aiResult]; r[i] = { ...r[i], subCat: e.target.value }; setAiResult(r); }} className="cat-select">
                        <option value="">하위카테고리</option>
                        {getSubs(item.bigCat).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={saveAiResult} className="btn-primary full" style={{ marginTop: 12 }}>저장</button>
            </>
          )}
        </div>
      )}

      {/* 지출/저축 탭 */}
      <div className="exp-tabs">
        <button onClick={() => setListTab("지출")} className={`exp-tab ${listTab === "지출" ? "active" : ""}`}>
          💸 지출 {fmt(totalSpending)}원
        </button>
        <button onClick={() => setListTab("저축")} className={`exp-tab ${listTab === "저축" ? "active" : ""}`}>
          💜 저축 {fmt(totalSaving)}원
        </button>
      </div>

      {filteredExpenses.length === 0 ? (
        <p className="empty">{listTab === "저축" ? "이번 기간 저축 내역이 없어요" : "이번 기간 지출 내역이 없어요"}</p>
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