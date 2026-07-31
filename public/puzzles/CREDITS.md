# 직소 퍼즐 사진 출처 및 라이선스

이 폴더의 사진 10장은 `forge/contract.md`에 기록된 "이미지 금지" 원칙의 **유일하고 명시적인 예외**다(퍼즐 게임 전용). 모든 사진은 공개 배포(GitHub Pages)가 허용되는 퍼블릭 도메인 또는 CC0로, 아래에서 각 파일마다 확인한 라이선스 표시(license template)를 직접 읽고 기록했다. 저작권 있는 캐릭터(원피스/마리오/마인크래프트/로블록스 등)는 전혀 사용하지 않았다.

가공: 각 원본을 `sips`(macOS 내장)로 중앙/지정 좌표 크롭 → 720×540(4:3)으로 리샘플 → JPEG 품질 78로 압축. 비율 왜곡(찌그러짐) 없이 항상 크롭 후 리사이즈했다.

| 파일 | 제목 | 원본 출처(라이선스 확인 페이지) | 라이선스 | 저작자/기관 |
|---|---|---|---|---|
| earth.jpg | 푸른 지구 | https://images.nasa.gov/details/GSFC_20171208_Archive_e001386 | Public Domain | NASA/NOAA/GSFC/Suomi NPP/VIIRS (Norman Kuring) |
| moon-landing.jpg | 달 착륙 | https://images.nasa.gov/details/as11-40-5903 | Public Domain | NASA (Apollo 11, 1969) |
| nebula.jpg | 별이 태어나는 곳 | https://images.nasa.gov/details/GSFC_20171208_Archive_e000842 | Public Domain | NASA/ESA/Hubble (Pillars of Creation) |
| mars-rover.jpg | 화성 탐사차 | https://images.nasa.gov/details/PIA24542 | Public Domain | NASA/JPL-Caltech/MSSS (Perseverance selfie with Ingenuity) |
| rocket-launch.jpg | 로켓 발사 | https://images.nasa.gov/details/S69-39959 | Public Domain | NASA (Apollo 11 liftoff, 1969) |
| volcano.jpg | 화산 폭발 | https://commons.wikimedia.org/wiki/File:Lava_fountain_dome_2.jpg | Public domain (파일 라이선스 템플릿 확인) | J.B. Judd — USGS (volcanoes.usgs.gov) |
| coral-reef.jpg | 산호초 물고기 | https://commons.wikimedia.org/wiki/File:Parrotfish_school_over_coral_reef_Guam_2022.png | Public domain (파일 라이선스 템플릿 확인) | NOAA Fisheries / Kaylyn McCoy |
| dinosaur.jpg | 공룡 화석 | https://commons.wikimedia.org/wiki/File:Tyrannosaurus_Rex_skeleton_is_on_display_in_the_Dinosaurs_hall_at_the_Smithsonian%27s_National_Museum_of_Natural_History_in_Washington,_D.C..jpg | Public domain (파일 라이선스 템플릿 확인) | USDAgov (Flickr), Smithsonian National Museum of Natural History 전시물 사진 |
| police-car.jpg | 경찰차 | https://commons.wikimedia.org/wiki/File:Miami-dade-sheriff-office-interceptor.jpg | CC0 1.0 (Public Domain Dedication, 파일 라이선스 템플릿 확인) | Wikimedia Commons 사용자 Twiney ("Own work") |
| elephant.jpg | 코끼리 | https://commons.wikimedia.org/wiki/File:African_elephant,_Mbeli-Bai,_Republic_of_Congo_(18320426684).jpg | Public domain (파일 라이선스 템플릿 확인) | U.S. Fish and Wildlife Service Headquarters |

## 검증 방법

- **NASA 이미지 5장**: `images.nasa.gov` / `images-assets.nasa.gov`에서 받았다. NASA 자산은 [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)에 따라 원칙적으로 저작권이 없는 퍼블릭 도메인이다(로고/휘장 제외, 식별 가능한 인물 사진의 초상권 예외 존재). 달 착륙 사진은 우주복 바이저에 반사만 보이고 얼굴이 식별되지 않아 이 예외에 해당하지 않는다.
- **Wikimedia Commons 5장**: 각 파일 페이지를 `commons.wikimedia.org`의 API(`imageinfo|extmetadata`)로 직접 조회해 `LicenseShortName`(Public domain 또는 CC0)과 `Artist`/`Credit`을 확인했다 — 썸네일이나 카테고리 이름만으로 추정하지 않았다. 전부 미국 연방/주 정부 기관(USGS, NOAA, USDA, USFWS)의 공무 저작물이거나(자동 퍼블릭 도메인) 업로더가 CC0로 명시적으로 헌정한 사진이라 **어느 것도 UI 내 출처 표시(attribution)가 법적으로 필요하지 않다.** (Attribution required: false / CC0)

## 내용 검토

10장 전부 실제로 열어서 확인했다: 8세 아동에게 부적절한 요소 없음, 식별 가능한 얼굴이 크게 나온 사진 없음(마이애미-데이드 경찰차 사진의 배경 인물은 업로더가 이미 얼굴을 모자이크 처리함). 프레임 전체에 색과 질감이 풍부해 직소 퍼즐로 만들었을 때 어느 조각도 완전히 비어 보이지 않도록, 원본이 빈 하늘/단색 배경을 크게 포함하면 `sips`로 중앙이 아닌 지정 좌표를 크롭해 여백을 최소화했다(지구, 로켓 발사 사진 등).
