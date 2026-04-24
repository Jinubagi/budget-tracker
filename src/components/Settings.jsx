import { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";

const DEFAULT_CATEGORIES = [
  {
    name: "식비",
    subs: [
      { name: "식재료", subs: ["마트", "온라인쇼핑"] },
      { name: "외식", subs: ["점심", "저녁", "카페"] },
      { name: "배달", subs: [] },
    ],
  },
  {
    name: "교통",
    subs: [
      { name: "대중교통", subs: ["버스", "지하철"] },
      { name: "차량", subs: ["주유", "주차", "보험"] },
    ],
  },
  {
    name: "주거",
    subs: [
      { name: "월세/관리비", subs: [] },
      { name: "생활용품", subs: [] },
      { name: "인테리어", subs: [] },
    ],
  },
  { name: "통신", subs: [{ name: "휴대폰", subs: [] }, { name: "인터넷", subs: [] }] },
  { name: "의료/건강", subs: [{ name: "병원", subs: [] }, { name: "약국", subs: [] }, { name: "운동", subs: [] }] },
  { name: "여가", subs: [{ name: "문화/취미", subs: [] }, { name: "여행", subs: [] }, { name: "구독", subs: [] }] },
  { name: "저축/투자", subs: [{ name: "저축", subs: [] }, { name: "투자", subs: [] }] },
  { name: "기타", subs: [] },
];

const DEFAULT_PAYMENTS = ["현금", "체크카드", "신용카드", "계좌이체"];

const toNum = (str) => Number(String(str).replace(/,/g, "")) || 0;
const toFmt = (n) => (n === 0 ? "" : Number(n).toLocaleString("ko-KR"));
const handleNumInput = (val) => {
  const raw = val.replace(/,/g, "").replace(/[^0-9]/g, "");
  return raw ? Number(raw).toLocaleString("ko-KR") : "";
};

export default function Settings({ user }) {
  const uid = user.uid;
  const [template, setTemplate] = useState({ salary: 0, budgets: [] });
  const [salaryInput, setSalaryInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);
  const [newPayment, setNewPayment] = useState("");
  const [saved, setSaved] = useState(false);
  const [catSaved, setCatSaved] = useState(false);
  const [paySaved, setPaySaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const tSnap = await get(ref(db, `users/${uid}/template`));
      if (tSnap.val()) {
        setTemplate(tSnap.val());
        setSalaryInput(toFmt(tSnap.val().salary));
      }

      const cSnap = await get(ref(db, `users/${uid}/categories`));
      if (cSnap.val()) {
        setCategories(Object.values(cSnap.val()));
      } else {
        setCategories(DEFAULT_CATEGORIES);
        const map = {};
        DEFAULT_CATEGORIES.forEach((c, i) => { map[i] = c; });
        await set(ref(db, `users/${uid}/categories`), map);
      }

      const pSnap = await get(ref(db, `users/${uid}/payments`));
      if (pSnap.val()) {
        setPayments(Object.values(pSnap.val()));
      } else {
        setPayments(DEFAULT_PAYMENTS);
        const map = {};
        DEFAULT_PAYMENTS.forEach((p, i) => { map[i] = p; });
        await set(ref(db, `users/${uid}/payments`), map);
      }
    };
    load();
  }, [uid]);

  const saveTemplate = async () => {
    const updated = { ...template, salary: toNum(salaryInput) };
    await set(ref(db, `users/${uid}/template`), updated);
    setTemplate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveCategories = async () => {
    const map = {};
    categories.forEach((c, i) => { map[i] = c; });
    await set(ref(db, `users/${uid}/categories`), map);
    setCatSaved(true);
    setTimeout(() => setCatSaved(false), 2000);
  };

  const savePayments = async (list) => {
    const map = {};
    list.forEach((p, i) => { map[i] = p; });
    await set(ref(db, `users/${uid}/payments`), map);
    setPaySaved(true);
    setTimeout(() => setPaySaved(false), 2000);
  };

  const addPayment = () => {
    if (!newPayment.trim()) return;
    const next = [...payments, newPayment.trim()];
    setPayments(next);
    setNewPayment("");
    savePayments(next);
  };

  const removePayment = (i) => {
    const next = payments.filter((_, idx) => idx !== i);
    setPayments(next);
    savePayments(next);
  };

  const addBudgetRow = () => setTemplate({ ...template, budgets: [...(template.budgets || []), { category: "", amount: 0 }] });
  const removeBudgetRow = (i) => setTemplate({ ...template, budgets: template.budgets.filter((_, idx) => idx !== i) });
  const updateBudget = (i, field, val) => {
    const b = [...template.budgets];
    b[i] = { ...b[i], [field]: field === "amount" ? toNum(val) : val };
    setTemplate({ ...template, budgets: b });
  };

  const addBig = () => setCategories([...categories, { name: "", subs: [] }]);
  const removeBig = (i) => setCategories(categories.filter((_, idx) => idx !== i));
  const updateBig = (i, val) => {
    const c = [...categories]; c[i] = { ...c[i], name: val }; setCategories(c);
  };
  const addMid = (bi) => {
    const c = [...categories]; c[bi].subs = [...(c[bi].subs || []), { name: "", subs: [] }]; setCategories(c);
  };
  const removeMid = (bi, mi) => {
    const c = [...categories]; c[bi].subs = c[bi].subs.filter((_, idx) => idx !== mi); setCategories(c);
  };
  const updateMid = (bi, mi, val) => {
    const c = [...categories]; c[bi].subs[mi] = { ...c[bi].subs[mi], name: val }; setCategories(c);
  };
  const addSmall = (bi, mi) => {
    const c = [...categories]; c[bi].subs[mi].subs = [...(c[bi].subs[mi].subs || []), ""]; setCategories(c);
  };
  const removeSmall = (bi, mi, si) => {
    const c = [...categories]; c[bi].subs[mi].subs = c[bi].subs[mi].subs.filter((_, idx) => idx !== si); setCategories(c);
  };
  const updateSmall = (bi, mi, si, val) => {
    const c = [...categories]; c[bi].subs[mi].subs[si] = val; setCategories(c);
  };

  const catOptions = categories.flatMap((big) =>
    (big.subs || []).flatMap((mid) =>
      (mid.subs || []).map((small) => `${big.name} > ${mid.name} > ${small}`)
        .concat([`${big.name} > ${mid.name}`])
    ).concat([big.name])
  );

  return (
    <div className="page">

      {/* 기본 틀 설정 */}
      <div className="settings-section card">
        <div className="page-header">
          <h3>📋 기본 틀 설정</h3>
          <button onClick={saveTemplate} className="btn-primary">{saved ? "✓ 저장됨" : "저장"}</button>
        </div>
        <p className="hint">변경 시 이전 달 예산에는 영향 없이 다음 달부터 적용됩니다</p>
        <label className="field-label">월급 (원)
          <input
            type="text"
            value={salaryInput}
            onChange={(e) => setSalaryInput(handleNumInput(e.target.value))}
            onFocus={(e) => e.target.select()}
            placeholder="0"
          />
        </label>
        <h4>카테고리별 기본 예산</h4>
        <table>
          <thead><tr><th>카테고리</th><th>금액 (원)</th><th></th></tr></thead>
          <tbody>
            {(template.budgets || []).map((b, i) => (
              <tr key={i}>
                <td>
                  <input list="tpl-cats" value={b.category} onChange={(e) => updateBudget(i, "category", e.target.value)} placeholder="카테고리" />
                  <datalist id="tpl-cats">{catOptions.map((c) => <option key={c} value={c} />)}</datalist>
                </td>
                <td>
                  <input
                    type="text"
                    value={b.amount === 0 ? "" : Number(b.amount).toLocaleString("ko-KR")}
                    onChange={(e) => updateBudget(i, "amount", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                </td>
                <td><button onClick={() => removeBudgetRow(i)} className="btn-del">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addBudgetRow} className="btn-add">+ 항목 추가</button>
      </div>

      {/* 결제수단 관리 */}
      <div className="settings-section card">
        <div className="page-header">
          <h3>💳 결제수단 관리</h3>
          {paySaved && <span className="saved-badge">✓ 저장됨</span>}
        </div>
        <div className="payment-list">
          {payments.map((p, i) => (
            <div key={i} className="payment-item">
              <span>{p}</span>
              <button onClick={() => removePayment(i)} className="btn-del">✕</button>
            </div>
          ))}
        </div>
        <div className="payment-add-row">
          <input
            value={newPayment}
            onChange={(e) => setNewPayment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPayment()}
            placeholder="새 결제수단 입력 (예: 카카오페이)"
            className="payment-input"
          />
          <button onClick={addPayment} className="btn-primary">추가</button>
        </div>
      </div>

      {/* 카테고리 관리 */}
      <div className="settings-section card">
        <div className="page-header">
          <h3>🗂 카테고리 관리</h3>
          <button onClick={saveCategories} className="btn-primary">{catSaved ? "✓ 저장됨" : "저장"}</button>
        </div>
        {categories.map((big, bi) => (
          <div key={bi} className="cat-edit-big">
            <div className="cat-row">
              <input value={big.name} onChange={(e) => updateBig(bi, e.target.value)} placeholder="대카테고리" className="cat-input-big" />
              <button onClick={() => removeBig(bi)} className="btn-del">✕</button>
            </div>
            {(big.subs || []).map((mid, mi) => (
              <div key={mi} className="cat-edit-mid">
                <div className="cat-row">
                  <span className="indent">└</span>
                  <input value={mid.name} onChange={(e) => updateMid(bi, mi, e.target.value)} placeholder="중카테고리" className="cat-input-mid" />
                  <button onClick={() => removeMid(bi, mi)} className="btn-del">✕</button>
                </div>
                {(mid.subs || []).map((small, si) => (
                  <div key={si} className="cat-row small">
                    <span className="indent2">└─</span>
                    <input value={small} onChange={(e) => updateSmall(bi, mi, si, e.target.value)} placeholder="소카테고리" className="cat-input-small" />
                    <button onClick={() => removeSmall(bi, mi, si)} className="btn-del">✕</button>
                  </div>
                ))}
                <button onClick={() => addSmall(bi, mi)} className="btn-add-small">+ 소카테고리</button>
              </div>
            ))}
            <button onClick={() => addMid(bi)} className="btn-add-mid">+ 중카테고리</button>
          </div>
        ))}
        <button onClick={addBig} className="btn-add">+ 대카테고리 추가</button>
      </div>

    </div>
  );
}