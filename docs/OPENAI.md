# OpenAI (Tideway)

Tideway używa **GPT-4o mini** do generowania streszczeń, nagłówków SEO i tagów.

## 1. Utwórz klucz API

1. Wejdź na https://platform.openai.com/api-keys
2. Zaloguj się (lub załóż konto)
3. **Create new secret key** → nazwa np. `tideway`
4. Skopiuj klucz (`sk-...`) — pokazuje się tylko raz

## 2. Billing

GPT-4o mini wymaga aktywnego billingu (karta), ale koszt MVP to ~**5–8 USD/mies.**

Ustaw limit miesięczny: https://platform.openai.com/settings/organization/limits  
Rekomendacja na start: **10 USD/mies.**

## 3. Konfiguracja lokalna

W `.env.local`:

```env
OPENAI_API_KEY=sk-twoj-klucz
OPENAI_MODEL=gpt-4o-mini
```

Po zapisaniu zrestartuj dev server (`npm run dev`).

## 4. Test generowania

W bazie muszą być `raw_items` ze statusem `pending` (po cronie ingest).

```bash
curl -X POST http://localhost:3000/api/cron/generate \
  -H "Authorization: Bearer <CRON_SECRET z .env.local>"
```

Oczekiwana odpowiedź: `{"ok":true,"generated":10,"tokensUsed":...}`

## 5. Weryfikacja

- Strona główna: http://localhost:3000 — powinny pojawić się artykuły
- Supabase → `articles` — nowe rekordy
- `raw_items.status` zmienia się z `pending` na `processed`

## Vercel (prod)

Te same zmienne w **Settings → Environment Variables**:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcjonalnie)
