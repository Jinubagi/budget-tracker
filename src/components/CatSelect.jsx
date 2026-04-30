export default function CatSelect({ categories, bigVal, subVal, onBigChange, onSubChange }) {
  const bigObj = categories.find((c) => c.name === bigVal);
  const subs = (bigObj?.subs || []).map((s) => typeof s === "string" ? s : s.name);

  return (
    <div className="cat-select-wrap">
      <select
        value={bigVal}
        onChange={(e) => {
          onBigChange(e.target.value);
          onSubChange("");
        }}
        className="cat-select"
      >
        <option value="">대카테고리</option>
        {categories.map((c) => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
      </select>

      {bigVal && subs.length > 0 && (
        <select
          value={subVal}
          onChange={(e) => onSubChange(e.target.value)}
          className="cat-select"
        >
          <option value="">하위카테고리</option>
          {subs.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
    </div>
  );
}