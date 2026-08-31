# Генеративный фильм «Рафли», 103 секунды, производственный сценарий

Дата: 31.08.2026. Решение основателя: демо делается видеогенеративными моделями, анимация допустима. Этот файл: полный конвейер от стиля до финального рендера. Тайминг и закадровый текст из VOICEOVER_RU.md, 13 блоков, менять нельзя, вся вместимость речи уже посчитана.

## Главное правило, одно

В генеративных кадрах нет ни одной буквы и ни одного интерфейса. Кириллицу и UI модели плавят, жюри техконкурса это видит мгновенно. Весь текст (титры, цифры, субтитры) кладётся поверх на монтаже настоящей типографикой. Смысл сцены несут закадровый голос и субтитры, картинка несёт метафору. На буткемпе в декабре продукт показывается вживую, фильм это заявленный «как это работает» explainer, а не скринкаст, здесь нет подмены.

## Арт-дирекция, стиль-библия

Один стиль на все 13 сцен, иначе фильм рассыпается на клипы. Рекомендация: мягкий стилизованный 3D, «игрушечный магазин» (soft 3D, clay/toy render). Причины: генеративные модели держат этот стиль стабильнее фотореализма и намного стабильнее плоской 2D-векторки, еда в нём выглядит тёплой и аппетитной, никакой зловещей долины, и он сразу отличает ролик от шаблонных стоковых видео.

Суффикс стиля, добавлять в каждый промпт дословно:

```text
soft 3D render, stylized miniature toy world, clay-like materials, rounded edges, warm cinematic lighting, teal and warm-orange accent palette, shallow depth of field, high detail, smooth animation, no text, no letters, no labels, no logos, no UI, no watermark
```

Негативный промпт, тоже в каждый:

```text
text, letters, numbers, captions, signage, labels, UI, interface, screens with text, watermark, human faces close-up, extra fingers, glitch, low quality
```

Палитра для цветокора на монтаже: teal #16C79A, deep #0E8A6C, orange #FF8C42, coral #FF6B6B, ink #101418. В промпты хексы не писать, модели их игнорируют, задаём словами и правим грейдом.

## Конвейер, четыре шага

1. Кейфреймы. Сначала генерятся 13 стартовых стиллов в image-модели (Midjourney, Imagen, любая под рукой) одним батчем с общим суффиксом. Это дёшево и быстро, стиль утверждается по картинкам до того, как потрачена хоть одна видеогенерация.
2. Анимация. Каждый утверждённый стилл скармливается в Kling (image-to-video) с motion-промптом. I2v держит композицию и стиль, это главный инструмент консистентности. Sora 2 использовать для сцен 2, 8, 13, где нужна сложная связная динамика с текстового промпта. Seedance для быстрых пересъёмов и перебивок, если лимиты Kling кончились.
3. Отбор. На каждую сцену закладывать 3–5 генераций, брать лучшую. Реалистичный бюджет: 40–60 генераций на фильм.
4. Монтаж. CapCut или Resolve, 1920x1080, 25 fps. Поверх: субтитры (можно экспортом из film/index.html, там 15 готовых реплик), титул и финал типографикой, VO по VOICEOVER_RU.md, музыка минимал с нарастанием к сцене 8 и разрешением на 13.

## Покадровый план, 13 сцен

Хронометраж жёсткий, из SCENES-таблицы фильма. В столбце «Кадр» описание для стилла, в «Движении» motion-промпт для i2v. Все промпты на английском, модели так точнее.

### 1. Титул, 0:00–0:04, GFX поверх кадра сцены 13

Титул «Рафли» и знак R кладутся типографикой поверх расфокусированного финального кадра. Отдельная генерация не нужна.

### 2. Магазин вечером, 0:04–0:13, Sora 2

Кадр: миниатюрный продуктовый магазинчик в разрезе, как кукольный домик, полки с молочкой и хлебом, тёплый свет гаснет ряд за рядом, снаружи сумерки.

```text
A miniature cross-section grocery shop like a dollhouse, tiny shelves stocked with dairy, bread and produce, warm interior lights switching off row by row as dusk falls outside, slow gentle camera push-in
```

### 3. Незнание, 0:13–0:22, Kling i2v

Кадр: та же полка, товары уходят в серую дымку, над ними мягкие светящиеся знаки вопроса из тумана (объёмные, без шрифта, как облачка).

```text
Products on the miniature shelf fade into grey mist, soft glowing question-mark shaped wisps of fog float above them, camera slowly drifts sideways, melancholic cool light
```

### 4. Импорт каталога, 0:22–0:33, Kling i2v

Кадр: конвейерная лента, по ней едут маленькие коробочки-товары, механические манипуляторы аккуратно сортируют их по парам, одна коробочка останавливается на красной подсветке и ждёт.

```text
Tiny product boxes ride a conveyor belt, small mechanical arms gently pair and sort them into slots, one box stops under a soft red spotlight and waits, the belt pauses, calm rhythmic motion
```

### 5. Решение человека, 0:33–0:40, Kling i2v

Кадр: крупная стилизованная рука (варежка-клэй, без лица в кадре) выбирает одну из двух коробочек и ставит её в ячейку, ячейка подсвечивается тёплым светом.

```text
A stylized soft clay hand picks one of two identical product boxes and places it into a shelf slot, the slot glows warm teal, gentle confident motion, close-up on hands only
```

### 6. Пересчёт, 0:40–0:47, Kling i2v

Кадр: рука касается товаров на полке по одному, каждый тронутый загорается тёплым ободком, над полкой растёт столбик света.

```text
A clay hand touches miniature products on a shelf one by one, each touched item lights up with a warm glowing rim, a soft column of light above the shelf grows taller with each touch
```

### 7. Вахта просрочки, 0:47–0:56, Kling i2v

Кадр: четыре товара выстроены в ряд от красной подсветки к зелёной, невидимая сила мягко переставляет их по порядку срочности, первый плавно снимается с полки.

```text
Four miniature products lined up on a shelf, lit from urgent red to calm green, they gently reorder themselves by urgency, the most urgent one lifts softly off the shelf, smooth choreographed motion
```

### 8. Проверенный оффер, 0:56–1:03, Sora 2

Кадр: одна коробочка получает мягкую печать-отметку сверху (световой штамп без букв) и пересекает светящуюся границу из тени магазина на яркую публичную витрину.

```text
A single product box receives a glowing stamp of light from above, then glides across a luminous boundary line from a dim private storeroom side into a bright public storefront side, cinematic threshold moment
```

### 9. Покупатель, 1:03–1:12, Kling i2v

Кадр: миниатюрная витрина снаружи, к ней подходит стилизованная фигурка (со спины), тянется к подсвеченной коробочке, коробочка мягко перелетает в её сумку.

```text
A stylized miniature figure seen from behind approaches a glowing storefront shelf, reaches for the highlighted product box, the box floats gently into their shopping bag, warm evening light
```

### 10. Расхождение, 1:12–1:23, Kling i2v

Кадр: на полке три ячейки, в одной пусто, над пустой загорается мягкий красный купол-колпак, вокруг остальных товаров появляется защитная светящаяся рамка.

```text
Three shelf slots, one is empty, a soft red dome of light closes over the empty slot like a protective lock, a gentle glowing frame appears around the remaining products, tense but calm mood
```

### 11. Камера-свидетель, 1:23–1:30, Kling i2v

Кадр: маленькая купольная камера под потолком миниатюрного магазина, от неё расходится мягкий конус света, в конусе на полке один товар подсвечен оранжевым флажком света.

```text
A tiny dome security camera on the miniature shop ceiling casts a soft cone of light onto a shelf, one product inside the cone is highlighted with a small orange flag of light, everything else still, quiet watchful mood
```

### 12. Сводка владельца, 1:30–1:37, Kling i2v

Кадр: утро, стилизованная фигурка с чашкой смотрит на парящую над столом стопку из четырёх светящихся карточек-плиток (пустых, без текста), карточки по одной складываются в аккуратную стопку с мягким кивком.

```text
Morning light, a stylized figure with a tiny cup watches four glowing blank cards floating above a desk, the cards flip and settle into a neat stack one by one, satisfying calm rhythm
```

Цифры сводки (пересчитано 6, оффер 1, резерв 1, исключение закрыто 1) кладутся титрами поверх на монтаже.

### 13. Финал, 1:37–1:43, Sora 2

Кадр: утренний свет заливает идеально ровную полку миниатюрного магазина, все товары лицом, тёплое свечение, камера медленно отъезжает, магазинчик целиком.

```text
Morning sunlight floods a perfectly ordered miniature shop shelf, every product faced and aligned and softly glowing, slow dolly out revealing the whole cozy dollhouse shop, hopeful warm finale
```

Поверх: финальный тезис и логотип «Рафли» типографикой.

## Роли моделей, итог

| Модель | Сцены | Зачем |
|---|---|---|
| Image-модель (стиллы) | все | Стиль-лок до видеогенераций, дёшево |
| Kling 2.x i2v | 3, 4, 5, 6, 7, 9, 10, 11, 12 | Держит композицию стилла, консистентность стиля |
| Sora 2 | 2, 8, 13 | Сложная связная динамика, герой-моменты |
| Seedance | пересъёмы | Быстро и дёшево добить неудачные дубли |

## Стоп-правила

1. Кадр с буквами, лишними пальцами или ломаной геометрией: перегенерация, не ретушь.
2. Стиль поплыл между сценами: вернуться к шагу кейфреймов, не чинить на монтаже.
3. К дедлайну готовы не все сцены: собирать фильм из готовых генеративных плюс GFX-типографика на недостающие биты. Запасной полностью готовый вариант: текущий film/index.html, он записывается с экрана за один проход и уже честный.
4. Ничего из фильма не обещает того, чего продукт не делает: сверка каждой сцены с VOICEOVER_RU.md, а голос сверен с реальными фичами репозитория.

## Сборка, чек-лист

1. VO: начитка 13 блоков по таймкодам, 120 слов в минуту, старт блока строго на входе сцены.
2. Субтитры: обязательны, фильм должен читаться без звука.
3. Музыка: без вокала, нарастание к 8, разрешение на 13.
4. Цветокор: единый грейд, teal в светах, тёплые тени.
5. Экспорт: H.264, 1920x1080, 25 fps, 8–12 Mbps, стерео.
6. Контрольный просмотр: со звуком, без звука, и на телефоне.
