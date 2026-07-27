# YJ 아케이드

유준이를 위한 오프라인 캐주얼 게임 모음집. 바닐라 JS + Canvas 2D, 런타임 의존성 0개.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm test         # 전체 테스트
npm run build    # dist/ 정적 빌드
```

## 게임 추가하기

`src/games/<id>.js` 파일 하나를 만들면 메뉴에 자동으로 뜬다. 등록 코드를 고칠 필요가 없다.
계약은 [forge/contract.md](forge/contract.md)에, 만들 게임 목록은 [forge/catalog.json](forge/catalog.json)에 있다.

새 게임은 다음 두 가지를 통과해야 한다.

```bash
npx vitest run tests/contract.test.js       # 전 게임 공통 계약
npx vitest run tests/games/<id>.test.js     # 게임별 규칙
```

## 구조

- `src/core/` — 루프, 입력, 그리기, 소리, 손맛, 난수, 저장
- `src/shell/` — 메뉴, 세션, 기록, 게임 수집, 뷰포트
- `src/games/` — 게임 (파일 1개 = 게임 1개)
- `forge/` — 양산 파이프라인 문서

PWA 정적 파일(`sw.js`, `manifest.webmanifest`, 아이콘)은 `public/`에 있고, 빌드 시 Vite가 `dist/` 루트로 그대로 복사한다.

설계 문서: `../docs/superpowers/specs/2026-07-27-yj-arcade-design.md`
