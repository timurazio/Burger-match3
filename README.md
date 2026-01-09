# Burger Match-3 (браузерная match-3)

Минимальная match-3 игра (6x6), работает как статический сайт: HTML + CSS + JS.

## Запуск локально
Самое надёжное — через локальный сервер:

- macOS/Linux: `python3 -m http.server 8000`
- Windows: `py -m http.server 8000`

Открыть: http://localhost:8000

## Как заменить графику (бургерная тема)
1) Положи PNG в `assets/`:
- burger.png
- fries.png
- cola.png
- brownie.png
- icecream.png
- nuggets.png
- roll.png
- sauce.png

Рекомендации: квадрат 128x128 или 256x256, прозрачный фон.

2) В `game.js` выставь:
`TILESET.useImages = true`

## Как поменять размер поля
В `game.js`:
`CFG.rows` и `CFG.cols`

## Публикация
### GitHub Pages
1) Создай репозиторий и залей туда файлы.
2) Settings → Pages → Deploy from a branch → main / root.
3) Получишь ссылку вида `https://<username>.github.io/<repo>/`

### Netlify (самое простое)
1) Перетащи папку проекта в Netlify (Deploy manually).
2) Получишь публичный URL.


## Бустеры
- **cola**: взрыв 3×3 (эффект брызг)
- **fries**: чистит линию (ряд) (эффект рассыпания картошки)


### Как создаются бустеры
- Собери **4** одинаковых подряд → создаётся **fries** (чистит ряд)
- Собери **5+** одинаковых подряд или **Т/Г-форму** → создаётся **cola** (взрыв 3×3)
