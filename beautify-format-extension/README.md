# Beautify Format

Расширение для Visual Studio Code, которое красиво форматирует JSON и XML файлы.

## Возможности

- 🎨 Форматирование JSON файлов с правильными отступами
- 🎨 Форматирование XML файлов с правильными отступами
- ⌨️ Горячие клавиши для быстрого форматирования
- 📝 Команды в контекстном меню редактора

## Использование

### Форматирование JSON

1. Откройте JSON файл
2. Используйте один из способов:
   - Нажмите `Ctrl+Alt+J` (Windows/Linux) или `Cmd+Alt+J` (Mac)
   - Откройте палитру команд (`Ctrl+Shift+P`) и выберите "Beautify Format: Format JSON"
   - Кликните правой кнопкой мыши в редакторе и выберите "Beautify Format: Format JSON"

### Форматирование XML

1. Откройте XML файл
2. Используйте один из способов:
   - Нажмите `Ctrl+Alt+X` (Windows/Linux) или `Cmd+Alt+X` (Mac)
   - Откройте палитру команд (`Ctrl+Shift+P`) и выберите "Beautify Format: Format XML"
   - Кликните правой кнопкой мыши в редакторе и выберите "Beautify Format: Format XML"

## Горячие клавиши

| Команда | Windows/Linux | Mac |
|---------|--------------|-----|
| Format JSON | `Ctrl+Alt+J` | `Cmd+Alt+J` |
| Format XML | `Ctrl+Alt+X` | `Cmd+Alt+X` |

## Требования

- Visual Studio Code версии 1.74.0 или выше

## Установка для разработки

1. Клонируйте репозиторий
2. Установите зависимости: `npm install`
3. Скомпилируйте проект: `npm run compile`
4. Нажмите F5 для запуска Extension Development Host

## Публикация

Для публикации расширения:

1. Установите vsce: `npm install -g @vscode/vsce`
2. Создайте пакет: `vsce package`
3. Опубликуйте: `vsce publish`

## Лицензия

MIT
