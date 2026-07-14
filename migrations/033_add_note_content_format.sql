ALTER TABLE notes ADD COLUMN content_format TEXT NOT NULL DEFAULT 'plain'
    CHECK (content_format IN ('plain', 'tiptap_json'));
