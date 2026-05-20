#!/bin/bash
echo "=========================================="
echo "   Автоматический запуск LiterAI (Production)"
echo "=========================================="

# 1. Проверка библиотек
if [ ! -d "node_modules" ]; then
    echo "[1/3] Установка библиотек (npm install)..."
    npm install || exit 1
fi

# 2. Проверка сборки
if [ ! -d ".svelte-kit" ] && [ ! -d "build" ] && [ ! -d "dist" ]; then
    echo "[2/3] Оптимизация и сборка проекта (npm run build)..."
    npm run build || exit 1
fi

echo "[3/3] Запуск оптимизированной версии приложения..."
echo "=========================================="

# 3. Запуск продакшн-превью
npm run preview