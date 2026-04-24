import { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";

export default function Budget({ user, month }) {
  const uid = user.uid;
  const [budgets, setBudgets] = useState([]);
  const [template, setTemplate] = useState(null);
  const [categories, setCategories] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const tplSnap = await get(ref(db, `users/${uid}/template`));
      const tpl = tplSnap.val();
      setTemplate(tpl);

      const catSnap = await get(ref(db, `users/${uid}/categories`));
      const cats = catSnap.val() || {};
      setCategories(Object.values(cats));

      const budSnap = await get(ref(db, `users/${uid}/budgets/${month}`));
      const budData = budSnap.val();

      if (budData) {
        setBudgets(Object.values(budData));
      } else if (tpl?.budgets) {
        setBudgets(tpl.budgets);
      } else {
        setBudgets([]);
      }
    };
    load();
  }, [uid, month]);

  const save = async () => {
    const map = {};
    budgets.forEach((b, i) => { map[i] = b; });
    await set(ref(db, `users/${uid}/budgets/${month}`), map);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const loadFromTemplate = async () => {
    const tplSnap = await get(ref(db, `users/${uid}/template`));
    const tpl = tplSnap.val();
    if (tpl?.budgets) setBudgets(tpl.budgets);
  };

  const addRow = () => setBudgets([...budgets, { category: "", amount: 0 }]);
  const removeRow = (i) => setBudgets(budgets.filter((_, idx) => idx !== i));

  const update = (i, field, val) => {
    const next = [...budgets];
    next[i] = { ...next[i], [field]: field === "amount" ? Number(val.replace(/,/g, "")) : val };
    setBudgets(next);
  };

  const total = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const fmt = (n) => n.toLocaleString("ko-KR");

  const catOptions = categories.flatMap((big) =>
    (big.subs || []).flatMap((mid) =>
      (mid.subs || []).map((small) => `${big.name} > ${mid.name} > ${small.name}`)
        .concat([`${big.name} > ${mid.name}`])
    ).concat([big.name])
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2>{month} 예산</h2>
        <div className="btn-row">
          <button onClick={loadFromTemplate} className="btn-outline">기본 틀 불러오기</button>
          <button onClick={save} className="btn-primary">{saved ? "✓ 저장됨" : "저장"}</button>
        </div>
      </div>

      {template?.salary && (
        <div className="info-box blue">
          월급 <strong>{fmt(template.salary)}원</strong> · 예산 합계 <strong>{fmt(total)}원</strong>
          {template.salary - total > 0 && ` · 저축 가능 ${fmt(template.salary - total)}원`}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>카테고리</th><th>예산 (원)</th><th></th></tr>
          </thead>
          <tbody>
            {budgets.map((b, i) => (
              <tr key={i}>
                <td>
                  <input
                    list="cat-options"
                    value={b.category}
                    onChange={(e) => update(i, "category", e.target.value)}
                    placeholder="카테고리 선택 또는 입력"
                  />
                  <datalist id="cat-options">
                    {catOptions.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </td>
                <td>
                  <input
                    type="text"
                    value={b.amount === 0 ? "" : fmt(b.amount)}
                    onChange={(e) => update(i, "amount", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                </td>
                <td>
                  <button onClick={() => removeRow(i)} className="btn-del">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow} className="btn-add">+ 항목 추가</button>
      </div>

      <div className="total-row">합계: <strong>{fmt(total)}원</strong></div>
    </div>
  );
}