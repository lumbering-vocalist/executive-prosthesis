/*
 * The icon generator hand-rolls a PNG encoder (crc32, chunk framing, filter
 * bytes). A malformed byte anywhere yields icons iOS silently rejects, which
 * breaks PWA install (§5.7) with no error surface — so the encoder output is
 * verified structurally: signature, IHDR geometry, chunk CRCs, and decoded
 * pixel data. The script writes via cwd-relative paths, so it runs against a
 * temp directory; a byte-compare then pins the checked-in icons to the
 * generator so they can't silently drift.
 */
import { beforeAll, afterAll, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, inflateSync } from "node:zlib";

const SCRIPT = join(import.meta.dirname, "..", "scripts", "generate-icons.mjs");
const ICONS_DIR = join(import.meta.dirname, "..", "public", "icons");
const EXPECTED = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
] as const;

let dir: string;
let pngs: (readonly [string, number, Buffer])[];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "icons-"));
  execFileSync(process.execPath, [SCRIPT, dir]);
  pngs = EXPECTED.map(
    ([name, size]) =>
      [name, size, readFileSync(join(dir, "public", "icons", name))] as const,
  );
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const u32 = (buf: Uint8Array, off: number) =>
  new DataView(buf.buffer, buf.byteOffset + off, 4).getUint32(0);

// PNG layout constants: 8-byte signature, then chunks of
// [4-byte length][4-byte type][body][4-byte CRC].
const SIG_LEN = 8;
const IHDR_CHUNK_LEN = 12 + 13; // framing + IHDR body
const IDAT_LEN_OFF = SIG_LEN + IHDR_CHUNK_LEN; // length field of IDAT
const IDAT_BODY_OFF = IDAT_LEN_OFF + 8; // past length + type

test("emits all three icons with PNG signature and correct IHDR geometry", () => {
  for (const [name, size, png] of pngs) {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect([...png.subarray(0, 8)], name).toEqual(sig);
    // First chunk must be IHDR: width, height, 8-bit, truecolor.
    expect(png.subarray(12, 16).toString("ascii"), name).toBe("IHDR");
    expect(u32(png, 16), `${name} width`).toBe(size);
    expect(u32(png, 20), `${name} height`).toBe(size);
    expect(png[24], `${name} bit depth`).toBe(8);
    expect(png[25], `${name} color type`).toBe(2);
  }
});

test("every chunk CRC validates and the file terminates with IEND", () => {
  for (const [name, , png] of pngs) {
    let off = SIG_LEN;
    const types: string[] = [];
    while (off < png.length) {
      const len = u32(png, off);
      const body = png.subarray(off + 4, off + 8 + len);
      types.push(body.subarray(0, 4).toString("ascii"));
      expect(u32(png, off + 8 + len), `${name} crc @${off}`).toBe(crc32(body));
      off += 12 + len;
    }
    expect(off, `${name} trailing bytes`).toBe(png.length);
    expect(types, name).toEqual(["IHDR", "IDAT", "IEND"]);
  }
});

test("IDAT decodes to solid accent-color rows with filter byte 0", () => {
  const accent = hexToRgbFromCss();
  for (const [name, size, png] of pngs) {
    const idatLen = u32(png, IDAT_LEN_OFF);
    const raw = inflateSync(png.subarray(IDAT_BODY_OFF, IDAT_BODY_OFF + idatLen));
    const stride = 1 + size * 3;
    expect(raw.length, name).toBe(size * stride);
    for (let y = 0; y < size; y++) {
      expect(raw[y * stride], `${name} filter row ${y}`).toBe(0);
    }
    for (const pos of [0, Math.floor(size / 2), size - 1]) {
      const px = raw.subarray(1 + pos * 3, 4 + pos * 3);
      expect([...px], `${name} pixel ${pos}`).toEqual(accent);
    }
  }
});

test("checked-in icons are byte-identical to generator output", () => {
  // Guards against editing ACCENT (or the encoder) without `npm run icons`.
  for (const [name, , png] of pngs) {
    const committed = readFileSync(join(ICONS_DIR, name));
    expect(committed.equals(png), `${name} — rerun \`npm run icons\``).toBe(
      true,
    );
  }
});

// The pixel assertion sources the accent from the design tokens, so an accent
// change fails here (and in the byte-compare) until icons are regenerated.
function hexToRgbFromCss(): number[] {
  const css = readFileSync(
    join(import.meta.dirname, "..", "app", "globals.css"),
    "utf8",
  );
  const hex = css.match(/--color-accent:\s*#([0-9a-f]{6})/i)![1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
