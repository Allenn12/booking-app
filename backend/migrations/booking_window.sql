ALTER TABLE business
ADD COLUMN booking_window_days INT NOT NULL DEFAULT 30 AFTER allow_public_booking;
