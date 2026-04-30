// 해당 월의 실제 월급일 계산 (24일, 토/일이면 직전 금요일)
export function getPayday(year, month) {
  const d = new Date(year, month - 1, 24);
  const day = d.getDay(); // 0=일, 6=토
  if (day === 6) d.setDate(22); // 토 → 금
  if (day === 0) d.setDate(23); // 일 → 금
  return d;
}


// 날짜 → "YYYY-MM-DD" 문자열
export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 현재 선택된 "월급 기간" 계산
// month: "YYYY-MM" 형식
// 반환: { start: "YYYY-MM-DD", end: "YYYY-MM-DD", label: "4/24 ~ 5/23" }
export function getPayPeriod(month) {
  const [y, m] = month.split("-").map(Number);

  const start = getPayday(y, m);

  // 다음 달 월급일 전날이 end
  const nextPayday = getPayday(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1);
  const end = new Date(nextPayday);
  end.setDate(end.getDate() - 1);

  const label = `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;

  return { start: toDateStr(start), end: toDateStr(end), label };
}

// 지출 항목이 해당 월급 기간에 속하는지 확인
export function inPeriod(dateStr, period) {
  return dateStr >= period.start && dateStr <= period.end;
}