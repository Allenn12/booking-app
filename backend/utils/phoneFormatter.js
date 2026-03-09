import { ERRORS } from './errors.js';

/**
 * Normalizes a raw phone string into E.164 standard format.
 * Defaults to Croatian prefix (+385) if missing.
 * 
 * Rules:
 * 1. Strip all non-numeric characters (except leading +)
 * 2. Replace leading "00" with "+"
 * 3. Replace leading "0" with "+385"
 * 4. Must start with "+" after normalization
 * 
 * @param {string} rawPhone 
 * @returns {string} E.164 Normalized Phone Number
 */
export const normalizePhone = (rawPhone) => {
    if (!rawPhone || typeof rawPhone !== 'string') {
        throw ERRORS.BAD_REQUEST('Invalid phone number format.');
    }

    // Capture leading + if it exists, strip all other non-numeric chars
    let cleaned = rawPhone.trim();
    const hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/\D/g, ''); // Remove all non-digits
    
    // If it had a mathematical +, prepend it back
    if (hasPlus) {
        cleaned = '+' + cleaned;
    }

    // Handle 00 -> +
    if (cleaned.startsWith('00')) {
        cleaned = '+' + cleaned.substring(2);
    }
    
    // Handle 0 -> +385 (Croatian default)
    if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
        cleaned = '+385' + cleaned.substring(1);
    }

    // If it consists of only digits without a +, slap a + on it 
    // Usually means they typed '38591234...' directly
    if (/^\d+$/.test(cleaned) && cleaned.startsWith('385')) {
        cleaned = '+' + cleaned;
    }

    // Final Validation: Must start with + and have at least 10 characters (including +)
    if (!cleaned.startsWith('+') || cleaned.length < 10) {
        throw ERRORS.BAD_REQUEST('Invalid phone number format.');
    }

    return cleaned;
};
