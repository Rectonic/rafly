# Генеративный фильм «Рафли», 103 секунды, сценарий v2

Дата: 31.08.2026. Решение основателя: демо делается видеогенеративными моделями, планка «не к чему придраться». v2 убирает два главных риска v1: дефолтную AI-эстетику clay-мира и эпизодичную драматургию. Тайминг и закадровый текст из VOICEOVER_RU.md, 13 блоков, не меняются.

## Четыре решения v2

1. Герой-объект. Одна баночка йогурта проходит весь фильм от вечерней непосчитанной полки до утренней проданной. Каждая сцена это следующая глава её судьбы, стыки сцен по возможности match-cut по баночке. Фильм становится историей, не набором иллюстраций.
2. Место. Не абстрактный минимаркет, а ташкентский махалля-магазинчик: узорная кирпичная кладка, синяя керамика, деревянная резная дверь, ящики с гранатами и арбузами, лепёшки, чинара за окном. Локальная фактура снимает «стоковость» и попадает в жюри домашним узнаванием.
3. Свет как язык системы. Правило мира: что система знает, освещено тёплым, что не знает, тонет в синей тени. Граница света сдвигается от сцены к сцене, финал весь тёплый. Арка читается без слов.
4. Продукт в кадре через оверлеи. Генеративная модель никогда не рисует интерфейс. Реальные UI-карточки Рафли (дизайн из дека и демо) кладутся на монтаже поверх кадра как парящие панели у полки. Настоящая кириллица, настоящие строки продукта, ноль риска расплавленного текста.

## Герой-объект, каноническое описание

В каждый промпт дословно: `a small cream-colored yogurt cup with a teal lid`. Без этикетки, без букв. Если модель рисует этикетку, перегенерация.

## Стиль-библия v2

Суффикс в каждый промпт, дословно:

```text
handcrafted miniature diorama, stop-motion film look, Uzbek mahalla corner shop, patterned brickwork, blue ceramic tile accents, carved wood details, soft practical lighting, warm amber light against cool blue shadow, teal and warm-orange brand accents, shallow depth of field, filmic grain, no text, no letters, no numbers, no labels, no logos, no UI, no watermark, no human faces
```

Негативный промпт, дословно:

```text
text, letters, numbers, captions, signage, labels, logos, UI, interface, watermark, human faces close-up, extra fingers, deformed hands, glitch, low quality, plastic toy look, generic supermarket
```

«Handcrafted diorama, stop-motion» вместо «clay toy world»: читается как макетная съёмка и кукольный фильм, а не как типовой AI-рендер. «Filmic grain» склеивает генерации между собой.

## Покадровый план v2

Хронометраж из SCENES-таблицы film/index.html. GEN: генерация. OVERLAY: настоящая UI-карточка поверх на монтаже. GFX: типографика.

### 1. Титул, 0:00–0:04. GFX поверх кадра сцены 13

Логотип и «Рафли» поверх расфокусированного финального кадра. Отдельной генерации нет.

### 2. Вечер, магазин закрывается, 0:04–0:13. GEN Sora 2, 8 с

Баночка появляется в первой же сцене, на прилавке, неубранная.

```text
Evening falls on a handcrafted miniature diorama of an Uzbek mahalla corner shop, warm lamps glow inside over shelves of flatbread, melons and pomegranate crates, a small cream-colored yogurt cup with a teal lid sits forgotten on the counter edge, the shopkeeper's hand turns the door sign and the lights dim one by one to a low warm glow, silhouettes stay readable, slow gentle push-in toward the yogurt cup
```

### 3. Незнание, 0:13–0:22. GEN Kling i2v, 9 с

```text
The miniature shop interior sinks into cool blue shadow, shelves become dim silhouettes, cold mist drifts along the shelf line, only the small cream-colored yogurt cup with a teal lid catches a last thin edge of warm light before the blue takes it, slow drift sideways, melancholic quiet
```

OVERLAY в конце сцены: тонкая красная строка-плашка «Потеря не измерена» из GFX-слоя (реальная типографика).

### 4. Импорт каталога, 0:22–0:33. GEN Kling i2v, 11 с

```text
Inside the blue shadow a warm beam of light sweeps across the miniature shop shelves like a scanner, where the beam passes products emerge from darkness into warm amber light one by one, the small cream-colored yogurt cup with a teal lid emerges last and the beam pauses on it, gentle rhythmic motion
```

OVERLAY: над полкой паркуется настоящая карточка Рафли «Импорт CSV, строки на проверке» с кнопками, та же вёрстка, что в деке слайд 07. Пауза луча на баночке = «неоднозначное совпадение, система ждёт человека».

### 5. Решение человека, 0:33–0:40. GEN Kling i2v, 7 с

```text
A human hand in soft focus reaches into the miniature shop scene and gently straightens the small cream-colored yogurt cup with a teal lid on the shelf, as the fingers touch it the cup's shelf spot lights up warm teal, close-up, tactile, calm confidence
```

Живая рука в макетном мире: приём кукольных фильмов, подчёркивает «решает человек». OVERLAY: карточка выбора товара.

### 6. Пересчёт, 0:40–0:47. GEN Kling i2v, 7 с

```text
The hand touches miniature dairy products on the shelf one by one, each touched item lights up with a warm amber rim against the blue shadow, the small cream-colored yogurt cup with a teal lid glows brightest, a soft column of warm light grows above the shelf with each touch
```

OVERLAY: счётчик пересчёта из GFX (реальные цифры типографикой).

### 7. Вахта просрочки, 0:47–0:56. GEN Kling i2v, 9 с

```text
Four miniature dairy products stand in a row on the shelf lit in a gradient from urgent red to calm teal, an unseen force gently slides them into order of urgency, the most urgent one lifts softly off the shelf and floats forward, the small cream-colored yogurt cup with a teal lid stays second in line glowing amber
```

OVERLAY: плашки «Снять с полки, скидка 50, 30, 15 процентов» настоящей типографикой.

### 8. Проверенный оффер, 0:56–1:03. GEN Sora 2, 8 с

```text
The small cream-colored yogurt cup with a teal lid receives a soft stamp of warm light from above, then glides across a luminous boundary line from the dim blue private storeroom side of the miniature diorama into the bright warm public storefront side, cinematic threshold moment, no ribbon, no gift wrap
```

«No ribbon, no gift wrap» лечит бантик из пилота.

### 9. Покупатель, 1:03–1:12. GEN Kling i2v, 9 с

```text
Seen from behind, a miniature figure in a patterned skullcap approaches the warm storefront window of the mahalla shop at dusk, reaches for the glowing small cream-colored yogurt cup with a teal lid on the display shelf, the cup floats gently into a woven shopping bag, warm evening light
```

OVERLAY, усиленный: это главная витрина покупательской поверхности в фильме. Последовательно три настоящие buyer-карточки: лента офферов с ценой и скидкой, пин на карте с радиусом, бронь с кодом выдачи. Реальная вёрстка Rafly Market, покупательская сторона читается как продукт, не только как фигурка в кадре.

### 10. Расхождение, 1:12–1:23. GEN Kling i2v, 11 с

```text
On the miniature shelf three spots for dairy cups, one spot is empty, a soft dome of red light closes over the empty spot like a protective lock, a gentle glowing frame appears around the remaining products, the blue shadow presses in but the locked zone holds, tense quiet
```

OVERLAY: «Исключение открыто, резерв заблокирован, заметка обязательна».

### 11. Камера-свидетель, 1:23–1:30. GEN Kling i2v, 7 с

```text
A tiny dome security camera under the wooden ceiling of the miniature mahalla shop casts a soft cone of pale light onto the shelf, one product inside the cone is marked by a small floating orange flag of light, everything else motionless, watchful calm
```

### 12. Утренняя сводка, 1:30–1:37. GEN Kling i2v, 7 с

```text
Morning light through the shop window, a steaming piala of tea on the counter beside the shelf, four warm glowing blank cards float above the counter and settle into a neat stack one by one, cozy calm rhythm, the miniature mahalla shop waking up
```

Пиала вместо западной кружки. OVERLAY: реальный текст сводки владельца (моноширинный дайджест из продукта).

### 13. Финал, 1:37–1:43. GEN Sora 2, 8 с

```text
Morning sunlight floods the handcrafted miniature diorama of the Uzbek mahalla corner shop, every shelf ordered and glowing warm, flatbread, melons, pomegranates and dairy all faced and aligned, the small cream-colored yogurt cup with a teal lid stands front and center fully lit, a content miniature figure with a woven shopping bag walks away from the storefront while the shopkeeper's silhouette tidies shelves inside, slow dolly out revealing the whole shop with plane tree leaves at the window, hopeful warm finale
```

Обе стороны платформы в одном закрывающем кадре: владелец внутри при полном свете, покупатель снаружи с покупкой. GFX поверх: строка «Магазину контроль. Покупателю проверенный оффер.», затем финальный тезис и логотип.

## Конвейер

1. Кейфреймы: 12 стиллов FLUX по промптам v2 одним батчем, контакт-лист, утверждение стиля до видеогенераций.
2. Анимация: Kling i2v от утверждённых стиллов (сцены 3–7, 9–12), Sora 2 текстом (сцены 2, 8, 13). Черновики 720p, финалы 1080p или sora-2-pro.
3. Отбор: 3–5 генераций на сцену, бюджет 40–60 генераций.
4. Монтаж: CapCut или Resolve, 1920x1080, 25 fps. Дорожки: видео, OVERLAY-карточки (экспорт вёрстки продукта с альфой или скрин-фрагменты дека), GFX-титры, VO по VOICEOVER_RU.md, музыка (минимал, нарастание к 8, разрешение на 13), субтитры обязательны.
5. Цветокор: единый грейд, тёплый янтарь против синей тени, teal-акценты.

## Правила консистентности

1. Описание баночки дословно одинаковое в каждом промпте.
2. Стиль-суффикс дословно одинаковый в каждом промпте.
3. Стыки сцен: баночка в последней трети кадра уходящей сцены и в первой трети входящей, монтаж по ней.
4. Кадр с этикеткой, буквами, лишними пальцами или сломанной геометрией: перегенерация, не ретушь.
5. Стиль поплыл: назад к кейфреймам, не чинить на монтаже.

## Стоп-правила

1. К дедлайну готовы не все сцены: собирать из готовых плюс GFX-типографика на недостающие биты. Полностью готовый запасной вариант: film/index.html, записывается за один проход.
2. Ничего в фильме не обещает того, чего продукт не делает. OVERLAY-карточки только с реальными строками интерфейса из репозитория.
3. Фильм и живое демо на буткемпе показывают один продукт.
