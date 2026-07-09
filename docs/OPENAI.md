# AI (Tideway)

Generowanie artykułów i quality gate używają jednego przełącznika **`AI_PROVIDER`**.

## Szybki switch

| Sytuacja | `.env.local` / Vercel |
|---|---|
| PC w domu, Ollama działa | `AI_PROVIDER=local` |
| Wyjazd, GTA, laptop wyłączony | `AI_PROVIDER=openai` (domyślnie) |

Po zmianie zrestartuj dev server albo zrób redeploy na Vercel.

---

## OpenAI (domyślnie)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-twoj-klucz
OPENAI_MODEL=gpt-4o-mini
```

### Klucz API

1. https://platform.openai.com/api-keys
2. **Create new secret key** → np. `tideway`
3. Billing + limit miesięczny (~10 USD na start): https://platform.openai.com/settings/organization/limits

---

## Lokalny model (Ollama)

Na PC z GPU (np. RTX 5080):

```bash
# instalacja: https://ollama.com
ollama pull qwen2.5:32b-instruct-q4_K_M
ollama serve   # zwykle działa w tle po instalacji
```

W `.env.local`:

```env
AI_PROVIDER=local
LOCAL_AI_BASE_URL=http://localhost:11434/v1
LOCAL_AI_API_KEY=ollama
LOCAL_AI_MODEL=qwen2.5:32b-instruct-q4_K_M
```

**Vercel prod** nie widzi Twojego `localhost`. Na produkcji zostaw `AI_PROVIDER=openai`, chyba że wystawisz Ollama przez Tailscale/Cloudflare Tunnel i ustawisz `LOCAL_AI_BASE_URL` na publiczny URL tunelu.

---

## Test generowania

W bazie muszą być `raw_items` ze statusem `pending`.

```bash
curl -X POST http://localhost:3000/api/cron/generate \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Odpowiedź zawiera aktywny provider:

```json
{
  "ok": true,
  "generated": 4,
  "tokensUsed": 12000,
  "aiProvider": "local",
  "aiModel": "qwen2.5:32b-instruct-q4_K_M"
}
```

## Vercel (prod)

**Generowanie AI wyłączone na Vercel** — artykuły lecą z lokalnego PC (Ollama). Na Vercel zostają tylko crony: **ingest** + **cleanup**.

W **Settings → Environment Variables** (Production):

```env
CRON_AI_ENABLED=false
```

To blokuje `/api/cron/generate`, `daily-rollup` i `weekly-rollup` nawet przy ręcznym wywołaniu. Crone tych endpointów są usunięte z `vercel.json`.

| Zmienna | Vercel prod | Lokalnie (Mac → PC) |
|---|---|---|
| `CRON_AI_ENABLED` | `false` | nie ustawiaj (domyślnie włączone) |
| `AI_PROVIDER` | — | `local` |
| `LOCAL_AI_BASE_URL` | — | `http://192.168.0.200:11434/v1` |
| `OPENAI_API_KEY` | opcjonalnie (na wyjazd) | zostaw na przełącznik |

**Przy wyjeździe** (bez PC): ustaw na Vercel `CRON_AI_ENABLED=true`, przywróć crony w `vercel.json` albo odpalaj `run-generate.mts` z `AI_PROVIDER=openai`.

**Settings → Environment Variables** (pozostałe):

| Zmienna | OpenAI | Local (tylko z tunelem) |
|---|---|---|
| `AI_PROVIDER` | `openai` | `local` |
| `OPENAI_API_KEY` | wymagane | — |
| `OPENAI_MODEL` | opcjonalnie | — |
| `LOCAL_AI_BASE_URL` | — | URL tunelu |
| `LOCAL_AI_MODEL` | — | opcjonalnie |
