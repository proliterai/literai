@echo off
chcp 65001 > nul
echo ==========================================
echo   Автоматический запуск LiterAI (Production)
echo ==========================================

:: 1. Проверка библиотек
if not exist "node_modules\" (
    echo [1/3] Установка библиотек (npm install)...
    call npm install
    if %errorlevel% neq 0 ( echo Ошибка сборки! & pause & exit /b )
)

:: 2. Проверка сборки (ищем папку сборки SvelteKit или Vite)
if not exist ".svelte-kit\" if not exist "build\" if not exist "dist\" (
    echo [2/3] Оптимизация и сборка проекта (npm run build)...
    call npm run build
    if %errorlevel% neq 0 ( echo Ошибка компиляции! & pause & exit /b )
)

echo [3/3] Запуск оптимизированной версии приложения...
echo ==========================================

:: 3. Запуск продакшн-превью вместо dev-режима
call npm run preview

pause