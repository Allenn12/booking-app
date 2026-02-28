import crypto from 'crypto';

export function hashVerificationToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}