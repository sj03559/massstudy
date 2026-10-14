# MassStudy

대지 도면(DXF·3DM)을 올리면 블루폼 매스 대안을 형태별로 만들고, 3D로 고치고, 고른 안을 일러스트(.ai/SVG/PNG)·라이노(OBJ)로 내보내는 웹사이트예요.
서버 없이 정적 파일만으로 돌아가요. 로그인·클라우드 저장은 선택이에요.

```
index.html      첫 화면
app.html        작업실
config.js       클라우드 저장 설정 (비워 두면 브라우저 저장만)
supabase.sql    클라우드 저장용 테이블
css/ js/        스타일과 기능
```

## 1. 사이트 올리기 (무료)

**Netlify (제일 쉬움)**
1. https://app.netlify.com/drop 에 가입
2. 이 폴더 통째로 끌어다 놓기 → `○○.netlify.app` 주소가 바로 생겨요
3. 고칠 때마다 다시 끌어다 놓으면 돼요

**GitHub Pages**
1. 새 저장소(예: `massstudy`)에 이 폴더 내용을 올리기
2. Settings → Pages → Branch `main` / root → Save
3. `아이디.github.io/massstudy` 로 열려요

## 2. MassStudy 도메인 연결

1. 가비아·Cloudflare·Namecheap 등에서 도메인 구입 (예: massstudy.com, massstudy.kr, massstudy.app — 남은 걸로)
2. Netlify: Site settings → Domain management → Add domain → 안내에 나온 DNS 값을 도메인 산 곳에 입력
   GitHub Pages: Settings → Pages → Custom domain 에 입력하고, 도메인 DNS에 GitHub 안내 값(A 레코드 4개 또는 CNAME) 입력
3. 몇 분~몇 시간 뒤 https 까지 자동으로 붙어요

## 3. 로그인·클라우드 저장 켜기 (선택, 무료)

1. https://supabase.com 가입 → New project
2. SQL Editor 에 `supabase.sql` 내용을 붙여넣고 Run
3. Project Settings → API 에서 **Project URL** 과 **anon public key** 를 복사해 `config.js` 에 넣기
4. Authentication → URL Configuration
   - Site URL: 내 사이트 주소 (예: `https://massstudy.com`)
   - Redirect URLs: `https://massstudy.com/app.html` 추가 (netlify 주소도 쓰면 같이)
5. 사이트를 다시 올리면 작업실 오른쪽 위에 **로그인** 버튼이 생겨요

로그인은 이메일 링크 방식이라 비밀번호가 없어요. 로그인하면 프로젝트가 자동으로 계정에 저장되고, 프로젝트 목록에서 공유 링크를 만들 수 있어요(받은 사람은 사본으로 열림).
anon key 는 공개돼도 되는 키예요. 데이터는 테이블의 보안 규칙(RLS)으로 본인 것만 읽고 쓰게 막혀 있어요.
Supabase 무료 메일은 시간당 보낼 수 있는 수가 적어요. 사용자가 많아지면 Authentication → SMTP 에 학교·Gmail 등 메일 서버를 연결하세요.

## 참고
- 3D 화면(three.js), 3DM 읽기(rhino3dm.js), 로그인(supabase-js)은 CDN에서 불러와요.
- 시트 글꼴: Noto Sans KR (SIL OFL 1.1), 화면 글꼴: IBM Plex (SIL OFL 1.1)
