import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per `window`
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window`
  message: { success: false, error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 register requests per `window`
  message: { success: false, error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per `window`
  message: { success: false, error: 'Too many verification attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicBookingPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 bookings per `window`
  message: { success: false, error: 'Too many booking attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicBookingGetLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per `window`
  message: { success: false, error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Portal rate limiters ───────────────────────────────────────────────────
// These protect the customer portal (magic link) endpoints.

export const portalGetLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,   // 1 minute
  max: 30,                    // 30 requests per minute per IP (generous for shared IPs)
  message: { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const portalCancelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 cancel attempts per 15 minutes per IP
  message: { success: false, error: 'Too many cancellation attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const portalLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 3,                     // 3 lookup requests per 15 minutes per IP
  message: { success: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
