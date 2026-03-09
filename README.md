# Colorizer Fence Configurator

Небольшой конфигурируемый визуализатор забора. Основная логика живет в `assets/js/colorizer.js`, а почти все настройки и контент задаются через `colorizer_config.json`.

## Что умеет

- Показывает забор поверх фонового изображения дома
- Переключает `Текстуры`, `Наполнение`, `Цвет текстуры`, `Цвет металла`, `Вид`
- Поддерживает пресеты фонов и загрузку своего фото
- Умеет работать и через `http/https`, и напрямую через `file://`
- Позволяет скрывать секции и отдельные кнопки прямо из конфига

## Файлы

- `index.html` — страница
- `assets/css/colorizer.css` — стили
- `assets/js/colorizer.js` — логика конструктора
- `colorizer_config.json` — основной конфиг
- `colorizer_config.js` — встроенный fallback-конфиг для запуска через `file://`

## Запуск

### Через сервер

Предпочтительный режим. Достаточно открыть проект через любой локальный сервер.

### Напрямую через `file://`

Тоже работает, но есть нюанс: браузер не даст читать `colorizer_config.json` через `fetch`, поэтому используется `colorizer_config.js`.

Если менялся `colorizer_config.json`, для `file://` нужно пересобрать `colorizer_config.js`.

PowerShell:

```powershell
$json = Get-Content colorizer_config.json -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$encoded = [Convert]::ToBase64String($bytes)
$content = "// Local fallback for file:// launches. Generated from colorizer_config.json.`r`n(function () {`r`n    const encoded = '$encoded';`r`n    const bytes = Uint8Array.from(atob(encoded), function (char) { return char.charCodeAt(0); });`r`n    let jsonText = new TextDecoder('utf-8').decode(bytes);`r`n    if (jsonText.charCodeAt(0) === 0xFEFF) jsonText = jsonText.slice(1);`r`n    window.COLORIZER_CONFIG = JSON.parse(jsonText);`r`n})();`r`n"
Set-Content colorizer_config.js -Value $content -Encoding UTF8
```

После правок делай `Ctrl+F5`.

## Главные разделы конфига

### `assets`

Базовые ресурсы.

```json
"assets": {
  "defaultBackground": "assets/colorizer/backgrounds/new/modern-flat-roof-house-1.webp"
}
```

### `behavior`

Поведение по умолчанию.

```json
"behavior": {
  "defaultState": {
    "block": "gorc_deluxe_1",
    "type": "ranch_horizontal_1",
    "metal": "amber",
    "view": "long",
    "fillMetal": "gray"
  },
  "allowedViews": ["regular", "long", "long_v2", "long_v3"],
  "swatchFallbackColor": "#8d9398",
  "notices": {
    "noImage": "Нет изображения для этой комбинации.",
    "configLoadFailed": "Не удалось загрузить настройки конструктора."
  }
}
```

Примечания:

- `defaultState.fillMetal` задает цвет металла по умолчанию
- `allowedViews` ограничивает список кнопок вида
- если вид не входит в `allowedViews`, кнопка не появится даже при наличии подписи

### `labels`

Подписи интерфейса.

```json
"labels": {
  "sections": {
    "views": "",
    "blocks": "Текстуры",
    "types": "Наполнение",
    "metals": "Цвет текстуры",
    "fillMetals": "Цвет металла"
  },
  "views": {
    "regular": "",
    "long": "Длинный",
    "long_v2": "Длинный 2",
    "long_v3": "Длинный 3"
  }
}
```

Правила:

- пустая строка в `labels.sections.*` скрывает заголовок секции
- пустая строка в `labels.views.*` скрывает кнопку конкретного вида

### `ui`

Настройки порядка секций, подписей загрузки и разметки.

```json
"ui": {
  "sectionOrder": ["views", "blocks", "types", "metalColors"],
  "upload": {
    "emptyLabel": "Файл не выбран",
    "loadedLabel": "Загруженное фото"
  },
  "downloadButton": {
    "enabled": true,
    "label": "Скачать",
    "ariaLabel": "Скачать изображение"
  },
  "layout": {
    "preview": [...],
    "sections": [...]
  }
}
```

Ключи для `sectionOrder`:

- `views`
- `blocks`
- `types`
- `textureColors`
- `metalColors`

`ui.layout.preview` описывает DOM превью, а `ui.layout.sections` — список секций настроек. Разметка собирается в рантайме из JSON.

## Контент конструктора

### `dynamic.textures`

Список текстур. Каждая текстура — это объект с `id`, `label` и массивом `colors`.

Чтобы убрать текстуру из интерфейса, достаточно удалить ее объект из массива `dynamic.textures`.

### `dynamic.fills`

Наполнение для режимов:

- `withTexture`
- `withoutTexture`

Внутри каждого наполнения можно задавать:

- `regular`
- `long`
- `long_v2`
- `long_v3`
- `metalColors`

### `metalColors`

Настройки кнопок и визуала для `Цвет металла`.

Поддерживаемые поля:

- `id`
- `label`
- `color`
- `swatch`
- `texture`
- `regular`
- `long`
- `long_v2`
- `long_v3`

Смысл полей:

- `swatch` — цвет кружка на кнопке
- `color` — цвет для tint-наложения
- `texture` — текстура-наложение поверх слоя
- `regular/long/...` — подмена самого изображения слоя по виду

Пример:

```json
{
  "id": "gray",
  "label": "Серый",
  "color": "#FFFFFF",
  "swatch": "#8D9398",
  "regular": "assets/colorizer/textures/metal/z/ranch_horizontal_2.webp",
  "long": "assets/colorizer/textures/metal/z/ranch_horizontal_2_long.webp"
}
```

Если нужен просто серый кружок без текстурной миниатюры на кнопке, достаточно оставить `swatch`.

## Полезно помнить

- После изменения `colorizer_config.json` обновляй страницу через `Ctrl+F5`
- Для `file://` не забывай пересобирать `colorizer_config.js`
- Если у секции нет данных, она скрывается автоматически
