# Reddit API setup

Reddit blocks unauthenticated requests (403). Tideway uses **OAuth2** via `oauth.reddit.com`.

## 1. Create a Reddit app

1. Log in to Reddit → [App preferences](https://www.reddit.com/prefs/apps)
2. **Create another app…**
3. Type: **script** (easiest for server cron)
4. Name: `tideway`
5. Redirect URI: `http://localhost` (required but unused for script)
6. Copy **client ID** (under app name) and **secret**

## 2. Bot account (recommended)

Create a dedicated Reddit account for the bot (do not use your main account password in `.env`).

## 3. Environment variables

Add to `.env.local`:

```env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
REDDIT_USERNAME=your_bot_username
REDDIT_PASSWORD=your_bot_password
REDDIT_USER_AGENT=web:tideway:v1.0.0 (by /u/your_bot_username)
```

`REDDIT_USER_AGENT` must follow Reddit’s format: `platform:appid:version (by /u/username)`.

Alternative: use `REDDIT_REFRESH_TOKEN` instead of username/password (web app OAuth flow).

## 4. Test ingest

```bash
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Check Supabase → `raw_items` with Reddit sources should have rich descriptions (score, comments, post body).

## 5. Rate limits

- ~60 requests/minute for OAuth
- Ingest runs every 30 min — well within limits

## Subreddits (seed)

| Category | Subreddit |
|----------|-----------|
| technology | r/technology |
| gaming | r/gaming |
| ai | r/artificial |
