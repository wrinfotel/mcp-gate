# SPEC: MCP Conformance Gate — audience-play

**Дата:** 04.10.2026 · **Статус:** в работе · **Роль в портфеле:** ЗВЁЗДЫ И УЗНАВАЕМОСТЬ, не выручка.
Зачем вообще: чтобы crashscope (см. 2026-10-04-spec-crashscope.md) стартовал не с нуля — pinned-репо, имя автора на HN, бейджи в чужих README.

## Суть продукта
Обёртка над официальным раннером conformance-тестов MCP (`npx @modelcontextprotocol/conformance`) в трёх слоях:
1. **GitHub Action** — одна строка в workflow → прогон сценариев против MCP-сервера → отчёт в PR.
2. **Бейдж** — «N% MCP compliant» в README (shield.io).
3. **Scenario-coverage** — «прогнано X из Y сценариев requirement-сета». Сеты лежат в официальном репо: `requirements/2025-11-25.yaml`, `requirements/2026-07-28.yaml` (замороженные сеты для tier-оценок).

## Проверенные факты (04.10, источники живые)
| Факт | Значение |
|---|---|
| `modelcontextprotocol/conformance` | 128★, 126 открытых issue, push 01.10, версия 0.2.0-alpha.12, создан 2025-07-10 |
| issue #451 | «Expose expected-vs-emitted check coverage per scenario» — открыт, 5 комм, **0 реакций**, обновлён 02.10 |
| PR от 29.09 | «stop two scored scenarios going green on a server that rejects everything» — **официальное репо уже латает coverage-gap** |
| SEP-2484 | **Final с 27.03.2026**: conformance-тесты обязательны для Final-статуса SEP (процесс опубликован) |
| SEP-1730 | Tier 1 = 100% pass, Tier 2 = 80%; бейджи упомянуты в самом SEP («90% MCP Compliant») |
| Tier-оценки реально идут | Rust SDK повышен до Tier 1 (30/30→67/67 против пинов alpha.10→alpha.11), Go SDK — issue #3220 |
| Экосистема | 10 000+ MCP-серверов в проде, SDK ~97M загрузок/мес, java-sdk 3 718★, inspector 11 010★ |

## Конкуренты
| Кто | ★ | Статус |
|---|---|---|
| Официальный раннер | 128 | Живой, быстрый. **Мы — слой НАД ним, не конкурент** |
| `shriramkv/mcp-conformance-kit` | 23 | Создан и брошен в один день 20.07.2026 — попытка умерла (прецедент: соло не вытянул) |
| `mcp-use/mcp-conformance-action` | 4 | Живой, крошечный |
| `SamMorrowDrums/mcp-server-diff` | 9 | Смежный, диффы серверов |

## Позиционирование и GTM
- Не конкурировать с официальным раннером — витрина: Action в Marketplace, бейджи, coverage-отчёты.
- Вирусная петля: каждый бейдж в чужом README = реклама (как codecov).
- Каналы: Show HN, r/mcp, dev.to. Аудитория java-sdk (3 718★) — мост к crashscope.
- Монетизация НЕ цель. $19/мес из ранних оценок — спекуляция агента, НЕ подтверждена ничем.

## v0.1 (цель: ~неделя вечерами)
1. Action: вход — URL/команда сервера; выход — summary в PR + машиночитаемый результат.
2. Бейдж: shield.io (static или JSON-endpoint — решить агенту).
3. Scenario-coverage: парс `requirements/*.yaml` + результат прогона → «14/22».

## Границы (не делать)
- **НЕ тянуть второй режим `stdioharden` до выхода crashscope** — легко закопаться.
- НЕ строить check-level coverage (полное решение #451) в v0.1 — это недели; только если проект зайдёт.
- НЕ гнаться за официальным репо в глубине — гонку не выиграть, для audience-play это и не нужно.

## Риски
- Официальное репо закрывает coverage-gap сам (уже началось: PR 29.09). Митигация: ставка короткая (~неделя-месяц), это audience-play.
- #451 с 0 реакций — спрос тихий; звёзды должен приносить бейдж, не боль.
- Платящих мало (SDK-мейнтейнеры, оценка раз в полгода) — принято как данность.

## Открытые вопросы агенту
- shield.io: static vs JSON-endpoint для бейджа с процентом.
- Пиннировать релиз раннера или следить за tip (Tier-оценки пиннуются — вероятно, так же).
- Название репо, свободное от mcp-* клаттера.

## Материалы
- `/root/idea-research/2026-10-04-MARKET-DECISION.md` — полный ресёрч дня + финальный вердикт
- `/root/idea-research/2026-10-04-pack-top3.md` — первичный скоринг (2.70–2.90 в разных раундах)
- https://github.com/modelcontextprotocol/conformance — README, SDK_INTEGRATION.md, requirements/
