/*
 * Mechanical checks on the §5.6 design-token contract. These are the T1 seeds
 * of the no-shame CI posture (§13): the full visual screenshot tests land at
 * T14, but "no red in v1" and "one radius token" are checkable from day one.
 */
import { expect, test } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");

function hexToRgb(hex: string): [number, number, number] {
  // 3/4-digit shorthand expands; a trailing alpha pair (4/8-digit) is ignored.
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// WCAG 2.x relative luminance + contrast ratio
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort(
    (x, y) => y - x,
  );
  return (l1 + 0.05) / (l2 + 0.05);
}

// Token maps per color mode: dark inherits light, then overrides.
function parseTokens(section: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of section.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const light = parseTokens(css.slice(0, darkStart));
const darkEnd = css.indexOf("}", css.indexOf("}", darkStart) + 1);
const dark = { ...light, ...parseTokens(css.slice(darkStart, darkEnd)) };

function hueSat([r, g, b]: [number, number, number]): {
  hue: number;
  sat: number;
} {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { hue: 0, sat: 0 };
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue, sat: max === 0 ? 0 : d / max };
}

test("no red anywhere in the tokens (§5.6)", () => {
  // Comments may cite the no-red rule; only real CSS values are checked.
  const values = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Hex-only color discipline: no color functions that could smuggle a red
  // past the hex scan below.
  expect(values).not.toMatch(
    /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color|color-mix)\(/i,
  );
  const hexes = values.match(/#[0-9a-f]+\b/gi) ?? [];
  expect(hexes.length).toBeGreaterThan(10);
  for (const hex of hexes) {
    expect([4, 5, 7, 9], `${hex} malformed`).toContain(hex.length);
    const { hue, sat } = hueSat(hexToRgb(hex));
    const reddish = (hue < 20 || hue > 345) && sat > 0.25;
    expect(reddish, `${hex} reads as red (hue ${hue.toFixed(0)})`).toBe(false);
  }
  // Named reds banned anywhere inside a declaration value (covers
  // `border: 1px solid red`, not just `color: red`).
  expect(values).not.toMatch(
    /:[^;{}]*\b(?:red|crimson|tomato|firebrick|maroon|salmon|indianred|orangered|darkred)\b/i,
  );
});

test("contrast: text passes 4.5:1 on ground and every tint, both modes (§5.7)", () => {
  const tints = [
    "--tint-shape-of-day",
    "--tint-observation",
    "--tint-offer",
    "--tint-captured",
    "--tint-degraded",
  ];
  for (const [mode, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    const grounds = ["--color-ground", ...tints].map((t) => tokens[t]);
    for (const ground of grounds) {
      for (const ink of ["--color-ink", "--color-ink-secondary"]) {
        const ratio = contrast(tokens[ink], ground);
        expect(
          ratio,
          `${mode}: ${ink} on ${ground} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Accent-colored text/focus ring on ground; label text on accent fills.
    expect(
      contrast(tokens["--color-accent"], tokens["--color-ground"]),
      `${mode}: accent on ground`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(tokens["--color-on-accent"], tokens["--color-accent"]),
      `${mode}: on-accent on accent`,
    ).toBeGreaterThanOrEqual(4.5);
    // Degraded-state text on its tint and on ground (§4.5 amber-neutral).
    expect(
      contrast(tokens["--color-degraded"], tokens["--tint-degraded"]),
      `${mode}: degraded on its tint`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("brand hexes stay in sync across layout, manifest, and icons", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const manifest = readFileSync("app/manifest.ts", "utf8");
  const icons = readFileSync("scripts/generate-icons.mjs", "utf8");

  // PWA chrome colors must equal the ground tokens per mode.
  expect(layout).toContain(`color: "${light["--color-ground"]}"`);
  expect(layout).toContain(`color: "${dark["--color-ground"]}"`);
  expect(manifest).toContain(`background_color: "${light["--color-ground"]}"`);
  expect(manifest).toContain(`theme_color: "${light["--color-ground"]}"`);

  // Icon fill must equal the accent token.
  const accent = hexToRgb(light["--color-accent"]);
  const iconRgb = icons
    .match(/ACCENT = \[(0x[0-9a-f]{2}), (0x[0-9a-f]{2}), (0x[0-9a-f]{2})\]/i)!
    .slice(1)
    .map(Number);
  expect(iconRgb).toEqual(accent);
});

test("exactly one radius token (§5.5 container rule)", () => {
  const radiusTokens = css.match(/--radius[\w-]*\s*:/g) ?? [];
  expect(radiusTokens).toEqual(["--radius:"]);
});

test("motion budget: all durations ≤200ms (§5.6)", () => {
  const durations = [...css.matchAll(/--motion-duration:\s*(\d+)ms/g)].map(
    (m) => Number(m[1]),
  );
  expect(durations.length).toBeGreaterThan(0);
  for (const d of durations) expect(d).toBeLessThanOrEqual(200);
  expect(css).toContain("prefers-reduced-motion");
});

test("dark mode ships with #121212-family ground, no pure extremes (§5.6)", () => {
  expect(css).toContain("prefers-color-scheme: dark");
  expect(css).not.toMatch(/#000\b|#000000\b/i);
  expect(css).not.toMatch(/#fff\b|#ffffff\b/i);
});

test("color tokens are opaque 6-digit hex (alpha would fake the contrast math)", () => {
  for (const tokens of [light, dark]) {
    for (const [name, hex] of Object.entries(tokens)) {
      expect(hex, `${name}: ${hex}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  }
});

test("required tokens exist", () => {
  for (const token of [
    "--color-ground",
    "--color-ink",
    "--color-ink-secondary",
    "--color-accent",
    "--tint-shape-of-day",
    "--tint-observation",
    "--tint-offer",
    "--tint-captured",
    "--color-degraded",
    "--tap-min",
    "--tap-mic",
    "--dock-clearance",
    "--motion-duration",
    "--text-scale",
    "--font-size-body",
    "--font-size-label",
    "--font-size-title",
    "--font-size-display",
  ]) {
    expect(css, token).toContain(`${token}:`);
  }
});

test("Figtree is self-hosted and the Dynamic Type root trick is present (§5.6)", () => {
  expect(css).toContain('font-family: "Figtree"');
  expect(css).toContain("font: -apple-system-body");
  expect(existsSync("public/fonts/figtree-latin-var.woff2")).toBe(true);
});

test("PWA chrome: safe areas and overscroll containment (§5.7)", () => {
  expect(css).toContain("env(safe-area-inset-bottom)");
  expect(css).toContain("overscroll-behavior-y: none");
  expect(css).toContain(":focus-visible");
});
