// Golden traces for numbers to and from text: String(x) (Number::toString) and Number(s) (StringToNumber), the two
// conversions the Unity port does itself with exact arithmetic (ad-astra AdAstra.Rules/Core/JsNumber.cs) because the
// runtimes it ships on (Unity's Mono) do not round them correctly. Deterministic: random doubles across the whole range,
// subnormals, the neighbours of every power of two and of ten, the ends of the range, short decimals, and strings
// written to every precision, plus hand-picked hard cases. Doubles are written as their 64 bits in hex.
const dv = new DataView(new ArrayBuffer(8));
const bitsOf = x => (dv.setFloat64(0, x), dv.getBigUint64(0).toString(16).padStart(16, '0'));
const fromBits = b => (dv.setBigUint64(0, b), dv.getFloat64(0));

function lcg(seed) {
  let s = BigInt(seed);
  return () => (s = (s * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn);
}

function strings() {
  const out = [];
  const seen = new Set();
  const add = x => {
    if (!Number.isFinite(x) || x === 0) return;
    const b = bitsOf(x);
    if (seen.has(b)) return;
    seen.add(b);
    out.push([b, String(x)]);
  };
  const r = lcg(12345);
  for (let i = 0; i < 12000; i++) add(fromBits(r() & 0x7fffffffffffffffn));
  for (let i = 0; i < 3000; i++) add(fromBits(r() & 0x000fffffffffffffn));
  for (let i = 0n; i < 200n; i++) {
    add(fromBits(i + 1n));
    add(fromBits(0x0010000000000000n + i - 100n));
    add(fromBits(0x7fefffffffffffffn - i));
  }
  for (let e = -1074; e <= 1023; e++) {
    const b = BigInt('0x' + bitsOf(2 ** e));
    for (let d = -1n; d <= 1n; d++) add(fromBits(b + d));
  }
  for (let e = -323; e <= 308; e++) {
    const b = BigInt('0x' + bitsOf(Number('1e' + e)));
    for (let d = -1n; d <= 1n; d++) add(fromBits(b + d));
  }
  for (let i = 0; i < 4000; i++) {
    const k = 1 + Number(r() % 15n);
    add(Number(`${r() % 10n ** BigInt(k)}e${Number(r() % 600n) - 300}`));
  }
  for (const v of [0.1, 0.2, 0.3, 1 / 3, 6 * 0.1, 1e21, 1e-7, 123e-20, Number.MAX_VALUE, Number.MIN_VALUE, 2 ** -1022, 9007199254740993, 20.52191893])
    add(v);
  return out;
}

function numbers() {
  const out = [];
  const add = s => out.push([s, bitsOf(Number(s))]);
  const hard = ['', '  ', ' 12 ', '\u00a01\ufeff', '\u20281\u2029', '\u180e1', '\u200b1', '-0', '+0', '-0.0', '0e5', '-0e-5',
    '+Infinity', '-Infinity', 'Infinity', 'infinity', 'INFINITY', '+-1', '1e', '1.', '-.5', '.', 'e5', '1e+', '1e400', '-1e400',
    '1e-400', '-1e-400', '0.0000000000000000000000000000001e400', '100e-402', '00012e-3', '1e-323', '2e-324',
    '2.4703282292062328e-324', '2.4703282292062327e-324', '3e-324', '5e-324', '1.7976931348623157e308', '1.7976931348623158e308',
    '1.7976931348623159e308', '1e99999999999999999999', '1e-99999999999999999999', '0e99999999999999999999', '0x10', '0X1f',
    '0b101', '0B11', '0o17', '0O7', '-0x10', '+0x10', '0x', '0xg', '0x' + 'f'.repeat(300), '0x' + 'f'.repeat(255),
    '0b' + '1'.repeat(1100), '0x1fffffffffffff', '0x20000000000001', '0x20000000000003', '0x8000000000000400',
    '0x800000000000040000001', '1_0', '\u0661', '\u0661e400', '1,5', '9007199254740993', '1' + '0'.repeat(400),
    '0.' + '0'.repeat(400) + '1', '2.2250738585072011e-308', '2.2250738585072012e-308',
    '1.00000000000000011102230246251565404236316680908203125', '1.00000000000000011102230246251565404236316680908203124',
    '1.00000000000000011102230246251565404236316680908203126', '7.038531e-26', '1e23', '8.98846567431158e307',
    '0.057806540', '0.0003862948', '7.986727322e-11', '6e-136', '1e-163', '2.9e213', '\t\n\v\f\r 5 '];
  for (const s of hard) add(s);
  const r = lcg(99);
  for (let i = 0; i < 12000; i++) {
    const x = fromBits(r() & 0x7fffffffffffffffn);
    if (Number.isFinite(x)) add(x.toPrecision(1 + Number(r() % 25n)).replace('e+', 'e'));
  }
  for (let i = 0; i < 3000; i++) add(fromBits(r() & 0x000fffffffffffffn).toPrecision(1 + Number(r() % 20n)));
  return out;
}

export function record(write) {
  write('numbers.json', { str: strings(), num: numbers() });
}
