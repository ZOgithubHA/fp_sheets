#!/bin/bash
# Скрипт для отправки коммитов в GitHub: https://github.com/ZOgithubHA/fp_sheets
# Использование:
#   ./push-github.sh <ВАШ_GITHUB_ТОКЕН>
# или:
#   GITHUB_TOKEN="ghp_xxx" ./push-github.sh

TOKEN="${1:-$GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "========================================================"
  echo "⚠️ Укажите ваш GitHub Personal Access Token (PAT):"
  echo "   ./push-github.sh ghp_ваш_токен_здесь"
  echo "========================================================"
  exit 1
fi

echo "🚀 Отправка изменений в https://github.com/ZOgithubHA/fp_sheets.git (main)..."
git push "https://ZOgithubHA:${TOKEN}@github.com/ZOgithubHA/fp_sheets.git" main

if [ $? -eq 0 ]; then
  echo "✅ Успешно обновлено на GitHub!"
else
  echo "❌ Ошибка при отправке. Проверьте права токена (repo access)."
fi
