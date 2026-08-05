// PRNG có seed — generator phải chạy lại ra kết quả y hệt, nếu không mỗi lần
// sinh lại là một diff db.json khác nhau và không ai review nổi.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const sample = (arr, n) => {
    const copy = [...arr];
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
    }
    return out;
  };
  const chance = (p) => next() < p;
  return { next, int, pick, sample, chance };
}
