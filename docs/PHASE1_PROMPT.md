# Задача: Реализация SpecFlow — Фаза 1 (Core)

## Контекст

**Проект:** SpecFlow — spec-driven development system для Claude Code
**Директория:** ~/Projects/specflow-cc
**Спецификация:** docs/DESIGN.md
**Репозиторий:** https://github.com/ivkan/specflow-cc

## Референс

GSD (для заимствования паттернов): `/Users/koristuvac/Projects/dev/get-shit-done`

**Что изучить:**
- `bin/install.js` — механизм установки (уже адаптирован)
- `commands/*.md` — формат slash-команд Claude Code
- `agents/*.md` — формат агентов (subagent prompts)
- `hooks/statusline.js` — интеграция со statusline

**Важно:** НЕ копировать GSD, а адаптировать под философию SpecFlow:
- Audit-driven (не verification-driven)
- Lean process (меньше этапов)
- Human gate (предупреждения, не блокировки)

---

## Фаза 1: Core Commands

### Цель
Реализовать минимальный работающий workflow:
1. Инициализация проекта
2. Создание спецификации
3. Аудит спецификации
4. Просмотр статуса

### Команды для реализации

#### 1. `/sf init`
**Файл:** `commands/sf/init.md`

**Функционал:**
- Создать `.specflow/` директорию
- Проанализировать кодовую базу (стек, паттерны, структура)
- Создать `PROJECT.md` с обзором проекта
- Создать `STATE.md` с начальным состоянием
- Создать `config.json` с настройками по умолчанию

**Шаблоны нужны:**
- `templates/project.md`
- `templates/state.md`

#### 2. `/sf new [описание]`
**Файл:** `commands/sf/new.md`

**Функционал:**
- Принять описание задачи
- Задать критические вопросы (если нужно)
- Создать `SPEC-XXX.md` в `.specflow/specs/`
- Оценить сложность (small/medium/large)
- Обновить `STATE.md`

**Агент нужен:**
- `agents/spec-creator.md`

**Шаблон нужен:**
- `templates/spec.md`

#### 3. `/sf audit`
**Файл:** `commands/sf/audit.md`

**Функционал:**
- Прочитать активную спецификацию
- Запустить subagent для аудита (fresh context)
- Записать результат в спецификацию (История аудитов)
- Обновить статус в `STATE.md`
- Вывести результат с next step

**Агент нужен:**
- `agents/spec-auditor.md`

#### 4. `/sf status`
**Файл:** `commands/sf/status.md`

**Функционал:**
- Прочитать `STATE.md`
- Показать текущую позицию
- Показать следующий рекомендуемый шаг
- Показать очередь спецификаций

---

## Требования к реализации

### Формат команд (изучить GSD)
```markdown
# Command: /sf init

<purpose>
[Описание команды]
</purpose>

<workflow>
[Шаги выполнения]
</workflow>

<context>
@.specflow/STATE.md (if exists)
</context>

...
```

### Формат агентов (изучить GSD)
```markdown
# Agent: spec-creator

<role>
[Роль агента]
</role>

<instructions>
[Детальные инструкции]
</instructions>

<output>
[Формат вывода]
</output>
```

### Atomic commits
- Один коммит на каждую законченную единицу работы
- Формат: `feat(sf): add /sf init command`

### Тестирование
- После создания каждой команды — протестировать вручную
- Убедиться, что команда работает в Claude Code

---

## Порядок реализации

1. **Шаблоны** (`templates/`)
   - `project.md`
   - `state.md`
   - `spec.md`

2. **Агенты** (`agents/`)
   - `spec-creator.md`
   - `spec-auditor.md`

3. **Команды** (`commands/sf/`)
   - `init.md`
   - `new.md`
   - `audit.md`
   - `status.md`

4. **Тестирование**
   - Инициализировать тестовый проект
   - Создать спецификацию
   - Провести аудит
   - Проверить статус

---

## Критерии завершения Фазы 1

- [ ] `/sf init` создаёт `.specflow/` с PROJECT.md, STATE.md, config.json
- [ ] `/sf new "описание"` создаёт SPEC-XXX.md
- [ ] `/sf audit` проводит аудит и записывает результат
- [ ] `/sf status` показывает текущее состояние
- [ ] Все команды работают в Claude Code
- [ ] Код закоммичен и запушен

---

## После завершения

Сообщить о готовности к Фазе 2:
- `/sf revise`
- `/sf run`
- `/sf review`
- `/sf fix`
- `/sf done`
