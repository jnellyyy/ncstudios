import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

const SIZE = 33;
const OUTPUT_DIR = path.resolve("exports/nc-35mm-film-lut");
const LUT_PATH = path.join(OUTPUT_DIR, "NC_35mm_Film_Print_Rec709.cube");
const PREVIEW_PATH = path.join(OUTPUT_DIR, "NC_35mm_Film_Print_preview.png");

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

function filmLook([r, g, b]) {
  const inputLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // A restrained film-print S curve: a soft toe, firm midtones, and a
  // highlight ceiling that leaves room for grading and broadcast-safe output.
  const shapedLuma = mix(inputLuma, inputLuma * inputLuma * (3 - 2 * inputLuma), 0.24);
  const printLuma = 0.012 + 0.966 * shapedLuma;
  const lumaScale = inputLuma > 1e-6 ? printLuma / inputLuma : 1;
  r *= lumaScale;
  g *= lumaScale;
  b *= lumaScale;

  // Dye-layer cross-talk adds gentle color separation while preserving neutral
  // greys. Reds become a little rounder and greens lose their digital edge.
  [r, g, b] = [
    1.035 * r - 0.022 * g - 0.013 * b,
    -0.010 * r + 1.018 * g - 0.008 * b,
    -0.020 * r + 0.010 * g + 1.010 * b,
  ];

  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const shadowWeight = 1 - smoothstep(0.10, 0.48, luma);
  const highlightWeight = smoothstep(0.44, 0.92, luma);

  // Subtle cyan shadows and warm highlights emulate print-stock density.
  r += -0.008 * shadowWeight + 0.012 * highlightWeight;
  g += 0.004 * shadowWeight + 0.004 * highlightWeight;
  b += 0.011 * shadowWeight - 0.010 * highlightWeight;

  // Film holds less chroma at the extremes than a digital display transform.
  const tonedLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const saturation = 0.955 - 0.055 * shadowWeight - 0.035 * highlightWeight;
  r = mix(tonedLuma, r, saturation);
  g = mix(tonedLuma, g, saturation);
  b = mix(tonedLuma, b, saturation);

  // Nudge foliage toward olive and cool blues toward cyan without disturbing
  // skin-dominant reds.
  const greenDominance = clamp(g - Math.max(r, b)) * 2.2;
  r += 0.014 * greenDominance;
  g -= 0.012 * greenDominance;

  const blueDominance = clamp(b - Math.max(r, g)) * 1.8;
  g += 0.010 * blueDominance;
  b -= 0.006 * blueDominance;

  const redDominance = clamp(r - Math.max(g, b)) * 1.4;
  g += 0.006 * redDominance;

  // Compress any edge-of-gamut chroma before the final clamp to avoid hard
  // channel clipping and preserve hue in bright saturated colors.
  const finalLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  let gamutScale = 1;
  if (high > 0.992 && high !== finalLuma) {
    gamutScale = Math.min(gamutScale, (0.992 - finalLuma) / (high - finalLuma));
  }
  if (low < 0.008 && low !== finalLuma) {
    gamutScale = Math.min(gamutScale, (finalLuma - 0.008) / (finalLuma - low));
  }
  gamutScale = clamp(gamutScale);

  return [
    clamp(mix(finalLuma, r, gamutScale)),
    clamp(mix(finalLuma, g, gamutScale)),
    clamp(mix(finalLuma, b, gamutScale)),
  ];
}

function buildCube() {
  const lines = [
    'TITLE "NC 35mm Film Print - Rec.709"',
    `LUT_3D_SIZE ${SIZE}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
    "",
  ];

  // .cube ordering: red changes fastest, then green, then blue.
  for (let blue = 0; blue < SIZE; blue += 1) {
    for (let green = 0; green < SIZE; green += 1) {
      for (let red = 0; red < SIZE; red += 1) {
        const output = filmLook([
          red / (SIZE - 1),
          green / (SIZE - 1),
          blue / (SIZE - 1),
        ]);
        lines.push(output.map((value) => value.toFixed(7)).join(" "));
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function buildPreview() {
  const width = 1200;
  const height = 675;
  const pixels = Buffer.alloc(width * height * 3);
  const swatches = [
    [0.42, 0.28, 0.22], [0.76, 0.58, 0.49], [0.31, 0.42, 0.58],
    [0.30, 0.48, 0.30], [0.52, 0.45, 0.66], [0.30, 0.68, 0.66],
    [0.82, 0.50, 0.20], [0.24, 0.32, 0.62], [0.75, 0.30, 0.35],
    [0.38, 0.24, 0.46], [0.62, 0.72, 0.26], [0.88, 0.62, 0.18],
  ];

  const setPixel = (x, y, color) => {
    const offset = (y * width + x) * 3;
    pixels[offset] = Math.round(clamp(color[0]) * 255);
    pixels[offset + 1] = Math.round(clamp(color[1]) * 255);
    pixels[offset + 2] = Math.round(clamp(color[2]) * 255);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const graded = x >= width / 2;
      const localX = (x % (width / 2)) / (width / 2 - 1);
      let color;

      if (y < 285) {
        const exposure = 0.025 + 0.95 * localX;
        color = [exposure, exposure, exposure];
      } else if (y < 600) {
        const row = Math.floor((y - 285) / 105);
        const column = Math.min(3, Math.floor(localX * 4));
        color = swatches[row * 4 + column];
      } else {
        const hue = localX * 6;
        const sector = Math.floor(hue) % 6;
        const f = hue - Math.floor(hue);
        const rainbow = [
          [1, f, 0], [1 - f, 1, 0], [0, 1, f],
          [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f],
        ][sector];
        color = rainbow.map((channel) => 0.15 + channel * 0.70);
      }

      setPixel(x, y, graded ? filmLook(color) : color);
    }
  }

  return encodePng(width, height, pixels);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  const stride = width * 3;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(LUT_PATH, buildCube(), "utf8");
await writeFile(PREVIEW_PATH, buildPreview());
console.log(`Generated ${LUT_PATH}`);
console.log(`Generated ${PREVIEW_PATH}`);
