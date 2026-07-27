import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const readPublic = (p) => readFileSync(new URL(p, publicRoot));

describe('PWA', () => {
  it('manifest가 올바른 JSON이고 필수 필드를 갖는다', () => {
    const m = JSON.parse(readPublic('manifest.webmanifest').toString());
    expect(m.name).toBe('YJ 아케이드');
    expect(m.start_url).toBe('./index.html');
    expect(m.display).toBe('fullscreen');
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });

  it('아이콘 PNG가 실제 PNG다', () => {
    for (const [file, size] of [['icon-180.png', 180], ['icon-512.png', 512]]) {
      expect(existsSync(new URL(file, publicRoot))).toBe(true);
      const buf = readPublic(file);
      expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG 시그니처
      expect(buf.readUInt32BE(16)).toBe(size); // IHDR width
      expect(buf.readUInt32BE(20)).toBe(size); // IHDR height
    }
  });

  it('index.html이 manifest와 apple-touch-icon을 연결한다', () => {
    const html = read('index.html').toString();
    expect(html).toContain('manifest.webmanifest');
    expect(html).toContain('apple-touch-icon');
  });

  it('서비스워커가 핵심 자산을 프리캐시한다', () => {
    const sw = readPublic('sw.js').toString();
    expect(sw).toContain('./index.html');
    expect(sw).toContain('addAll');
    expect(sw).toContain('skipWaiting');
  });

  it('main.js가 서비스워커를 등록한다', () => {
    expect(read('src/main.js').toString()).toContain("register('./sw.js')");
  });
});
