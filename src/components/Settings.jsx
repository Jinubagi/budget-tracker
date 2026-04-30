import { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";

const DEFAULT_CATEGORIES = [
  { name: "식비", subs: ["식재료", "외식", "배달", "카페"] },
  { name: "교통", subs: ["대중교통", "주유", "주차", "택시"] },
  { name: "주거", subs: ["월세/관리비", "생활용품", "인테리어"] },
  { name: "통신", subs: ["휴대폰", "인터넷", "구독서비스"] },
  { name: "의료/건강", subs: ["병원", "약국", "운동"] },
  { name: "여가", subs: ["문화/취미", "여행", "외출"] },
  { name: "저축/투자", subs: ["저축", "투자", "적금"] },
  { name: "기타", subs: ["기타"] },
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
        const loaded = Object.values(cSnap.val());
        // 구버전(3단계) 데이터를 2단계로 변환
        const converted = loaded.map((big) => ({
          name: big.name,
          subs: (big.subs || []).map((mid) =>
            typeof mid === "string" ? mid : mid.name
          ),
        }));
        setCategories(converted);
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
  const addSub = (bi) => {
    const c = [...categories]; c[bi].subs = [...(c[bi].subs || []), ""]; setCategories(c);
  };
  const removeSub = (bi, si) => {
    const c = [...categories]; c[bi].subs = c[bi].subs.filter((_, idx) => idx !== si); setCategories(c);
  };
  const updateSub = (bi, si, val) => {
    const c = [...categories]; c[bi].subs[si] = val; setCategories(c);
  };

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
                  <select value={b.category} onChange={(e) => updateBudget(i, "category", e.target.value)} style={{ width: "100%" }}>
                    <option value="">카테고리 선택</option>
                    {categories.map((big) => (
                      <optgroup key={big.name} label={big.name}>
                        <option value={big.name}>{big.name} (전체)</option>
                        {(big.subs || []).map((sub) => (
                          <option key={sub} value={`${big.name} > ${sub}`}>{sub}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
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
            {(big.subs || []).map((sub, si) => (
              <div key={si} className="cat-row" style={{ marginLeft: 16 }}>
                <span className="indent">└</span>
                <input value={sub} onChange={(e) => updateSub(bi, si, e.target.value)} placeholder="하위카테고리" className="cat-input-mid" />
                <button onClick={() => removeSub(bi, si)} className="btn-del">✕</button>
              </div>
            ))}
            <button onClick={() => addSub(bi)} className="btn-add-mid">+ 하위카테고리 추가</button>
          </div>
        ))}
        <button onClick={addBig} className="btn-add">+ 대카테고리 추가</button>
      </div>
    </div>
  );
}