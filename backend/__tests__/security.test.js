import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import bcrypt from 'bcrypt';
import Appointment from '../models/Appointment.js';
import Client from '../models/Client.js';
import UserBusiness from '../models/UserBusiness.js';

// Mock dependencies to avoid actual DB hits during tests
vi.mock('../models/User.js');
vi.mock('bcrypt');
vi.mock('../models/Appointment.js', () => ({
  default: {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    checkOverlap: vi.fn()
  }
}));
vi.mock('../models/Client.js', () => ({
  default: {
    getByBusinessAndId: vi.fn(),
    update: vi.fn(),
    updateNotes: vi.fn(),
    incrementStats: vi.fn(),
    getById: vi.fn()
  }
}));
vi.mock('../models/UserBusiness.js', () => ({
  default: {
    checkAccess: vi.fn()
  }
}));
vi.mock('express-mysql-session', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return class MockStore {
        constructor() {}
        on() {}
        once() {}
        emit() {}
      }
    })
  };
});

describe('Security Verification Tests (Phase 1)', () => {

  beforeAll(() => {
    app.set('trust proxy', 1); // Allow X-Forwarded-For mock IPs for rate-limit isolation
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    setTimeout(() => { process.exit(0); }, 500); // Allow logs to flush before killing process
  });

  describe('Test 3: User enumeration fix verification', () => {
    it('should return identical 401 responses for unknown email and wrong password', async () => {
      // Scenario A: Email not found
      User.findByEmail.mockResolvedValueOnce(null);

      const res1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'password123' });

      expect(res1.status).toBe(401);
      expect(res1.body.error).toBe('Email ili lozinka nisu ispravni');

      // Scenario B: Wrong password
      User.findByEmail.mockResolvedValueOnce({
        id: 1,
        email: 'known@example.com',
        password: 'hashedpassword'
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      const res2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'known@example.com', password: 'wrongpassword' });

      expect(res2.status).toBe(401);
      expect(res2.body.error).toBe('Email ili lozinka nisu ispravni');
      
      // The identical response assertion
      expect(res1.body).toEqual(res2.body);
    });
  });

  describe('Test 2: Rate limit verification', () => {
    it('should return 429 Too Many Requests after 5 rapid login attempts', async () => {
      // Rate limit is 5 per window. We simulate 6 requests.
      const responses = [];
      User.findByEmail.mockResolvedValue(null); // Just fail them all

      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '192.168.1.100') // Specific IP to test rate limiting
          .send({ email: 'spam@example.com', password: 'password' });
        responses.push(res);
      }

      // First 5 should be 401 (auth failed but not rate limited)
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(401);
      }

      // 6th should be 429
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toContain('Too many login attempts');
    });
  });

  describe('Test 1: IDOR fix verification', () => {
    it('should pass businessId from session to Appointment.findById to prevent IDOR', async () => {
      // Dynamic import to ensure it uses the mocked Appointment
      const { AppointmentController } = await import('../controllers/api/appointmentController.js');
      
      const mockReq = { 
        params: { id: '99' }, 
        session: { activeBusinessId: 2 } // Mocked session
      };
      
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      
      let nextError = null;
      const mockNext = (err) => { nextError = err; };

      Appointment.findById.mockResolvedValueOnce(undefined);

      await AppointmentController.getById(mockReq, mockRes, mockNext);
      
      // Assert the model was called with the businessId from session
      expect(Appointment.findById).toHaveBeenCalledWith('99', 2);
      
      // Assert it throws a 404 (handled by next)
      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(404);
    });
  });

  describe('Test 4: Client IDOR fix verification', () => {
    it('should explicitly pass businessId to Client.update to ensure tenant isolation', async () => {
      const { default: ClientController } = await import('../controllers/api/clientController.js');
      
      const mockReq = { 
        params: { id: '2', clientId: '99' }, 
        session: { userId: 5 }, 
        body: { name: 'IDOR Hacker' }
      };
      
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      
      let nextError = null;
      const mockNext = (err) => { nextError = err; };

      UserBusiness.checkAccess.mockResolvedValueOnce(true);
      Client.getByBusinessAndId.mockResolvedValue({ id: 99, phone: '123' });
      Client.update.mockResolvedValueOnce(true);

      await ClientController.updateClient(mockReq, mockRes, mockNext);
      
      expect(Client.update).toHaveBeenCalledWith('99', { name: 'IDOR Hacker' }, '2');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

});
