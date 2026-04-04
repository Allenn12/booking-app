import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PublicBookingController } from '../controllers/api/publicBookingController.js';
import AvailabilityService from '../services/AvailabilityService.js';
import Business from '../models/Business.js';
import { ERRORS } from '../utils/errors.js';

vi.mock('../models/Business.js');
vi.mock('../services/AvailabilityService.js');

const app = express();
app.use(express.json());
app.get('/api/v1/public/book/:slug/availability-range', PublicBookingController.getAvailabilityRange);
// Setup a simple error handler mapped to AppError
app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

describe('PublicBookingController.getAvailabilityRange', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return validation error if dates are missing', async () => {
        const res = await request(app).get('/api/v1/public/book/test-biz/availability-range?service_id=1');
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('Start and end dates are required');
    });

    it('should return availability range correctly if valid', async () => {
        Business.findBySlug.mockResolvedValue({ id: 1, allow_public_booking: 1 });
        AvailabilityService.getAvailabilityRange.mockResolvedValue({
            '2026-03-27': true,
            '2026-03-28': false
        });

        const res = await request(app).get('/api/v1/public/book/test-biz/availability-range?start=2026-03-27&end=2026-03-28&service_id=1');
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.dates['2026-03-27']).toBe(true);
        expect(res.body.data.dates['2026-03-28']).toBe(false);
    });
});
