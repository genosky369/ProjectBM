@echo off
chcp 65001 >nul
echo ========================================
echo   캐릭터 성장 시뮬레이터 실행 중...
echo ========================================
echo.

cd /d "%~dp0simulator-v2"

:: node_modules 없으면 설치
if not exist "node_modules" (
    echo 패키지 설치 중...
    call npm install
    echo.
)

echo 브라우저에서 자동으로 열립니다.
echo 종료하려면 이 창을 닫으세요.
echo.

start http://localhost:5173
call npx vite --host
