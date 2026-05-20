@echo off
chcp 65001 >nul
title LiterAI - Local Server

echo ========================================
echo  LiterAI: Локальный запуск...
echo ========================================
echo.

:: 1. Проверка, что мы в корне проекта
if not exist "package.json" (
    echo [ОШИБКА] Не найден файл package.json.
    echo Убедитесь, что скрипт запущен из корневой папки проекта.
    pause
    exit /b 1
)

:: 2. Проверка наличия Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Скачайте и установите его с сайта: https://nodejs.org/
    echo Минимальная требуемая версия: 18.x
    pause
    exit /b 1
)

:: 3. Проверка минимальной версии Node.js (>= 18)
node -e "process.exit(parseInt(process.version.slice(1).split('.')[0]) < 18 ? 1 : 0)" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ОШБИКА] Требуется Node.js версии 18 или выше!
    echo Текущая версия:
    node -v
    pause
    exit /b 1
)

echo [OK] Node.js найден.

:: 4. Проверка аргумента принудительной пересборки
set "FORCE_REBUILD=0"
if /I "%1"=="--rebuild" set "FORCE_REBUILD=1"

:: 5. Установка зависимостей (только если node_modules отсутствует)
if not exist "node_modules\" (
    echo.
    echo [1/3] Установка зависимостей...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ОШИБКА] Не удалось установить зависимости.
        pause
        exit /b 1
    )
) else (
    echo.
    echo [1/3] Зависимости уже установлены.
)

:: 6. Сборка приложения (если не собрано или запрошена пересборка)
set "NEED_BUILD=0"
if not exist ".svelte-kit\" if not exist "build\" if not exist "dist\" set "NEED_BUILD=1"
if %FORCE_REBUILD% EQU 1 set "NEED_BUILD=1"

if %NEED_BUILD% EQU 1 (
    echo.
    echo [2/3] Сборка приложения...
    if %FORCE_REBUILD% EQU 1 echo (принудительная пересборка)
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ОШИБКА] Сборка не удалась.
        pause
        exit /b 1
    )
) else (
    echo.
    echo [2/3] Сборка уже выполнена. Используйте флаг --rebuild, чтобы пересобрать принудительно.
)

:: 7. Запуск сервера и открытие браузера
echo.
echo ========================================
echo [3/3] Запуск локального сервера...
echo ========================================
echo.
echo Приложение запущено!
echo Откройте браузер: http://localhost:4173
echo НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!
echo.
start http://localhost:4173
call npm run preview

pause
