# Copy Robota UI

Статичні сторінки (`index.html`, `archive-list.html`, `archive-detail.html`) працюють без зборки. Нижче — коротка пам'ятка, як переглянути їх локально та викласти в свій репозиторій на GitHub.

## Перегляд локально
1. Відкрийте термінал у корені проєкту.
2. Запустіть простий сервер: `python3 -m http.server 8000`.
3. Перейдіть у браузері на `http://localhost:8000/index.html` — звідти доступні посилання на архівні сторінки.

## Збереження в GitHub
1. Створіть репозиторій на GitHub (порожній, без README). 
2. Додайте віддалений репозиторій:
   ```bash
   git remote add origin git@github.com:<ваш-логін>/<repo>.git
   # або через HTTPS
   # git remote add origin https://github.com/<ваш-логін>/<repo>.git
   ```
3. Перевірте поточні зміни: `git status`.
4. За потреби зафіксуйте їх: `git add . && git commit -m "Initial site"`.
5. Відправте гілку на GitHub: `git push -u origin main` (або `master`, залежно від назви гілки).

Після цього сторінки будуть у вашому репозиторії. За бажання можна увімкнути GitHub Pages для публікації статичного сайту: Settings → Pages → Branch → оберіть `main` та папку `/`.
