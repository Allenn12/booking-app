/**
 * CustomerPortalPage — /portal/:token
 * =====================================
 * Public page. No auth. Identified only by the portal token in the URL.
 *
 * Architecture:
 *  - usePortal hook owns all data/state
 *  - PortalLayout provides branded shell
 *  - PortalAppointmentCard handles per-appointment UI
 *  - This page is a thin orchestration layer (container pattern)
 *
 * Rebrand note: all colours are either CSS vars or Tailwind utility classes.
 * To change the palette, update index.css variables — no JSX changes needed.
 */

import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MapPin, Phone, Mail, CalendarCheck, Clock, ChevronRight } from 'lucide-react';
import { usePortal } from '../../hooks/usePortal';
import PortalLayout, { PortalSkeleton, PortalError } from '../../components/portal/PortalLayout';
import PortalAppointmentCard from '../../components/portal/PortalAppointmentCard';

// ── Section heading — extracted as stable static component ────────────────────
function SectionHeading({ icon: Icon, title, count }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon className="w-4 h-4 text-[var(--color-primary)]" strokeWidth={2} />
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">{title}</h2>
            {count > 0 && (
                <span className="text-xs font-semibold bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                    {count}
                </span>
            )}
        </div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <Icon className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-gray-400">{message}</p>
        </div>
    );
}

// ── Business info card ────────────────────────────────────────────────────────
function BusinessCard({ customer, business }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            {/* Gradient banner */}
            <div className="h-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-cta)]" />
            <div className="p-5">
                {/* Customer greeting */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Vaš portal</p>
                <h1 className="text-xl font-bold text-gray-900 mb-0.5">{customer.name}</h1>
                <p className="text-sm text-gray-500 mb-4">{customer.phone}</p>

                {/* Business info */}
                <div className="border-t border-gray-50 pt-4 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Salon</p>
                    <p className="font-semibold text-gray-800">{business.name}</p>
                    {business.address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                            {business.address}{business.city ? `, ${business.city}` : ''}
                        </div>
                    )}
                    {business.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                            {business.phone}
                        </div>
                    )}
                    {business.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                            {business.email}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Cancel success banner ─────────────────────────────────────────────────────
function CancelSuccessBanner({ onDismiss }) {
    // Auto-dismiss after 4 seconds
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    return (
        <div
            role="status"
            aria-live="polite"
            className="mb-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300"
        >
            <CalendarCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div>
                <p className="text-sm font-semibold text-green-800">Termin je otkazan</p>
                <p className="text-xs text-green-600 mt-0.5">Dobit ćete potvrdu na e-mail ako ste ga dostavili.</p>
            </div>
        </div>
    );
}

// ── Cancel error banner ───────────────────────────────────────────────────────
function CancelErrorBanner({ message, onDismiss }) {
    return (
        <div
            role="alert"
            className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start justify-between gap-3 animate-in slide-in-from-top-2 duration-300"
        >
            <p className="text-sm text-red-700">{message}</p>
            <button
                onClick={onDismiss}
                aria-label="Zatvori"
                className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 cursor-pointer"
            >
                ×
            </button>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CustomerPortalPage() {
    const { token } = useParams();
    const {
        loading,
        error,
        customer,
        business,
        upcoming,
        past,
        cancelingId,
        cancelDone,
        cancelError,
        cancelAppointment,
        clearCancelDone,
        clearCancelError,
    } = usePortal(token);

    // ── States: loading ──
    if (loading) return <PortalSkeleton />;

    // ── States: hard error (token invalid, revoked, etc.) ──
    if (error) {
        return (
            <PortalError
                message={error}
                action={{ href: '/portal/lookup', label: 'Pošalji mi link ponovo' }}
            />
        );
    }

    const businessTitle = business?.name || 'Portal';

    return (
        <>
            <Helmet>
                <title>Vaši termini · {businessTitle}</title>
                <meta name="description" content={`Upravljajte svojim terminima u salonu ${businessTitle}.`} />
                {/* Prevent indexing — portal is private */}
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>

            <PortalLayout businessName={business?.name}>
                {/* Customer + business info */}
                <BusinessCard customer={customer} business={business} />

                {/* Inline banners */}
                {cancelDone  && <CancelSuccessBanner onDismiss={clearCancelDone} />}
                {cancelError && <CancelErrorBanner message={cancelError} onDismiss={clearCancelError} />}

                {/* ── Upcoming appointments ── */}
                <section aria-label="Nadolazeći termini" className="mb-8">
                    <SectionHeading
                        icon={CalendarCheck}
                        title="Nadolazeći termini"
                        count={upcoming.length}
                    />

                    {upcoming.length === 0 ? (
                        <EmptyState icon={CalendarCheck} message="Nemate nadolazećih termina." />
                    ) : (
                        <div className="space-y-3">
                            {upcoming.map(apt => (
                                <PortalAppointmentCard
                                    key={apt.id}
                                    appointment={apt}
                                    variant="upcoming"
                                    onCancel={cancelAppointment}
                                    isCanceling={cancelingId === apt.id}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Past appointments ── */}
                {past.length > 0 && (
                    <section aria-label="Historia termina">
                        <SectionHeading
                            icon={Clock}
                            title="Prethodne posjete"
                            count={0}
                        />
                        <div className="space-y-3">
                            {past.map(apt => (
                                <PortalAppointmentCard
                                    key={apt.id}
                                    appointment={apt}
                                    variant="past"
                                    onCancel={cancelAppointment}
                                    isCanceling={false}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Lookup link ── */}
                <div className="mt-8 text-center">
                    <Link
                        to="/portal/lookup"
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150"
                    >
                        Niste pronašli link?
                        <ChevronRight className="w-3 h-3" strokeWidth={2} />
                    </Link>
                </div>
            </PortalLayout>
        </>
    );
}
