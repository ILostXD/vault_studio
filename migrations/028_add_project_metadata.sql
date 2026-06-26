-- Migration: Add project metadata fields
ALTER TABLE projects ADD COLUMN estimated_release_date TEXT;
ALTER TABLE projects ADD COLUMN completion_percentage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN rating INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN color_palette TEXT;
ALTER TABLE projects ADD COLUMN streaming_checklist TEXT;
ALTER TABLE projects ADD COLUMN pre_save_url TEXT;
ALTER TABLE projects ADD COLUMN distributor_notes TEXT;
