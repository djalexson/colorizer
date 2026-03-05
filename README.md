# Колорайзер забора

Короче, это мини-конструктор забора: тыкаешь текстуры, наполнение, цвета, вид, и сразу смотришь, как это выглядит на фотке дома.

## Что тут есть

- Загрузка своего фото + пресеты фонов
- Выбор:
  - `Вид`
  - `Текстуры`
  - `Наполнение`
  - `Цвет текстуры`
  - `Цвет металла`
- Кнопка скачивания результата прямо с превью (PNG)
- Почти всё рулится через `colorizer_config.json`

## Быстрый старт

Никакой магии:

1. Открываешь `index.html` в браузере
2. Меняешь `colorizer_config.json`
3. Жмёшь `Ctrl+F5`, чтобы не словить кэш-обман

## Структура проекта

- `index.html` — разметка
- `assets/css/colorizer.css` — стили
- `assets/js/colorizer.js` — вся логика
- `colorizer_config.json` — главный пульт управления

## Конфиг, который реально важен

### 1) Порядок блоков в настройках

```json
"ui": {
  "sectionOrder": ["views", "blocks", "textureColors", "types", "metalColors"]
}
```

Доступные ключи:

- `views`
- `blocks`
- `types`
- `textureColors`
- `metalColors`

Если ключ не указал, блок будет скрыт.

### 2) Кнопка скачивания (вкл/выкл + название)

```json
"ui": {
  "downloadButton": {
    "enabled": true,
    "label": "Скачать",
    "ariaLabel": "Скачать изображение"
  }
}
```

### 3) Текстуры блока (`dynamic.textures`)

Теперь это **массив**, а не древний объект:

```json
"textures": [
  {
    "id": "gorc_deluxe",
    "label": "Горц Делюкс",
    "colors": [
      {
        "id": "amber",
        "label": "Янтарный",
        "regular": "assets/.../very-rough.webp",
        "long": "assets/.../very-rough_long.webp"
      }
    ]
  }
]
```

### 4) Цвет металла для наполнения (`metalColors`) самый сок

`metalColors` можно задавать у каждого типа наполнения, например в:

- `dynamic.fills.withTexture.ranch_horizontal_2.metalColors`

Поддерживается:

- `color` / `swatch` — обычный цвет
- `texture` — **наложение** (паттерн поверх)
- `regular` / `long` / `long_v2` / `long_v3` — **замена основной картинки слоя** по виду

Пример:

```json
{
  "id": "ranch80_texture",
  "label": "Ранчо 80 текстура",
  "color": "#8d9398",
  "texture": "assets/colorizer/textures/metal/z/block-cappuccino-rancho-gray.png",
  "regular": "assets/colorizer/textures/metal/z/block-cappuccino-rancho-gray.png",
  "long": "assets/colorizer/textures/metal/z/block-cappuccino-rancho-gray.png",
  "swatch": "#8d9398"
}
```

Кратко:

- `regular/long` -> чем **заменяем** базовую картинку
- `texture` -> что **накладываем** сверху

### 5) Скрытие блоков, если данных нет

Логика уже встроена:

- если у текстуры нет цветов -> `Цвет текстуры` прячется
- если нет `metalColors` (и нет `defaultFillMetalColors`) -> `Цвет металла` прячется

## Полезный совет

Если "вроде поменял, а на экране старое" это почти всегда кэш.  
Просто `Ctrl+F5`, и жизнь снова норм.

