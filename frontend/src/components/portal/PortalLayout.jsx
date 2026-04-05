/**
 * PortalLayout — Shared Shell for Customer Portal Pages
 * =======================================================
 * Rebrand-ready: all colours from CSS custom properties.
 * No auth dependency — fully public.
 *
 * Usage:
 *   <PortalLayout businessName="My Salon">
 *     {content}
 *   </PortalLayout>
 */

import React from 'react';
import { CalendarDays } from 'lucide-react';

/**
 * Full-page loading skeleton (pulse animation).
 * Matches the portal card layout so there's no jarring layout shift.
 */
export function PortalSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50 p-4 sm:p-8">
            <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
                {/* Header */}
                <div className="h-8 bg-gray-200 rounded-xl w-1/3" />
                {/* Hero card */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-3">
                    <div className="h-5 bg-gray-100 rounded w-1/4" />
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
                {/* Appointment cards */}
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-2/3" />
                        <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Error screen with consistent portal branding.
 */
export function PortalError({ message, action }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-gray-100 shadow-lg">
                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                    <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Nešto je pošlo po krivu</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{message}</p>
                {action && (
                    <a
                        href={action.href}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                        {action.label}
                    </a>
                )}
            </div>
        </div>
    );
}

/**
 * Main portal layout shell.
 * Provides:
 * - Branded top bar with business name
 * - Centred content area (max-w-2xl — ideal reading width per UX guidelines)
 * - Sticky footer with "Powered by" branding (rebrand-removable)
 */
export default function PortalLayout({ businessName, children }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-pink-50 flex flex-col">
            {/* ── Top bar ── */}
            <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-[var(--color-primary)]" strokeWidth={2} />
                        <span className="font-bold text-gray-900 text-sm truncate max-w-[200px]">
                            {businessName || 'Klijentski portal'}
                        </span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider hidden sm:block">
                        Vaš portal
                    </span>
                </div>
            </header>

            {/* ── Main content ── */}
            <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 sm:py-10">
                {children}
            </main>

            {/* ── Footer ── */}
            <footer className="py-4 text-center text-xs text-gray-400">
                Sigurni portal · Bez lozinke
            </footer>
        </div>
    );
}
