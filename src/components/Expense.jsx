import { useEffect, useState, useRef } from "react";
import { ref, get, push, remove } from "firebase/database";
import { db } from "../firebase";
import { inPeriod } from "../utils";

const isSaving = (category) => {
  const big = (category || "").split(">")[0].trim();
  return big.includes("저축") || big.includes("적금") || big.includes("투자");
};

const EMPTY_ROW = { date: "", bigCat: "", subCat: "", payment: "", memo: "", amount: "" };

export default function Expense({ user, month, period }) {
  const uid = user.uid;
  const [allExpenses, setAllExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [listTab, setListTab] = useState("지출");
  const [inputMode, setInputMode] = useState("quick"); // quick | multi | ai
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const fileRef = useRef();

  // 퀵 입력
  const today = new Date().toISOString().slice(0, 10);
  const [quick, setQuick] = useState({ date: today, bigCat: "", subCat: "", payment: "", memo: "", amount: "" });

  // 여러개 입력
  const [rows, setRows] = useState([{ ...EMPTY_ROW, date: today }]);

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

  const saveOne = async (row) => {
    const amt = Number(String(row.amount).replace(/,/g, ""));
    if (!amt || !row.bigCat) return false;
    const expMonth = row.date.slice(0, 7);
    await push(ref(db, `users/${uid}/expenses/${expMonth}`), {
      date: row.date,
      category: toCategory(row.bigCat, row.subCat),
      payment: row.payment,
      memo: row.memo,
      amount: amt,
    });
    return true;
  };

  // 퀵 입력 제출
  const submitQuick = async () => {
    const ok = await saveOne(quick);
    if (!ok) return alert("카테고리와 금액을 입력하세요");
    setQuick({ date: quick.date, bigCat: "", subCat: "", payment: "", memo: "", amount: "" });
    load();
  };

  // 여러개 제출
  const submitMulti = async () => {
    const valid = rows.filter((r) => r.bigCat && r.amount);
    if (!valid.length) return alert("최소 1개 이상 입력하세요");
    await Promise.all(valid.map(saveOne));
    setRows([{ ...EMPTY_ROW, date: today }]);
    load();
  };

  const del = async (key, expMonth) => {
    await remove(ref(db, `users/${uid}/expenses/${expMonth}/${key}`));
    load();
  };

  const fmt = (n) => Number(n).toLocaleString("ko-KR");
  const handleAmt = (val) => {
    const raw = val.replace(/,/g, "").replace(/[^0-9]/g, "");
    return raw ? Number(raw).toLocaleString("ko-KR") : "";
  };

  const expenses = allExpenses.filter((e) => inPeriod(e.date, period));
  const spentMap = {};
  expenses.forEach((e) => { spentMap[e.category] = (spentMap[e.category] || 0) + e.amount; });

  const filteredExpenses = expenses.filter((e) =>
    listTab === "저축" ? isSaving(e.category) : !isSaving(e.category)
  );
  const totalSpending = expenses.filter((e) => !isSaving(e.category)).reduce((s, e) => s + e.amount, 0);
  const totalSaving = expenses.filter((e) => isSaving(e.category)).reduce((s, e) => s + e.amount, 0);

  // AI 사진 인식
  const handleAiImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAiLoading(true);
    setAiResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const mediaType = file.type;

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                {
                  type: "text",
                  text: `이 영수증 또는 지출 관련 이미지에서 지출 항목들을 추출해줘.
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만.
{
  "items": [
    { "date": "YYYY-MM-DD", "memo": "항목명", "amount": 숫자 }
  ]
}
날짜가 없으면 오늘 날짜(${today})를 써줘. 금액은 숫자만(콤마없이).`
                }
              ]
            }]
          })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setAiResult(parsed.items || []);
      } catch {
        alert("인식에 실패했어요. 다시 시도해주세요.");
      }
      setAiLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const saveAiResult = async () => {
    if (!aiResult?.length) return;
    await Promise.all(aiResult.map((item) =>
      push(ref(db, `users/${uid}/expenses/${item.date.slice(0, 7)}`), {
        date: item.date,
        category: item.bigCat ? toCategory(item.bigCat, item.subCat) : "기타",
        payment: item.payment || "",
        memo: item.memo,
        amount: item.amount,
      })
    ));
    setAiResult(null);
    load();
  };

  // 카테 드롭다운 컴포넌트
  const CatSelect = ({ bigVal, subVal, onBigChange, onSubChange }) => {
    const bigObj = categories.find((c) => c.name === bigVal);
    return (
      <div className="cat-select-wrap">
        <select value={bigVal} onChange={(e) => { onBigChange(e.target.value); onSubChange(""); }} className="cat-select">
          <option value="">대카테고리</option>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        {bigObj?.subs?.length > 0 && (
          <select value={subVal} onChange={(e) => onSubChange(e.target.value)} className="cat-select">
            <option value="">하위카테고리</option>
            {bigObj.subs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <h2>{period.label} 지출/저축</h2>

      {/* 입력 모드 탭 */}
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
              <input type="date" value={quick.date} onChange={(e) => setQuick({ ...quick, date: e.target.value })} />
            </label>
            <label>금액 (원)
              <input type="text" value={quick.amount} onChange={(e) => setQuick({ ...quick, amount: handleAmt(e.target.value) })} onFocus={(e) => e.target.select()} placeholder="0" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>카테고리
              <CatSelect bigVal={quick.bigCat} subVal={quick.subCat} onBigChange={(v) => setQuick({ ...quick, bigCat: v })} onSubChange={(v) => setQuick({ ...quick, subCat: v })} />
            </label>
            <label>결제수단
              <select value={quick.payment} onChange={(e) => setQuick({ ...quick, payment: e.target.value })} className="pay-select">
                <option value="">선택 안 함</option>
                {payments.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>메모
              <input value={quick.memo} onChange={(e) => setQuick({ ...quick, memo: e.target.value })} placeholder="메모 (선택)" />
            </label>
          </div>
          <button onClick={submitQuick} className="btn-primary full">추가</button>
        </div>
      )}

      {/* 여러개 입력 */}
      {inputMode === "multi" && (
        <div className="card">
          <div className="multi-table-wrap">
            <table className="multi-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>카테고리</th>
                  <th>금액</th>
                  <th>결제수단</th>
                  <th>메모</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td><input type="date" value={row.date} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], date: e.target.value }; setRows(r); }} /></td>
                    <td>
                      <CatSelect
                        bigVal={row.bigCat} subVal={row.subCat}
                        onBigChange={(v) => { const r = [...rows]; r[i] = { ...r[i], bigCat: v, subCat: "" }; setRows(r); }}
                        onSubChange={(v) => { const r = [...rows]; r[i] = { ...r[i], subCat: v }; setRows(r); }}
                      />
                    </td>
                    <td><input type="text" value={row.amount} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], amount: handleAmt(e.target.value) }; setRows(r); }} onFocus={(e) => e.target.select()} placeholder="0" /></td>
                    <td>
                      <select value={row.payment} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], payment: e.target.value }; setRows(r); }} className="pay-select">
                        <option value="">-</option>
                        {payments.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td><input value={row.memo} onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], memo: e.target.value }; setRows(r); }} placeholder="메모" /></td>
                    <td><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="btn-del">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="multi-btns">
            <button onClick={() => setRows([...rows, { ...EMPTY_ROW, date: today }])} className="btn-add">+ 행 추가</button>
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
                  <CatSelect
                    bigVal={item.bigCat || ""}
                    subVal={item.subCat || ""}
                    onBigChange={(v) => { const r = [...aiResult]; r[i] = { ...r[i], bigCat: v, subCat: "" }; setAiResult(r); }}
                    onSubChange={(v) => { const r = [...aiResult]; r[i] = { ...r[i], subCat: v }; setAiResult(r); }}
                  />
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