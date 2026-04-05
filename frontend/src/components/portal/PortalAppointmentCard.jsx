/**
 * PortalAppointmentCard
 * =====================
 * Presentational component — receives appointment data and callbacks.
 * Zero internal state. Parent (CustomerPortalPage) owns cancel flow.
 *
 * Props:
 *   appointment  — appointment object from portal API
 *   onCancel     — (id) => void, called when user confirms cancel
 *   isCanceling  — bool, whether THIS card is currently being cancelled
 *   variant      — 'upcoming' | 'past'
 */

import React, { useState, useCallback } from 'react';
import { Calendar, Clock, User, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

// Extracted outside component — stable reference, no re-creation on render
const STATUS_MAP = {
    scheduled:  { label: 'Zakazano',    cls: 'bg-blue-50 text-blue-700 border-blue-100'   },
    confirmed:  { label: 'Potvrđeno',   cls: 'bg-green-50 text-green-700 border-green-100' },
    completed:  { label: 'Završeno',    cls: 'bg-gray-50 text-gray-600 border-gray-200'    },
    cancelled:  { label: 'Otkazano',    cls: 'bg-red-50 text-red-600 border-red-100'       },
    no_show:    { label: 'Nije došao',  cls: 'bg-orange-50 text-orange-700 border-orange-100' },
};

function formatDateTime(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleString('hr-HR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function PortalAppointmentCard({ appointment, onCancel, isCanceling, variant = 'upcoming' }) {
    const [showConfirm, setShowConfirm] = useState(false);

    const status = STATUS_MAP[appointment.status] || { label: appointment.status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
    const isUpcoming = variant === 'upcoming';

    const handleCancelClick = useCallback(() => setShowConfirm(true),  []);
    const handleCancelAbort = useCallback(() => setShowConfirm(false), []);
    const handleCancelConfirm = useCallback(() => {
        setShowConfirm(false);
        onCancel(appointment.id);
    }, [appointment.id, onCancel]);

    return (
        <article
            className={[
                'bg-white rounded-2xl border overflow-hidden transition-shadow duration-200',
                isUpcoming
                    ? 'border-gray-100 shadow-sm hover:shadow-md'
                    : 'border-gray-100 opacity-80',
            ].join(' ')}
        >
            {/* ── Main card body ── */}
            <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                        {/* Service name */}
                        <p className="font-semibold text-gray-900 text-base leading-tight truncate">
                            {appointment.service_name || 'Usluga'}
                        </p>

                        {/* Date */}
                        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                            <span className="capitalize truncate">{formatDateTime(appointment.appointment_datetime)}</span>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                            {appointment.worker_name && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                                    {appointment.worker_name.trim()}
                                </span>
                            )}
                            {appointment.duration_minutes && (
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                                    {appointment.duration_minutes} min
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right: status badge */}
                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.cls}`}>
                        {status.label}
                    </span>
                </div>

                {/* ── Cancel button (upcoming + can_cancel only) ── */}
                {isUpcoming && appointment.can_cancel && !showConfirm && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                        <button
                            onClick={handleCancelClick}
                            disabled={isCanceling}
                            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Otkaži termin: ${appointment.service_name}`}
                        >
                            {isCanceling ? (
                                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                            ) : (
                                <AlertCircle className="w-4 h-4" strokeWidth={2} />
                            )}
                            {isCanceling ? 'Otkazivanje...' : 'Otkaži termin'}
                        </button>
                    </div>
                )}

                {/* ── Too-close-to-cancel notice ── */}
                {isUpcoming && !appointment.can_cancel && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                            Otkazivanje nije moguće — manje od 24h do termina
                        </p>
                    </div>
                )}
            </div>

            {/* ── Inline cancel confirmation ── */}
            {showConfirm && (
                <div className="bg-red-50 border-t border-red-100 px-4 sm:px-5 py-4">
                    <p className="text-sm font-medium text-red-800 mb-3">
                        Jeste li sigurni da želite otkazati ovaj termin?
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCancelConfirm}
                            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors duration-150 cursor-pointer"
                        >
                            Da, otkaži
                        </button>
                        <button
                            onClick={handleCancelAbort}
                            className="flex-1 py-2 rounded-xl bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                        >
                            Ipak ne
                        </button>
                    </div>
                </div>
            )}
        </article>
    );
}
