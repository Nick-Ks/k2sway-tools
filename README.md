<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b0b04504-1b0f-4f7d-820c-7228ed38d094

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## GitHub Pages (웹 자동 배포)

이 저장소에는 `main`/`master` 브랜치 push 시 웹을 자동 배포하는 GitHub Actions 워크플로우가 포함되어 있습니다.

- 워크플로우 파일: `.github/workflows/deploy-pages.yml`
- 배포 URL 형식: `https://<GITHUB_USERNAME>.github.io/<REPOSITORY_NAME>/`

설정 순서:
1. GitHub 저장소 → **Settings** → **Pages**
2. **Build and deployment**에서 **Source = GitHub Actions** 선택
3. `main` 또는 `master`로 push
4. Actions 탭의 `Deploy Web to GitHub Pages` 완료 후 URL 접속

참고: Vite base 경로는 워크플로우에서 자동으로 `/${{ github.event.repository.name }}/`로 설정됩니다.
