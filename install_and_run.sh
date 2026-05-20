#!/bin/bash
echo "========================================"
echo "  LiterAI: Локальный запуск..."
echo "========================================"
npm install --silent
npm run build --silent
echo "Откройте браузер: http://localhost:4173"
echo "НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!"
open http://localhost:4173 || xdg-open http://localhost:4173
npm run preview
