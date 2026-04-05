/**
 * PortalLookupPage — /portal/lookup
 * ===================================
 * "Pošalji mi link" page.
 * 
 * UX principles:
 * - ALWAYS shows the same success message (prevents phone enumeration)
 * - Single focus: phone number input
 * - No distractions — clean, calm design
 * - Accessible: labelled input, error/success roles
 *
 * Rebrand note: purely CSS vars + Tailwind. Zero hardcoded hex colours.
 */

import React, { useState, useCallback, useId } from 'react';
import { Helmet } from 'react-helmet-async';
import { Phone, Send, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import PortalLayout from '../../components/portal/PortalLayout';

// ── Loading spinner (stable/static JSX) ──────────────────────────────────────
const Spinner = () => (
    <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
);

// ── Croatian phone input formatter ────────────────────────────────────────────
// Allows: +385..., 0...
function isValidPhone(value) {
    const stripped = value.replace(/[\s\-()]/g, '');
    return /^(\+?\d{8,15})$/.test(stripped);
}

// ──────────────────────────────────────────────────────────────────────────────
export default function PortalLookupPage() {
    const phoneInputId = useId();

    const [phone,    setPhone]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const [sent,     setSent]     = useState(false);
    const [apiError, setApiError] = useState(null);
    const [touched,  setTouched]  = useState(false);

    const isPhoneValid = isValidPhone(phone);
    const showPhoneError = touched && phone.length > 0 && !isPhoneValid;

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setTouched(true);
        if (!isPhoneValid) return;

        setLoading(true);
        setApiError(null);
        try {
            await api.lookupPortalLink(phone.trim());
            // Always show success — server never reveals if phone exists
            setSent(true);
        } catch (err) {
            // Even on network error, show success to prevent enumeration
            // Only show error if it's a rate limit (to inform user)
            if (err.status === 429) {
                setApiError('Previše pokušaja. Pričekajte nekoliko minuta i pokušajte ponovo.');
            } else {
                setSent(true); // Always show success for all other errors
            }
        } finally {
            setLoading(false);
        }
    }, [phone, isPhoneValid]);

    const handlePhoneChange = useCallback((e) => {
        setPhone(e.target.value);
    }, []);

    const handleReset = useCallback(() => {
        setPhone('');
        setSent(false);
        setApiError(null);
        setTouched(false);
    }, []);

    return (
        <>
            <Helmet>
                <title>Pošalji mi portal link</title>
                <meta name="description" content="Unesite vaš broj telefona i pošaljemo vam link za klijentski portal." />
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>

            <PortalLayout businessName="Klijentski portal">
                <div className="max-w-md mx-auto">
                    {/* Back link */}
                    <Link
                        to="/"  
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors duration-150 mb-6 cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                        Natrag
                    </Link>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Gradient top strip */}
                        <div className="h-1.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-cta)]" />

                        <div className="p-6 sm:p-8">
                            {/* ── Success state ── */}
                            {sent ? (
                                <div className="text-center py-4">
                                    <div
                                        role="status"
                                        aria-live="polite"
                                        className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5"
                                    >
                                        <CheckCircle className="w-9 h-9 text-green-500" strokeWidth={1.5} />
                                    </div>
                                    <h1 className="text-xl font-bold text-gray-900 mb-2">Provjerite e-mail!</h1>
                                    <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto mb-6">
                                        Ako je vaš broj registriran u sustavu, poslali smo link na vašu e-mail adresu. Provjerite i spam mapu.
                                    </p>
                                    <button
                                        onClick={handleReset}
                                        className="text-sm text-[var(--color-primary)] hover:underline font-medium cursor-pointer"
                                    >
                                        Pokušaj s drugim brojem
                                    </button>
                                </div>
                            ) : (
                                /* ── Form state ── */
                                <>
                                    {/* Icon + heading */}
                                    <div className="text-center mb-6">
                                        <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-4">
                                            <Phone className="w-6 h-6 text-[var(--color-primary)]" strokeWidth={2} />
                                        </div>
                                        <h1 className="text-xl font-bold text-gray-900 mb-1">Pronađi moj portal</h1>
                                        <p className="text-sm text-gray-500 leading-relaxed">
                                            Unesite broj telefona kojim ste se registrirali i pošaljemo link na vaš e-mail.
                                        </p>
                                    </div>

                                    {/* Api-level error (rate limit only) */}
                                    {apiError && (
                                        <div
                                            role="alert"
                                            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700"
                                        >
                                            {apiError}
                                        </div>
                                    )}

                                    {/* Form */}
                                    <form onSubmit={handleSubmit} noValidate>
                                        <div className="mb-4">
                                            <label
                                                htmlFor={phoneInputId}
                                                className="block text-sm font-medium text-gray-700 mb-1.5"
                                            >
                                                Broj telefona
                                            </label>
                                            <input
                                                id={phoneInputId}
                                                type="tel"
                                                autoComplete="tel"
                                                inputMode="tel"
                                                placeholder="+385 91 234 5678"
                                                value={phone}
                                                onChange={handlePhoneChange}
                                                onBlur={() => setTouched(true)}
                                                aria-invalid={showPhoneError}
                                                aria-describedby={showPhoneError ? `${phoneInputId}-error` : undefined}
                                                className={[
                                                    'w-full px-4 py-3 rounded-xl border text-gray-900 text-base',
                                                    'placeholder:text-gray-400 outline-none transition-all duration-150',
                                                    'focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]',
                                                    showPhoneError
                                                        ? 'border-red-300 bg-red-50'
                                                        : 'border-gray-200 bg-white hover:border-gray-300',
                                                ].join(' ')}
                                            />
                                            {showPhoneError && (
                                                <p
                                                    id={`${phoneInputId}-error`}
                                                    role="alert"
                                                    className="mt-1.5 text-xs text-red-600 flex items-center gap-1"
                                                >
                                                    Unesite ispravan broj telefona (npr. +385 91 234 5678)
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className={[
                                                'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
                                                'bg-[var(--color-primary)] text-white font-semibold text-sm',
                                                'hover:opacity-90 transition-opacity duration-150',
                                                'disabled:opacity-60 disabled:cursor-not-allowed',
                                                'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:ring-offset-2',
                                                'cursor-pointer',
                                            ].join(' ')}
                                        >
                                            {loading ? (
                                                <><Spinner /> Šalje se...</>
                                            ) : (
                                                <><Send className="w-4 h-4" strokeWidth={2} /> Pošalji mi link</>
                                            )}
                                        </button>
                                    </form>

                                    {/* Privacy note */}
                                    <p className="mt-6 text-xs text-center text-gray-400 leading-relaxed max-w-xs mx-auto">
                                        Vaš telefonski broj koristimo isključivo za identifikaciju. Ne šaljemo spam.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </PortalLayout>
        </>
    );
}
