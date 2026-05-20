@echo off
chcp 65001 >nul
title LiterAI - Local Server
echo ========================================
echo   LiterAI: Локальный запуск...
echo ========================================
echo.

:: Проверка Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Скачайте и установите его с сайта: https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Проверка зависимостей...
call npm install --silent

echo [2/3] Сборка приложения...
call npm run build --silent

echo [3/3] Запуск локального сервера...
echo.
echo ========================================
echo   Приложение запущено!
echo   Откройте браузер: http://localhost:4173
echo   НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!
echo ========================================
echo.
start http://localhost:4173
call npm run preview
pause
