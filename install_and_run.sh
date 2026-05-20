#!/bin/bash

echo "========================================"
echo " LiterAI: Локальный запуск..."
echo "========================================"

# 1. Проверка, что мы в корне проекта
if [ ! -f "package.json" ]; then
    echo "[ОШИБКА] Не найден файл package.json."
    echo "Убедитесь, что скрипт запущен из корневой папки проекта."
    exit 1
fi

# 2. Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "[ОШИБКА] Node.js не найден!"
    echo "Скачайте и установите его с сайта: https://nodejs.org/"
    echo "Минимальная требуемая версия: 18.x"
    exit 1
fi

# 3. Проверка версии Node.js (>= 18)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "[ОШИБКА] Требуется Node.js версии 18 или выше!"
    echo "Текущая версия: $(node -v)"
    exit 1
fi

echo "[OK] Node.js найден (версия $(node -v))."

# 4. Обработка флага пересборки
FORCE_REBUILD=0
if [ "$1" = "--rebuild" ]; then
    FORCE_REBUILD=1
fi

# 5. Установка зависимостей (только если node_modules отсутствует)
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[1/3] Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] Не удалось установить зависимости."
        exit 1
    fi
else
    echo ""
    echo "[1/3] Зависимости уже установлены."
fi

# 6. Сборка приложения (если не собрано или запрошена пересборка)
NEED_BUILD=0
if [ ! -d ".svelte-kit" ] && [ ! -d "build" ] && [ ! -d "dist" ]; then
    NEED_BUILD=1
fi

if [ $FORCE_REBUILD -eq 1 ]; then
    NEED_BUILD=1
fi

if [ $NEED_BUILD -eq 1 ]; then
    echo ""
    echo "[2/3] Сборка приложения..."
    if [ $FORCE_REBUILD -eq 1 ]; then
        echo "(принудительная пересборка)"
    fi
    npm run build
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] Сборка не удалась."
        exit 1
    fi
else
    echo ""
    echo "[2/3] Сборка уже выполнена. Используйте флаг --rebuild, чтобы пересобрать принудительно."
fi

echo ""
echo "----------------------------------------"
echo "НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!"
echo "----------------------------------------"

# 7. Открываем браузер с задержкой, чтобы сервер успел запуститься
(
    sleep 2
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:4173"   # macOS
    else
        xdg-open "http://localhost:4173" 2>/dev/null   # Linux
    fi
) &

echo ""
echo "[3/3] Запуск локального сервера..."
echo ""
echo "Приложение запущено!"
echo "Откройте браузер: http://localhost:4173"
echo ""
npm run preview
