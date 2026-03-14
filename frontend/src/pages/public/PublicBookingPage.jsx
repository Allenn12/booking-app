import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import './PublicBookingPage.css';

/*
 * PublicBookingPage — 4-step booking wizard (no auth required)
 *
 * Steps:
 *   1. Choose service
 *   2. Pick date → see available time slots → pick one
 *   3. Enter contact info (name + phone)
 *   4. Confirm → submit
 */
export default function PublicBookingPage() {
    const { slug } = useParams();

    // ── State ──
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [businessData, setBusinessData] = useState(null);
    const [bookingDisabled, setBookingDisabled] = useState(false);
    const [step, setStep] = useState(1);

    // Step 1 — Service
    const [selectedService, setSelectedService] = useState(null);

    // Step 2 — Date & Slot
    const [selectedDate, setSelectedDate] = useState('');
    const [slots, setSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);

    // Step 3 — Contact
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');

    // Final
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // ── Load business info ──
    useEffect(() => {
        const fetchBusiness = async () => {
            try {
                setLoading(true);
                const res = await api.getPublicBusinessInfo(slug);
                if (res.data.booking_disabled) {
                    setBookingDisabled(true);
                    setBusinessData({ business: { name: res.data.business_name } });
                } else {
                    setBusinessData(res.data);
                }
            } catch {
                setError('Business not found or link is invalid.');
            } finally {
                setLoading(false);
            }
        };
        fetchBusiness();
    }, [slug]);

    // ── Fetch slots when date changes ──
    const fetchSlots = useCallback(async (date) => {
        if (!date || !selectedService) return;
        try {
            setSlotsLoading(true);
            setSelectedSlot(null);
            const res = await api.getPublicAvailability(slug, date, selectedService.id);
            setSlots(res.data.slots || []);
        } catch {
            setSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    }, [slug, selectedService]);

    useEffect(() => {
        if (selectedDate && selectedService) {
            fetchSlots(selectedDate);
        }
    }, [selectedDate, fetchSlots, selectedService]);

    // ── Submit booking ──
    const handleSubmit = async () => {
        if (submitting) return;
        try {
            setSubmitting(true);
            setError(null);
            const datetime = `${selectedDate}T${selectedSlot.time}:00`;
            await api.createPublicBooking(slug, {
                service_id: selectedService.id,
                worker_id: selectedSlot.worker_id,
                appointment_datetime: datetime,
                client_name: clientName.trim(),
                client_phone: clientPhone.trim(),
            });
            setSuccess(true);
        } catch (err) {
            const msg = err?.response?.data?.message || 'Booking failed. Please try again.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Helpers ──
    const todayStr = new Date().toISOString().split('T')[0];

    const groupSlotsByWorker = (slotsArr) => {
        const grouped = {};
        for (const s of slotsArr) {
            if (!grouped[s.worker_name]) grouped[s.worker_name] = [];
            grouped[s.worker_name].push(s);
        }
        return grouped;
    };

    const canProceedStep2 = selectedDate && selectedSlot;
    const canProceedStep3 = clientName.trim().length >= 2 && clientPhone.trim().length >= 6;

    // ── Render helpers ──
    const renderStepper = () => {
        const steps = [1, 2, 3, 4];
        return (
            <div className="pb-stepper">
                {steps.map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={`pb-step-indicator ${step === s ? 'active' : ''} ${step > s ? 'done' : ''}`}>
                            {step > s ? '✓' : s}
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`pb-step-line ${step > s ? 'done' : ''}`} />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // ── LOADING / ERROR / DISABLED ──
    if (loading) {
        return (
            <div className="pb-page">
                <div className="pb-card">
                    <div className="pb-loading">
                        <div className="pb-spinner" />
                        <p>Loading booking page...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !businessData) {
        return (
            <div className="pb-page">
                <div className="pb-card">
                    <div className="pb-disabled">
                        <div className="pb-disabled-icon">🔗</div>
                        <h2>Invalid Link</h2>
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (bookingDisabled) {
        return (
            <div className="pb-page">
                <div className="pb-card">
                    <div className="pb-disabled">
                        <div className="pb-disabled-icon">🔒</div>
                        <h2>{businessData.business.name}</h2>
                        <p>Online booking is not currently available for this business.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── SUCCESS ──
    if (success) {
        return (
            <div className="pb-page">
                <div className="pb-card">
                    <div className="pb-success">
                        <div className="pb-success-icon">✓</div>
                        <h2>Booking Confirmed!</h2>
                        <p>
                            Your appointment at <strong>{businessData.business.name}</strong> is
                            scheduled for <strong>{selectedDate}</strong> at <strong>{selectedSlot.time}</strong>.
                        </p>
                        <p style={{ marginTop: '12px', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                            You may close this page.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── MAIN WIZARD ──
    const { business, services, team } = businessData;

    return (
        <div className="pb-page">
            {/* Error toast */}
            {error && (
                <div className="pb-error-toast" onClick={() => setError(null)}>
                    {error}
                </div>
            )}

            <div className="pb-card">
                {/* Header */}
                <div className="pb-header">
                    <div className="pb-business-name">{business.name}</div>
                    <div className="pb-subtitle">Book your appointment online</div>
                </div>

                {renderStepper()}

                {/* ═══════ STEP 1: Choose Service ═══════ */}
                {step === 1 && (
                    <div>
                        <div className="pb-section-title">Choose a Service</div>
                        <div className="pb-service-list">
                            {services.map(svc => (
                                <div
                                    key={svc.id}
                                    className={`pb-service-card ${selectedService?.id === svc.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedService(svc)}
                                >
                                    <div>
                                        <div className="pb-service-name">{svc.name}</div>
                                        <div className="pb-service-meta">
                                            <span>⏱ {svc.duration_minutes} min</span>
                                        </div>
                                    </div>
                                    {svc.price > 0 && (
                                        <div className="pb-service-price">${parseFloat(svc.price).toFixed(2)}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {services.length === 0 && (
                            <div className="pb-empty">No services available at this time.</div>
                        )}
                        <div className="pb-btn-row">
                            <button
                                className="pb-btn pb-btn-primary"
                                disabled={!selectedService}
                                onClick={() => setStep(2)}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 2: Date & Time ═══════ */}
                {step === 2 && (
                    <div>
                        <div className="pb-section-title">Pick a Date & Time</div>
                        <input
                            type="date"
                            className="pb-date-input"
                            value={selectedDate}
                            min={todayStr}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />

                        {slotsLoading && (
                            <div className="pb-loading">
                                <div className="pb-spinner" />
                                <p>Checking availability...</p>
                            </div>
                        )}

                        {!slotsLoading && selectedDate && slots.length === 0 && (
                            <div className="pb-empty">No available slots for this date. Try another day.</div>
                        )}

                        {!slotsLoading && slots.length > 0 && (
                            <div className="pb-slots-section">
                                {Object.entries(groupSlotsByWorker(slots)).map(([workerName, workerSlots]) => (
                                    <div className="pb-worker-group" key={workerName}>
                                        {team.length > 1 && (
                                            <div className="pb-worker-name">👤 {workerName}</div>
                                        )}
                                        <div className="pb-slots-grid">
                                            {workerSlots.map((s, i) => (
                                                <div
                                                    key={i}
                                                    className={`pb-slot ${
                                                        selectedSlot?.time === s.time &&
                                                        selectedSlot?.worker_id === s.worker_id
                                                            ? 'selected' : ''
                                                    }`}
                                                    onClick={() => setSelectedSlot(s)}
                                                >
                                                    {s.time}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pb-btn-row">
                            <button className="pb-btn pb-btn-secondary" onClick={() => setStep(1)}>
                                ← Back
                            </button>
                            <button
                                className="pb-btn pb-btn-primary"
                                disabled={!canProceedStep2}
                                onClick={() => setStep(3)}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 3: Contact Info ═══════ */}
                {step === 3 && (
                    <div>
                        <div className="pb-section-title">Your Information</div>
                        <div className="pb-input-group">
                            <label htmlFor="pb-name">Full Name</label>
                            <input
                                id="pb-name"
                                className="pb-input"
                                type="text"
                                placeholder="John Doe"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="pb-input-group">
                            <label htmlFor="pb-phone">Phone Number</label>
                            <input
                                id="pb-phone"
                                className="pb-input"
                                type="tel"
                                placeholder="+387 61 234 567"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                            />
                        </div>
                        <div className="pb-btn-row">
                            <button className="pb-btn pb-btn-secondary" onClick={() => setStep(2)}>
                                ← Back
                            </button>
                            <button
                                className="pb-btn pb-btn-primary"
                                disabled={!canProceedStep3}
                                onClick={() => setStep(4)}
                            >
                                Review →
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 4: Confirm ═══════ */}
                {step === 4 && (
                    <div>
                        <div className="pb-section-title">Confirm Your Booking</div>
                        <div className="pb-summary">
                            <div className="pb-summary-row">
                                <span className="pb-summary-label">Service</span>
                                <span className="pb-summary-value">{selectedService.name}</span>
                            </div>
                            <div className="pb-summary-row">
                                <span className="pb-summary-label">Duration</span>
                                <span className="pb-summary-value">{selectedService.duration_minutes} min</span>
                            </div>
                            {selectedService.price > 0 && (
                                <div className="pb-summary-row">
                                    <span className="pb-summary-label">Price</span>
                                    <span className="pb-summary-value">${parseFloat(selectedService.price).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="pb-summary-row">
                                <span className="pb-summary-label">Date</span>
                                <span className="pb-summary-value">{selectedDate}</span>
                            </div>
                            <div className="pb-summary-row">
                                <span className="pb-summary-label">Time</span>
                                <span className="pb-summary-value">{selectedSlot.time}</span>
                            </div>
                            <div className="pb-summary-row">
                                <span className="pb-summary-label">Specialist</span>
                                <span className="pb-summary-value">{selectedSlot.worker_name}</span>
                            </div>
                            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />
                            <div className="pb-summary-row">
                                <span className="pb-summary-label">Name</span>
                                <span className="pb-summary-value">{clientName}</span>
                            </div>
                            <div className="pb-summary-row">
                                <span className="pb-summary-label">Phone</span>
                                <span className="pb-summary-value">{clientPhone}</span>
                            </div>
                        </div>

                        <div className="pb-btn-row">
                            <button className="pb-btn pb-btn-secondary" onClick={() => setStep(3)}>
                                ← Back
                            </button>
                            <button
                                className="pb-btn pb-btn-primary"
                                disabled={submitting}
                                onClick={handleSubmit}
                            >
                                {submitting ? 'Booking...' : 'Confirm Booking ✓'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
