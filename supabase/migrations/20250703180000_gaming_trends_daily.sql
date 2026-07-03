-- Surface daily search spikes (game launches, challenges) for guide/quiz generation.
UPDATE sources
SET config = jsonb_set(config::jsonb, '{includeDaily}', '"true"')
WHERE type = 'google_trends'
  AND category = 'gaming'
  AND locale = 'pl';
