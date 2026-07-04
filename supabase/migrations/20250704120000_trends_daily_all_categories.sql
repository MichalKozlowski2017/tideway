-- Enable daily Google Trends for all PL category seeds (broader search phrases).
UPDATE sources
SET config = jsonb_set(config::jsonb, '{includeDaily}', '"true"')
WHERE type = 'google_trends'
  AND locale = 'pl'
  AND (config->>'includeDaily') IS DISTINCT FROM 'true';
