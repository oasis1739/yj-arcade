// 의존성 없이 PNG를 직접 쓴다. 앱 아이콘은 PWA에 필수라 코드로 만든다.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [5, 6, 13];
const CYAN = [57, 246, 255];
const MAGENTA = [255, 46, 136];

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = size * 0.14;
  const ringOuter = size - pad;
  const thick = size * 0.075;
  const c = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 라운드 사각 링(시안) + 가운데 다이아몬드(마젠타)
      const inRect = x >= pad && x <= ringOuter && y >= pad && y <= ringOuter;
      const inInner = x >= pad + thick && x <= ringOuter - thick && y >= pad + thick && y <= ringOuter - thick;
      const diamond = Math.abs(x - c) + Math.abs(y - c) < size * 0.17;

      let col = BG;
      if (inRect && !inInner) col = CYAN;
      if (diamond) col = MAGENTA;

      const i = (y * size + x) * 4;
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

writeFileSync(new URL('../public/icon-180.png', import.meta.url), render(180));
writeFileSync(new URL('../public/icon-512.png', import.meta.url), render(512));
console.log('icon-180.png, icon-512.png 생성 완료');
