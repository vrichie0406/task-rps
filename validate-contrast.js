#!/usr/bin/env node
/*
  WCAG 2.1 AA contrast audit for the Terra / SupaFarm palette.

  It parses design-system/tokens.css and resolves var() chains, so it checks
  the values that actually ship rather than a hand-copied list. Re-run it
  after any palette change:

      node validate-contrast.js

  Exits non-zero if any pair fails, so it can gate a build.

  Thresholds (WCAG 2.1):
    4.5:1  normal text  (1.4.3) — Terra's body and button text is 13–15px,
                                  none of it large enough for the 3:1 rule
    3.0:1  large text   (1.4.3) — >=18.66px bold or >=24px regular
    3.0:1  UI component boundaries and states (1.4.11)
*/
const fs = require('fs');
const path = require('path');

// Works both in the repo (design-system/tokens.css) and inside the
// standalone design-system package, where tokens.css sits beside this file.
const candidates = ['design-system/tokens.css', 'tokens.css'];
const tokensPath = candidates
  .map(p => path.join(__dirname, p))
  .find(p => fs.existsSync(p));
if (!tokensPath) {
  console.error('validate-contrast: could not find tokens.css in ' + candidates.join(' or '));
  process.exit(2);
}
const css = fs.readFileSync(tokensPath, 'utf8');

// --- resolve tokens, following var() indirection -------------------------
const raw = {};
for (const m of css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) raw[m[1]] = m[2].trim();

const resolve = (v, seen = 0) => {
  if (seen > 10) throw new Error('var() cycle: ' + v);
  const m = v.match(/^var\((--[\w-]+)\)$/);
  return m ? resolve(raw[m[1]], seen + 1) : v;
};
const hex = name => {
  const v = resolve(raw[name]);
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) throw new Error(`${name} is not a plain hex: ${v}`);
  return v.toUpperCase();
};

// --- contrast ------------------------------------------------------------
const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// --- the pairs the product actually renders ------------------------------
const S = '--surface', C = '--bg-canvas', A = '--bg-app';
const checks = [
  ['Body text',        '--text-primary',   S, 4.5],
  ['Body text',        '--text-primary',   C, 4.5],
  ['Body text',        '--text-primary',   A, 4.5],
  ['Secondary text',   '--text-secondary', S, 4.5],
  ['Secondary text',   '--text-secondary', C, 4.5],
  ['Tertiary labels',  '--text-tertiary',  S, 4.5],
  ['Tertiary labels',  '--text-tertiary',  C, 4.5],
  ['Link text',        '--text-link',      S, 4.5],
  ['Green as text',    '--accent-ink',     S, 4.5],
  ['Green as text',    '--accent-ink',     C, 4.5],

  ['btn-dark label',        '--text-on-dark',        '--navy-900', 4.5],
  ['btn-dark hover',        '--text-on-dark',        '--navy-800', 4.5],
  ['btn-accent label',      '--text-on-accent',      '--accent', 4.5],
  ['btn-accent hover',      '--text-on-accent',      '--accent-hover', 4.5],
  ['btn-deep label',        '--text-on-accent-deep', '--accent-deep', 4.5],
  ['btn-deep hover',        '--text-on-accent-deep', '--accent-deep-hover', 4.5],
  ['btn-danger label',      '--text-on-danger',      '--danger', 4.5],
  ['btn-danger hover',      '--text-on-danger',      '--danger-strong', 4.5],
  ['btn-danger-soft label', '--text-danger',         '--danger-soft', 4.5],

  ['Text on accent-soft',   '--text-primary', '--accent-soft', 4.5],
  ['Green ink on soft',     '--accent-ink',   '--accent-soft', 4.5],
  ['Text on surface-dark',  '--text-on-dark', '--surface-dark', 4.5],

  // 1.4.11 — control boundaries and state indicators
  ['Input border',   '--border-control', S, 3.0],
  ['Input border',   '--border-control', C, 3.0],
  ['Focus ring',     '--accent-ink',     S, 3.0],
  ['Active indicator', '--accent-ink',   S, 3.0],
];

/*
  Documented constraints, not failures. The brand green is a FILL colour: it
  carries navy text at 5.97:1, but as a thin line on white it is 2.98:1 and
  would fail 1.4.11. Indicators, focus rings and control borders therefore use
  --accent-ink (the gradient's forest end, 6.33:1). This is checked below so
  the number is visible and a future palette edit cannot quietly break the
  reasoning behind the rule.
*/
const constraints = [
  ['--accent', S, 3.0, 'fill only — use --accent-ink for lines/indicators'],
];

let failed = 0;
const rows = checks.map(([label, fg, bg, need]) => {
  const f = hex(fg), b = hex(bg), r = ratio(f, b), ok = r >= need;
  if (!ok) failed++;
  return { ok, r, need, label, fg, bg, f, b };
});

const w = Math.max(...rows.map(x => x.label.length));
console.log('WCAG 2.1 AA — Terra / SupaFarm palette\n');
for (const x of rows) {
  console.log(
    `  ${x.ok ? 'PASS' : 'FAIL'}  ${x.r.toFixed(2).padStart(6)}:1  (min ${x.need.toFixed(1)})  ` +
    `${x.label.padEnd(w)}  ${x.f} on ${x.b}`
  );
}
console.log(
  failed
    ? `\n${failed} of ${rows.length} pairs FAIL WCAG 2.1 AA`
    : `\nAll ${rows.length} pairs pass WCAG 2.1 AA.`
);

console.log('\nDocumented constraints — below 3:1 by design, so usage is restricted:');
for (const [tok, bg, under, rule] of constraints) {
  const r = ratio(hex(tok), hex(bg));
  const flag = r < under ? 'restricted' : 'NOTE: now clears ' + under + ':1 — the rule may be relaxed';
  console.log(`  ${tok} on ${hex(bg)} = ${r.toFixed(2)}:1  →  ${flag}; ${rule}`);
}

process.exit(failed ? 1 : 0);
