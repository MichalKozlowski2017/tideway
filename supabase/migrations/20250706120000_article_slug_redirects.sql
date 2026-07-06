CREATE TABLE article_slug_redirects (
  locale text NOT NULL DEFAULT 'pl',
  from_slug text NOT NULL,
  to_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, from_slug)
);

CREATE INDEX article_slug_redirects_to_slug_idx
  ON article_slug_redirects (locale, to_slug);

ALTER TABLE article_slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access article_slug_redirects"
  ON article_slug_redirects FOR ALL
  USING (true)
  WITH CHECK (true);
