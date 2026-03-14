-- Migration: Add slug and allow_public_booking to business table
-- Run this against your MySQL database before using the public booking feature

ALTER TABLE business
  ADD COLUMN slug VARCHAR(100) NULL UNIQUE AFTER name,
  ADD COLUMN allow_public_booking TINYINT(1) NOT NULL DEFAULT 0 AFTER slug;

-- Generate slugs for all existing businesses
-- Uses lowercase name with spaces replaced by hyphens, plus the business id for uniqueness
UPDATE business
  SET slug = CONCAT(
    LOWER(REPLACE(REPLACE(REPLACE(name, ' ', '-'), '.', ''), ',', '')),
    '-',
    id
  )
  WHERE slug IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE business MODIFY COLUMN slug VARCHAR(100) NOT NULL;
