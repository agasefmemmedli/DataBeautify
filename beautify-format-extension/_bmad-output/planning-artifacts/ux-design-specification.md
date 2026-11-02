---
stepsCompleted: 
  - 'step-01-init'
  - 'step-02-discovery'
  - 'step-03-core-experience'
  - 'step-04-emotional-response'
  - 'step-05-inspiration'
  - 'step-06-design-system'
  - 'step-07-defining-experience'
  - 'step-08-visual-foundation'
  - 'step-09-design-directions'
  - 'step-10-user-journeys'
inputDocuments: 
  - 'planning-artifacts/prd.md'
  - '_bmad-output/project-context.md'
date: '2026-04-22'
---

# UX Design Specification - beautify-format-extension

**Author:** Agasef  
**Date:** 2026-04-22  
**Project:** beautify-format-extension

---

## Executive Summary

### Project Vision

**beautify-format-extension** — VS Code extension, который делает форматирование **fault-tolerant и быстрым**. 
В отличие от стандартных форматтеров (Prettier, ESLint), наш инструмент работает даже с "грязными" файлами: 
восстанавливает структуру из синтаксических ошибок и механических проблем, затем применяет форматирование.

**Основное обещание:** От "нечитаемого файла" к "аккуратному формату" за одно действие (1-2 сек).

### Target Users

1. **Разработчик (Primary, 70% usage)**
   - Быстро правит TS/JSON/XML/конфиг-файлы в процессе работы
   - Хочет форматировать горячей клавишей за 1-2 сек
   - Работает в реальных условиях с частыми опечатками и неполными правками
   - Не хочет включать голову в процесс форматирования

2. **DevOps/Maintainer (Secondary, 20% usage)**
   - Отслеживает качество релизов и метрики (success rate, p95, рейтинг)
   - Отвечает за compatibility 40+ форматов
   - Приоритизирует edge-case улучшения и регрессии

3. **Support/Troubleshooting (Tertiary, 10% usage)**
   - Помогает пользователям с проблемными файлами
   - Воспроизводит edge-case сценарии
   - Преобразует инциденты в test-cases и улучшения

### Key Design Challenges

1. **Баланс между скоростью и надёжностью**
   - Цель: p95 ≤ 2 сек на типовых файлах
   - Вызов: Fault-tolerant recovery добавляет сложность
   - Решение: Tiered approach — быстрый path для здоровых файлов, recovery pipeline для проблемных

2. **Понятная коммуникация результатов**
   - Нужно показать пользователю, что произошло (успех / ошибка / частичный успех)
   - Вызов: Как избежать "notification fatigue" при частых форматированиях?
   - Решение: Minimal-by-default (silent success), explicit feedback для проблем

3. **Discovery и accessibility 40+ форматов**
   - Вызов: Пользователь должен знать, какие форматы поддерживаются
   - Решение: Умное определение формата + feedback при unsupported файлах

### Design Opportunities

1. **Контекстное меню как основной UI**
   - Одна горячая клавиша / контекстное меню → форматирование
   - Минимизация UI clutter в main editor'е

2. **Incremental feedback system**
   - Спиннер/прогресс во время форматирования
   - Explicit success/failure messaging без alarm-fatigue

3. **Intelligent recovery indication**
   - Показать пользователю, что произошёл recovery
   - Educate о том, что файл был проблемным, но форматирование помогло

## Core User Experience

### Defining Experience

**The One Thing:** Разработчик форматирует файл одной командой (горячая клавиша, меню, или автоматически) и продолжает работу без отвлечений.

Форматирование должно быть **invisible** в happy path:
- Выполняется за 1-2 сек
- Silent success (ничего не показываем)
- Даже "грязные" файлы восстанавливаются автоматически
- Нулевая cognitive load на пользователя

### Platform Strategy

**Three Invocation Patterns:**

1. **Keyboard Shortcut** (Primary)
   - Быстрый access для power users
   - Стандартный VS Code pattern (Ctrl+Shift+F или аналог)

2. **Context Menu** (Secondary)
   - Для пользователей, которые не знают горячую клавишу
   - Right-click → "Format Document/Selection"

3. **On-Save Hook** (Tertiary, optional in settings)
   - Auto-format при сохранении файла
   - Требует явного включения в settings
   - Для тех, кто хочет "set and forget"

**Smart Format Detection:**
- Автоматическое определение формата файла (JSON, XML, Python, etc.)
- Ноль конфигурации нужно из коробки

### Effortless Interactions

1. **Silent Success**
   - Файл успешно форматируется → никакого feedback (не показываем notification)
   - Пользователь видит результат в editor'е — этого достаточно

2. **Automatic Recovery**
   - Даже при синтаксических ошибках инструмент пытается восстановить
   - Результат улучшается автоматически без лишних action'ов

3. **No Settings Required**
   - Out-of-the-box работает для всех 40+ форматов
   - Опциональные настройки для power users (в settings)

### Critical Success Moments

1. **Happy Path (80% cases)**
   - Файл открыт, нажал горячую клавишу → за ≤2 сек файл красивый и готов
   - Пользователь чувствует: "это просто работает"

2. **Recovery Path (15% cases)**
   - Файл с ошибками → форматирование всё равно помогает
   - Пользователь: "инструмент спас мне кучу времени на ручную правку"

3. **Error Case (5% cases)**
   - Файл так испорчен, что форматирование невозможно
   - Пользователь получает clear error message → знает, что делать дальше

### Experience Principles

- **Silent Success:** Не надоедаем пользователю уведомлениями за каждое форматирование
- **Minimal Cognitive Load:** Ноль конфигурации, ноль диалогов в happy path
- **Intelligent Fault Tolerance:** Даже "грязные" файлы улучшаются
- **Fast Feedback:** Результат видно немедленно (≤2 сек)

## Desired Emotional Response

### Primary Emotional Goals

**Trust & Confidence**
- Разработчик доверяет инструменту не сломать его файл
- Даже при recovery или ошибках пользователь спокойно относится к результату
- "Это инструмент, на который я могу полагаться"

**Relief & Gratitude**
- Сэкономил время на ручной правке грязного файла
- Благодарность за автоматическое восстановление
- "Спасибо, что сделал это за меня"

**Calm & Focused**
- Форматирование не отвлекает пользователя уведомлениями
- Молчаливый успех — пользователь видит результат и продолжает работу
- "Это просто работает, я могу сконцентрироваться на коде"

### Emotional Journey Mapping

**Discovery Phase**
- Эмоция: **Интрига/Любопытство** → "Может ли это действительно восстановить грязные файлы?"
- UX: Четкое описание функционала, примеры на странице marketplace

**First Use (Happy Path)**
- Эмоция: **Удовлетворение** → "Сработало быстро и молча"
- UX: Файл форматируется за ≤2 сек, нет лишних диалогов

**First Use (Recovery Path)**
- Эмоция: **Delighted Surprise** → "Даже грязный файл улучшился!"
- UX: Результат явно лучше, пользователь видит успех

**Repeated Use**
- Эмоция: **Habitual Trust** → "Я просто нажимаю горячую клавишу, это работает"
- UX: Консистентное поведение, нулевая friction

**Error Case**
- Эмоция: **Calm Understanding** → "Понимаю, что произошло, знаю, что делать"
- UX: Clear error message, возможность на действие

### Micro-Emotions to Address

**Trust vs Skepticism** (CRITICAL)
- Как избежать: Никогда не молчим при ошибках
- Как строить: Быстрые, видимые успехи, даже на грязных файлах
- Дизайн: Explicit error messages для серьёзных проблем

**Control vs Uncertainty**
- Как избежать: Пользователь всегда видит результат (нет "магии")
- Как строить: Понятное поведение (auto-detect format, recovery logic)
- Дизайн: Settings для power users (on-save options, format rules)

**Accomplishment vs Frustration**
- Как избежать: Файл готов к use после форматирования
- Как строить: Even recovery paths улучшают файл (never worse)
- Дизайн: Успех visible (файл изменился в editor'е)

**Confidence vs Anxiety** (CRITICAL for brownfield)
- Как избежать: Никогда не меняем intent пользователя
- Как строить: Reverting is easy (Ctrl+Z работает)
- Дизайн: Preview option для risk-averse users (опционально в настройках)

### Design Implications

**To Create Trust:**
- Быстрые результаты (p95 ≤ 2 сек) → доверие в reliability
- Explicit error messages → доверие в honesty инструмента
- Consistent behavior → доверие в predictability
- Never break user intent → доверие в safety

**To Maintain Calm & Focus:**
- Silent success (no notifications in happy path) → не отвлекаем
- Auto-detect format → zero decision-making
- One-click activation → minimal friction

**To Enable Relief:**
- Visible improvement (even on dirty files) → sense of accomplishment
- Fast execution → relief from waiting
- Recovery attempts (not immediate failure) → relief from impossible situations

### Emotional Design Principles

- **Trust Through Speed:** Быстрое форматирование = доверие в reliability
- **Calm Through Silence:** Молчаливый успех = спокойный, focused workflow
- **Safety Through Clarity:** Clear errors & recovery = confidence in tool
- **Empowerment Through Simplicity:** Ноль конфигурации = полный контроль без complexity
- **Delight Through Reliability:** Consistent fault-tolerance = grateful, happy users

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**VS Code Built-in Formatter (Default Behavior)**
- ✅ Silent success: Форматирует, ничего не показывает в happy path
- ✅ One-click activation: Ctrl+Shift+F → done
- ✅ Minimal UI: Результат видно в editor'е сразу
- ⚠️ Limited recovery: Отказывает на грязных файлах (наш инструмент должен быть лучше)

**Prettier**
- ✅ Invisible saves: Часто работает on-save без уведомлений
- ✅ Fast execution: Быстрое форматирование (соответствует нашей цели p95 ≤ 2 сек)
- ✅ Clear output: Изменения видны в editor'е
- ❌ No recovery: Ломается на невалидном синтаксисе (наша differentiator)

**GitLens**
- ✅ Inline information: Показывает info directly в коде (не отвлекает main UI)
- ✅ Optional visibility: Можно toggle на/off в settings
- ✅ Respectful notifications: Notifications только для important events
- ✅ Fast feedback: Real-time updates без lag

**Thunder Client**
- ✅ Instant response: Request выполняется, результат видно сразу
- ✅ Status clarity: Явный статус-код, время выполнения
- ✅ Error details: На ошибки показывает clear message с возможностью действия

### Transferable UX Patterns

**Silent Success Pattern**
- Applicable: Успешное форматирование в happy path не требует notification
- Implementation: Файл изменяется в editor'е → пользователь видит результат → готово
- Benefit: Не раздражаем user на каждый successful action

**One-Action Activation Pattern**
- Applicable: Горячая клавиша / меню → форматирование запускается
- Implementation: Keyboard shortcut + context menu (две точки входа для разных пользователей)
- Benefit: Минимальная friction, быстрый access для power users

**Fast Feedback Pattern**
- Applicable: Результат форматирования видно немедленно (≤2 сек)
- Implementation: Show spinner во время работы (optional, если >500ms)
- Benefit: Пользователь знает, что происходит, ничего не "зависло"

**Minimal Notification Pattern**
- Applicable: Notifications только на CRITICAL events (серьёзные ошибки, unsupported files)
- Implementation: Success → молчание, Error → explicit message, Partial success → optional info message
- Benefit: Avoid notification fatigue, сохранить user focus

**Inline Error Clarity Pattern**
- Applicable: Если возникает ошибка, показать clear message с контекстом
- Implementation: Error message указывает причину + possible next steps
- Example: "XML syntax error at line 5: unclosed tag" → пользователь знает, что исправить

**Smart Auto-Detect Pattern**
- Applicable: Автоматическое определение формата без user intervention
- Implementation: Detect по file extension + content analysis если нужно
- Benefit: Zero configuration needed

### Anti-Patterns to Avoid

**Notification Fatigue**
- ❌ Anti-pattern: Показывать notification на каждое успешное форматирование
- Почему плохо: User раздражает, отвлекает от работы
- Solution: Молчаливый успех по default, уведомления только на ошибки

**Unclear Error Messages**
- ❌ Anti-pattern: Generic error like "Format failed" без контекста
- Почему плохо: User не знает, что произошло или как исправить
- Solution: Explicit error с line number, reason, и suggestion

**Configuration Overload**
- ❌ Anti-pattern: Требовать от user конфигурировать множество опций
- Почему плохо: Complexity отвлекает от основной task
- Solution: Sensible defaults, опциональные settings для power users

**No Feedback During Long Operations**
- ❌ Anti-pattern: Форматирование работает молча >2 сек, user думает, что "зависло"
- Почему плохо: Uncertainty creates anxiety
- Solution: Показать spinnер или progress если операция долгая

**Ignoring User Intent**
- ❌ Anti-pattern: Форматирование меняет больше, чем expected (например, удаляет комментарии)
- Почему плохо: User теряет контроль и доверие
- Solution: Форматирование only changes formatting, never changes intent/meaning

**Silent Failures**
- ❌ Anti-pattern: Форматирование "не сработало" но user это не узнает
- Почему плохо: User ничего не меняется, думает всё ok
- Solution: Всегда дать feedback (success или error)

### Design Inspiration Strategy

**What to Adopt:**

1. **Silent Success Pattern** — Успешное форматирование должно быть invisible
   - Почему: Соответствует нашему emotional goal "calm & focused"
   - Как: File changes, no notification, user continues working

2. **One-Click Activation** — Горячая клавиша + контекстное меню
   - Почему: Supports multiple user types (power users + casual users)
   - Как: Keyboard shortcut для быстрого доступа, menu для discoverability

3. **Fast Feedback Pattern** — Результат за ≤2 сек
   - Почему: Builds trust in reliability и соответствует нашему success criteria
   - Как: p95 ≤ 2 сек, spinner если >500ms

4. **Minimal Notification Pattern** — Уведомления только на critical issues
   - Почему: Preserve user focus и prevent fatigue
   - Как: Success молча, Error → explicit message, Partial success → info message

**What to Adapt:**

1. **Inline Error Clarity** — Адаптировать для формата-specific errors
   - Адаптация: JSON errors → "Unexpected character at line X", XML errors → "Unclosed tag: <foo>"
   - Benefit: User gets actionable feedback

2. **Smart Auto-Detect** — Расширить с content-based detection
   - Адаптация: Определять формат не только по extension, но и по content patterns
   - Benefit: Works even on misnamed files

**What to Avoid:**

1. **Notification Fatigue** — Никогда не показываем success notifications
   - Почему: Conflicts with "calm & focused" emotional goal
   - Как: Silent success only

2. **Configuration Overload** — Defaults must work for 80%+ users
   - Почему: Matches "minimal cognitive load" principle
   - Как: Basic settings in extension, power-user options only if needed

3. **Silent Failures** — Always provide feedback on errors
   - Почему: Builds trust and prevents confusion
   - Как: Clear error message for every failure case

4. **Ignoring User Intent** — Форматирование only changes formatting
   - Почему: Essential for trust & confidence emotional goal
   - Как: Never remove/modify code logic or user comments

## Design System Foundation

### Design System Choice: VS Code Native UI

**Выбранный подход:** Native VS Code Components (Option 1)

**Почему этот выбор:**

1. **Perfect alignment with product requirements**
   - Продукт предусматривает очень простой UI (горячая клавиша → форматирование)
   - Встроенные VS Code компоненты fully достаточны
   - Нулевая сложность — это наша сила, не ограничение

2. **User expectations in VS Code**
   - Пользователи VS Code ожидают native UI от extensions
   - Встроенные components автоматически match VS Code theme (light/dark/high contrast)
   - Familiar patterns = zero learning curve

3. **Aligns with emotional goals**
   - "Calm & focused" → native UI doesn't add clutter
   - "Silent success" → native notifications (неинтрузивные по design)
   - "Minimal cognitive load" → используем знакомые patterns

4. **Technical simplicity**
   - Нет design system overhead
   - Быстрая разработка
   - Легко обслуживать
   - Соответствует TypeScript/VS Code Extension constraints из project-context

### Implementation Approach

**UI Components We'll Use:**

1. **Command Palette** (Primary activation)
   - User types "Beautify Format" or hotkey
   - Execution happens in background
   - This is our main UI surface

2. **Status Messages** (Feedback)
   - Success: `vscode.window.showInformationMessage` (optional, only if needed)
   - Error: `vscode.window.showErrorMessage` (clear, actionable)
   - Progress: Status bar indicator если >500ms
   ```
   // Example:
   vscode.window.showErrorMessage(
     "XML syntax error at line 5: unclosed tag",
     "Details"
   )
   ```

3. **Status Bar** (Optional indicator)
   - Show formatting status during long operations
   - Quick access to format options

4. **Settings** (Configuration)
   - Use VS Code's built-in settings (settings.json)
   - No custom UI needed
   - Simple key-value pairs:
   ```json
   {
     "beautify-format.onSave": false,
     "beautify-format.formats": ["json", "xml", "python", ...],
     "beautify-format.recoveryAttempts": true
   }
   ```

5. **Context Menu** (Secondary activation)
   - Right-click → "Format Document"
   - Integrates with VS Code native context menus

### Design Tokens & Consistency

**Message Tone:**
- Errors: Clear, specific, actionable
- Success: Silent (no notification) or minimal info message
- Progress: Status bar updates during long operations

**Color Usage:**
- Inherit from VS Code theme automatically
- No custom colors needed
- High contrast accessible by default

**Interaction Patterns:**
- Single-click activation (hotkey or menu)
- Immediate visual feedback (file changes in editor)
- No dialogs or confirmations in happy path

### Customization Strategy

**For Basic Users:**
- Out-of-the-box works perfectly
- No configuration needed
- Hotkey + context menu = sufficient

**For Power Users:**
- settings.json configuration for:
  - Enable/disable on-save formatting
  - Control recovery behavior
  - Customize supported formats
  - Format-specific options (indent size, line length, etc.)

**For Future Enhancement:**
- If complex settings UI needed later → add WebView for settings panel
- Keep native UI for core operations (activate, feedback)
- Hybrid approach keeps simplicity + flexibility

### Design Principles from This Choice

- **Native Integration:** Every component feels like part of VS Code
- **Respectful Notifications:** Only interrupt for errors/critical info
- **Zero Configuration Default:** Works immediately without setup
- **Accessible by Default:** Inherits VS Code accessibility
- **Fast & Lightweight:** No extra overhead or dependencies

## Core User Interaction Definition

### Defining Experience

**"One-Click Format"**

Разработчик с одним действием (горячая клавиша, меню, или меню-click) преобразует текущий файл из текущего состояния в красиво отформатированное состояние за 1-2 секунды.

Это просто, понятно и работает каждый раз. Нет диалогов, нет выбора, нет конфигурации в happy path.

### User Mental Model

**Ожидание пользователя:**
- "Я нажму горячую клавишу → мой файл станет красивым"
- "Если есть проблемы → я их увижу, но файл не будет испорчен"
- "Я контролирую когда это происходит (нет auto-magic)"

**Текущий контекст:**
- Пользователи используют Prettier, ESLint, и встроенные форматтеры
- Они привыкли к "нажми — готово" паттерну
- Они хотят простоты, не конфигурации

**Что делает нас особенными:**
- Мы работаем даже на грязных файлах (differentiator)
- Но мы не меняем их поведение (predictable, trustworthy)

### Success Criteria for Core Experience

**1. Happy Path (80% of cases)**
- User нажимает горячую клавишу
- За ≤2 сек файл форматируется
- User видит изменения в editor'е
- Zero notifications, zero friction
- **Success metric:** p95 ≤ 2 сек, ≥80% success rate

**2. Error Case (5% of cases)**
- User пытается форматировать невалидный файл
- Extension показывает clear error message
- Файл NOT изменяется (never corrupt)
- User может исправить и попробовать снова
- **Success metric:** Clear error message in <1 сек, zero corruptions

**3. Recovery Case (15% of cases)**
- User форматирует "грязный" файл с синтаксическими ошибками
- Extension показывает результат (улучшено несмотря на ошибки)
- User видит позитивный результат
- **Success metric:** ≥85% success rate on broken files, visible improvement

### Experience Mechanics: Step by Step

**Step 1: Initiation**

User Action:
- Горячая клавиша (e.g., Ctrl+Shift+Alt+B)
- OR Right-click context menu → "Format Document"
- OR Command Palette → "Beautify Format: Format Document"

System Response:
- Immediate execution (no dialogs, no prompts)
- If >500ms, show status bar indicator: "Formatting..."

**Step 2: Format Detection**

System:
- Determines file format from extension (json, xml, py, etc.)
- If unknown → show error "Unsupported format: .xyz"
- Proceed only for supported formats

**Step 3: Formatting Execution**

System:
- Load file content
- Apply format-specific formatter
- If syntax errors → still attempt to format (our differentiator)
- Generate formatted output

**Step 4: Feedback & Application**

Success Path:
- Apply changes to document
- No notification (silent success)
- Editor shows changed file (visual feedback enough)
- User continues working

Error Path:
- Don't apply changes
- Show error: "Cannot format: {reason}" with line/column context
- Example: "XML error at line 5: unclosed <tag> element"
- User can fix and retry

**Step 5: Completion**

- User sees formatted file in editor
- Ctrl+Z available if change not desired
- Ready for next action

### Pattern Classification

**Established Pattern:** "One-Click Action"
- This is NOT novel — similar to Prettier, ESLint
- Users already understand this interaction
- We're not innovating in HOW to format, but in WHAT we can format
- Benefit: Zero learning curve

**Novel Element:** Fault-Tolerant Recovery
- New: We format even with syntax errors
- But this happens invisibly — user just sees better file
- Not part of core interaction mechanics, but backend capability

### Design Principles

- **Simplicity First:** Entire document, no selection complexity
- **Predictability:** Same behavior every time (no guessing)
- **Clear Errors:** No silent failures, always tell user what happened
- **User Control:** Manual only (no auto-magic), user decides when
- **Safe by Default:** Never corrupt file, worst case = no change
- **Fast by Default:** p95 ≤ 2 сек = feels instant

### Future Enhancements (Not in MVP)

- On-save formatting (if user explicitly enables)
- Selection formatting (if clear demand from users)
- Format-specific options (indent size, line length, etc.)
- Recovery indication ("This file had errors, but formatting helped")

## Visual Design Foundation

### Color System

**VS Code Theme Inheritance**

Мы используем native VS Code theme system — все цвета автоматически адаптируются к выбранной пользователем теме (Light, Dark, High Contrast).

**Semantic Color Mapping:**

1. **Success State**
   - Color: VS Code `charts.green` (native success color)
   - Usage: Successful formatting completion (if notification shown)
   - Example: Status message "Document formatted successfully"

2. **Error State**
   - Color: VS Code `errorForeground` (native error color)
   - Usage: Format failures, unsupported formats, clear blocking errors
   - Example: "XML syntax error at line 5: unclosed tag"

3. **Info State**
   - Color: VS Code `infoPrimary` (native info color)
   - Usage: Informational messages, optional feedback
   - Example: "Document has 150 lines, formatted in 1.2 seconds"

4. **Neutral/UI**
   - Color: Inherited from VS Code editor theme
   - Usage: All UI elements (status bar, buttons, text)
   - Auto-switches light/dark based on user preference

**Accessibility:**

- ✅ All VS Code colors meet WCAG AA contrast requirements
- ✅ High Contrast theme automatically supported
- ✅ No custom color overrides = maximum accessibility
- ✅ Color-blind friendly (not relying only on color for meaning)

### Typography System

**Font Selection**

1. **Editor Font (Code)**
   - Use: File content display
   - Font: VS Code's user-configured monospace font (e.g., Fira Code, Consolas)
   - Rationale: Code readability, consistency with editor

2. **UI Font (Messages)**
   - Use: Error messages, notifications, status indicators
   - Font: VS Code's default UI font (Segoe UI, Helvetica, Arial)
   - Rationale: Clean, professional, accessible

**Type Scale & Hierarchy**

- **Messages:** Standard VS Code message size (13-14px)
- **Error Details:** Smaller secondary text (12px) for line numbers and context
- **Status Bar:** Icon + short text (standard VS Code size)

**Line Height & Spacing**

- **Error/Info Messages:** Line height 1.4 for readability
- **Status Bar:** Compact, consistent with VS Code toolbar

**Tone & Voice**

- **Professional & Clear:** "XML syntax error at line 5"
- **Not Casual:** Avoid exclamation marks or emoji
- **Specific Not Generic:** "Unclosed tag" not "Format failed"
- **Actionable:** Include line numbers and specific error context

### Spacing & Layout Foundation

**Base Spacing Unit:** 4px (inherited from VS Code)

**Component Spacing:**

1. **Status Bar Indicator**
   - Padding: 6px (left/right)
   - Icon + text spacing: 4px
   - Consistent with other VS Code extensions

2. **Error/Info Messages**
   - Padding: 10px (top/bottom), 12px (left/right)
   - Icon + text spacing: 8px
   - Line height: 1.4 for readability

3. **Command Palette**
   - Uses native VS Code spacing
   - Our command appears with standard styling

**Layout Principles**

- **Minimal Density:** Compact, efficient UI (no wasted space)
- **Consistent with VS Code:** Match existing extension patterns
- **Accessibility:** Adequate touch targets (48px min for keyboard-accessible elements)
- **Responsive:** Works on all VS Code window sizes

### Icon System

**Codicon (VS Code Icon Library)**

We use Codicon — the official VS Code icon library for consistency.

**Icon Usage:**

1. **Command Activation**
   - Icon: `symbol-method` or `zap` (formatting action)
   - Usage: Command Palette display
   - Alternative: No icon needed (text command is sufficient)

2. **Status Bar Indicator**
   - Icon: `sparkles` (success) or `alert` (error)
   - Usage: Status bar during long operations
   - Fallback: Text-only ("Formatting...")

3. **Error/Info Messages**
   - Auto-included by VS Code message system
   - Red icon for errors, info icon for messages
   - No custom icon configuration needed

**Rationale for Codicon:**

- ✅ Consistent with all VS Code extensions
- ✅ Automatically scales and colors for theme
- ✅ Accessibility built-in
- ✅ Zero maintenance overhead

### Accessibility Considerations

**Color Contrast**

- ✅ All error/success/info colors meet WCAG AA standards
- ✅ High Contrast theme fully supported (inherited)
- ✅ Not relying on color alone (always include text labels)

**Typography Accessibility**

- ✅ Minimum 12px font size for UI text
- ✅ 1.4+ line height for readability
- ✅ Sans-serif for UI, monospace for code

**Interactive Elements**

- ✅ Keyboard navigation (hotkey activation)
- ✅ Clear focus indicators (inherited from VS Code)
- ✅ Sufficient touch targets for accessibility

**Responsive Design**

- ✅ Works on all VS Code window sizes
- ✅ Messages stack properly on small displays
- ✅ Status bar indicators work on narrow viewports

### Visual Design Decisions Summary

| Element | Choice | Rationale |
|---------|--------|-----------|
| **Color System** | VS Code theme inheritance | Zero friction, auto-accessible, respects user theme |
| **Typography** | VS Code defaults | Consistency, no custom font loading |
| **Icons** | Codicon library | Native integration, automatic theming |
| **Spacing** | 4px/8px grid | Matches VS Code patterns |
| **Tone** | Professional & specific | Builds trust and clarity |

### Future Visual Enhancements (If Needed)

- Custom WebView settings panel (if complex configuration needed)
- Syntax highlight customization UI (future feature)
- Format-specific visual indicators
- Recovery success indication UI

These would use the same color/typography foundation for consistency.

## Design Direction Decision

### Design Directions Explored

Для beautify-format-extension (Native VS Code Extension) исследовали следующие направления:

**Direction 1: Minimal Error Approach**
- Message: "XML error at line 5"
- Tone: Ultra-brief, assumes user knows what to do
- Use case: Power users who want quick information
- Risk: Might be too terse for unclear errors

**Direction 2: Detailed Context Approach**
- Message: "XML syntax error at line 5: unclosed <tag> element"
- Tone: Clear, specific, provides context
- Use case: Users need to understand what went wrong
- Benefit: Actionable without being verbose

**Direction 3: Helpful Suggestion Approach**
- Message: "XML syntax error at line 5: unclosed tag <foo>
           Hint: Check opening/closing tag pairs"
- Tone: Professional + helpful
- Use case: Guiding users to solution
- Risk: Might be too wordy for frequent errors

**Direction 4: Recovery Indication Approach**
- Message: "Document has syntax errors but formatting improved structure"
- Tone: Transparent about recovery action
- Use case: Grayed recovery path (not error, but not pure success)
- Benefit: Educates user about fault-tolerance capability

**Interaction Pattern Variations:**

- **Pattern A: Silent Success Only**
  - Happy path: No notification (visual change = feedback)
  - Error: Explicit error message
  - Recovery: Visual change only (silent)
  - Best for: Minimal distraction, trusting users

- **Pattern B: Smart Notifications**
  - Happy path: Silent (>80% of cases don't notify)
  - Error: Explicit message (always)
  - Recovery: Optional info message (can disable)
  - Long ops: Status bar indicator if >500ms
  - Best for: Clear feedback without fatigue

- **Pattern C: Comprehensive Feedback**
  - Happy path: Brief success message
  - Error: Detailed error with suggestions
  - Recovery: Clear recovery indication
  - Long ops: Detailed status bar
  - Risk: Might create notification fatigue

### Chosen Direction

**Primary Approach: Direction 2 + Pattern B (Detailed Context + Smart Notifications)**

**Rationale:**

1. **Matches Emotional Goals**
   - Trust: Specific errors build confidence in tool
   - Clarity: Users understand what happened
   - Calm: Smart notifications preserve focus

2. **Balances Brevity & Clarity**
   - Error messages are specific (line number + reason)
   - But not verbose (single line)
   - Includes context for debugging

3. **Aligns with Product Differentiator**
   - Recovery path shows that fault-tolerance works
   - Users see concrete improvement
   - Transparent about what extension did

4. **Respects User Control**
   - Silent success (user controls when to invoke)
   - Clear errors (user can act)
   - Optional recovery indication (no spam)

### Design Rationale

**Error Message Format**

```
[Type] error at [location]: [specific cause]
Example: "XML syntax error at line 5: unclosed <tag> element"
```

**Why This Works:**

- **Type** (XML): User knows it's format-specific
- **Location** (line 5): User can jump to problem
- **Cause** (unclosed tag): User understands what to fix
- **Not generic** ("Format failed"): Actionable, not vague

**Notification Strategy**

1. **Success Path (80% of cases)**
   - Action: Silent (no notification)
   - Feedback: File changes visible in editor
   - Why: Respects focus, prevents fatigue

2. **Error Path (5% of cases)**
   - Action: Show error message
   - Format: Clear, specific, actionable
   - Duration: Persistent (user can dismiss)
   - Why: User needs to know about failures

3. **Recovery Path (15% of cases)**
   - Action: Visual feedback only (file improved)
   - Optional: Status bar indicator or brief info
   - Why: Shows recovery happened without interrupting

4. **Long Operations (>500ms)**
   - Action: Status bar indicator "Formatting..."
   - Why: Prevents user thinking tool is frozen

### Implementation Approach

**Command Activation**
```
User hotkey (Ctrl+Shift+Alt+B) or context menu
→ Execute format command
→ Show status bar indicator if >500ms
→ Apply changes to document
→ No notification on success
```

**Error Flow**
```
User invokes format
→ Error detected
→ Don't apply changes
→ Show specific error message
→ User can fix and retry
```

**Recovery Flow**
```
User invokes format on file with errors
→ Recovery pipeline improves structure
→ Changes applied
→ Optional status bar or brief message
→ Visual feedback from file improvement
```

### Visual Design Decisions

**Message Tone**
- Professional: "XML syntax error..."
- Not casual: No exclamation marks, emoji, or humor
- Specific: Always include line number and reason
- Actionable: User knows what to do next

**Color Application**
- Error messages: VS Code `errorForeground` (red)
- Recovery indication: Neutral color (no special color)
- Status bar: Standard VS Code colors

**Typography & Spacing**
- Monospace for line numbers: "line 5"
- Default UI font for message text
- Compact layout (no wasted space)
- Adequate line height for readability

### Trade-offs & Decisions

| Decision | Option A | Option B (Chosen) | Rationale |
|----------|----------|------------------|-----------|
| Error detail | Minimal | Detailed | Specific errors are more actionable |
| Success notification | Always notify | Silent | Prevents notification fatigue |
| Recovery feedback | Hidden | Visible | Shows product's differentiator |
| Long op indicator | None | Status bar | Prevents user anxiety about freezing |
| Suggestion inclusion | No | Optional (future) | Keeps MVP simple, add later if needed |

### Future Enhancements

- Format-specific error suggestions (JSON vs XML vs Python)
- Click-to-fix for common errors
- Recovery success indication with specific improvements
- Customizable notification preferences

## User Journey Flows

### Journey 1: Happy Path Format - Developer (Primary)

**Scenario:** Разработчик правит JSON файл и хочет форматировать перед коммитом.

**Flow:**

1. **Trigger/Entry Point**
   - Developer открыл файл `config.json` в VS Code
   - Сделал некие изменения (индентация некрасивая)
   - Хочет быстро привести в порядок

2. **Action: Invoke Format**
   - Developer нажимает горячую клавишу (Ctrl+Shift+Alt+B)
   - Или: Right-click → "Format Document"
   - Или: Command Palette → "Beautify Format: Format Document"

3. **System: Format Detection & Execution**
   - Extension определяет формат: JSON (по файл extension)
   - Загружает файл content
   - Применяет JSON formatter
   - Duration: <1 sec (typical case)

4. **System: Apply Changes**
   - Changes применяются к document
   - Editor отображает форматированный текст
   - File отмечен как modified (точка в tab'е)

5. **Feedback: Silent Success**
   - No notification shown (silent success)
   - Visual feedback достаточно (file в editor изменился)
   - Developer видит результат и продолжает работу

6. **User Actions: Completion**
   - Developer смотрит на форматированный код
   - Доволен результатом → сохраняет файл (Ctrl+S)
   - Или: если не нравится → Ctrl+Z для undo
   - Продолжает работу

**Success Criteria:**
- ✅ Форматирование выполнено за ≤2 сек
- ✅ Результат видно сразу в editor
- ✅ Нет отвлекающих notification'ов
- ✅ Код правильно отформатирован
- ✅ Undo работает если нужно

### Journey 2: Error Path - Unsupported Format

**Scenario:** Developer пытается форматировать файл неподдерживаемого формата.

**Flow:**

1. **Trigger/Entry Point**
   - Developer открыл файл `.xyz` (не поддерживаемый формат)
   - Нажимает горячую клавишу (Ctrl+Shift+Alt+B)

2. **System: Format Detection**
   - Extension пытается определить формат по extension
   - Не находит `.xyz` в списке поддерживаемых
   - Решает: Unsupported format error

3. **System: Error Handling**
   - Не меняет файл (safe by default)
   - Подготавливает error message:
     "Unsupported format: .xyz. Supported formats: json, xml, python, ..."

4. **Feedback: Clear Error Message**
   - Shows: `vscode.window.showErrorMessage()`
   - Message: "Unsupported format: .xyz. Supported formats: json, xml, python, ..."
   - Actionable: Developer знает что делать

5. **User Actions: Resolution**
   - Developer читает error message
   - Понимает что формат не поддерживается
   - Может: Переименовать файл, использовать другой инструмент, request feature
   - Продолжает работу

**Success Criteria:**
- ✅ Error message ясно и конкретно
- ✅ Файл не изменён (safe)
- ✅ Developer понимает что произошло
- ✅ Developer знает какие форматы поддерживаются
- ✅ Нет confusion или frustration

**Edge Cases Handled:**
- Unknown extension → clear message
- Misconfigured file → graceful error
- Read-only file → attempt + error if can't write

### Journey 3: Recovery Path - Dirty File with Errors

**Scenario:** Developer открыл "грязный" файл с синтаксическими ошибками и форматирует его.

**Flow:**

1. **Trigger/Entry Point**
   - Developer открыл файл с ошибками (например, пропущена запятая в JSON)
   - Файл может быть:
     - Partially written (incomplete)
     - Mechanically broken (missing delimiters)
     - Syntactically invalid (unclosed tags)

2. **Action: Invoke Format**
   - Developer нажимает горячую клавишу
   - Не ожидает успеха (обычно форматтеры отказывают)

3. **System: Format Detection**
   - Определяет формат (JSON, XML, etc.)
   - Проверяет синтаксис

4. **System: Format Attempt + Recovery**
   - Normal formatter fails (синтаксис invalid)
   - Включается recovery pipeline:
     - Attempt 1: Repair + format
     - Attempt 2: Partial format (улучшить структуру)
     - Attempt 3: Best effort (что-то лучше чем ничего)
   
5. **System: Apply Improved Result**
   - Recovery pipeline успешна
   - Applies улучшенный output
   - File in editor показывает better structure
   - Example: Добавлены missing quotes, fixed indentation

6. **Feedback: Visual Improvement**
   - Silent success (no notification)
   - OR: Optional brief status message (configurable)
     "Formatting applied despite syntax errors"
   - Visual evidence: File улучшена, errors меньше

7. **User Actions: Completion**
   - Developer видит что структура улучшена
   - Файл more readable несмотря на ошибки
   - Может теперь исправить errors вручную с linter'ом
   - Спасено время на ручную правку

**Success Criteria:**
- ✅ File улучшена несмотря на ошибки
- ✅ Never worse than input (или same, или better)
- ✅ Recovery очевидна (user видит improvement)
- ✅ Handles 85%+ broken files successfully
- ✅ User grateful for recovery assistance

**Edge Cases Handled:**
- Severe corruption → no change (safe)
- Partial content → best effort improvement
- Multiple format issues → cumulative recovery
- Very large file → recover what possible

### Journey 4: Long Operation - Status Indicator

**Scenario:** Developer форматирует очень большой файл (>5MB) и нужна feedback.

**Flow:**

1. **Trigger/Entry Point**
   - Developer открыл большой файл (или файл со сложным форматом)
   - Нажимает горячую клавишу

2. **System: Operation Start**
   - Starts formatting
   - Operation estimation: >500ms expected

3. **System: Show Status Indicator**
   - Shows status bar indicator: "Formatting..." with spinner
   - Example: "$(sparkles) Formatting JSON (1.2s)"
   - No modal dialog (non-blocking)

4. **User: Waits (Knows Tool is Working)**
   - Developer видит status indicator
   - Знает что tool работает (не frozen)
   - Может продолжить работу в других tabs
   - Не anxious about tool hanging

5. **System: Completion**
   - Formatting completes (let's say 2.5 sec)
   - Status bar indicator disappears
   - Changes applied to file
   - Silent success (no notification)

6. **User: Sees Result**
   - File formatted correctly
   - Большой файл still responsive
   - Developer satisfied with performance

**Success Criteria:**
- ✅ Status indicator appears for long operations (>500ms)
- ✅ Shows clear "Formatting..." message
- ✅ p95 ≤ 2 сек даже на большие файлы
- ✅ User knows tool is working
- ✅ UI remains responsive

### Journey Patterns & Common Elements

**Navigation Patterns**

1. **Command Invocation Pattern**
   - Three entry points: hotkey + menu + command palette
   - All lead to same format action
   - User chooses their preferred method

2. **Error Recovery Pattern**
   - Detect problem → show clear message → user can retry/fix
   - File never corrupted (safety first)
   - Message specific (not generic)

**Decision Points (System Decisions)**

1. **Format Support Check**
   - Supported? → proceed
   - Unsupported? → error + helpful message
   - Unknown? → attempt + graceful error if fails

2. **Syntax Validity Check**
   - Valid? → format normally
   - Invalid? → attempt recovery
   - Severely broken? → no change (safe)

3. **Operation Duration Check**
   - <500ms? → silent, no indicator
   - ≥500ms? → show status indicator
   - >5sec? → warn user or offer cancel

**Feedback Patterns**

1. **Success Feedback**
   - Primary: Visual (file changes in editor)
   - Secondary: Silent (no notification noise)
   - Status bar disappears when done

2. **Error Feedback**
   - Always explicit: `showErrorMessage()`
   - Specific: Include format type, line number if available
   - Actionable: User knows what to do

3. **Recovery Feedback**
   - Primary: Visual improvement visible
   - Secondary: Optional status message (can disable)
   - Transparent: User knows recovery happened

### Flow Optimization Principles

**1. Minimize Cognitive Load**
- No dialogs or confirmations in happy path
- No format options to choose (just format)
- Auto-detect everything possible

**2. Fast Path Optimization**
- p95 ≤ 2 sec is target (happy path)
- Cache format definitions
- Lazy load heavy dependencies

**3. Error Safety**
- Never modify file on error
- Always tell user what happened
- Suggest remediation if possible

**4. Respect User Context**
- Silent success (don't interrupt focus)
- Visible errors (always inform)
- Optional recovery indication (don't spam)

**5. Progressive Disclosure**
- Happy path: Just works (nothing to explain)
- Error path: Clear explanation + context
- Settings: Power users can customize if needed
