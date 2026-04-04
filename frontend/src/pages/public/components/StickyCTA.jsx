import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, User, Calendar, X, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StickyCTA({ 
    state, 
    onNext, 
    disableNext, 
    nextLabel 
}) {
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const sheetRef = useRef(null);
    const { step, selectedService, selectedStaff, selectedDate, selectedSlot } = state;

    // Close sheet when tapping outside
    useEffect(() => {
        if (!isSheetOpen) return;
        const handleOutsideClick = (e) => {
            if (sheetRef.current && !sheetRef.current.contains(e.target)) {
                setIsSheetOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleOutsideClick);
        return () => document.removeEventListener('pointerdown', handleOutsideClick);
    }, [isSheetOpen]);

    // Close sheet on step change
    useEffect(() => {
        setIsSheetOpen(false);
    }, [step]);

    // Visibility Logic based strictly on value existence OR if we are on that step specifically to show placeholders
    const isServiceVisible = step >= 1 || !!selectedService;
    const isEmployeeVisible = step >= 2 || !!selectedStaff || !!selectedSlot;
    const isDateTimeVisible = step >= 3 || (!!selectedDate && !!selectedSlot);

    // Muted Logic: Highlight ONLY the row corresponding to the current step
    const isServiceMuted = step !== 1;
    const isEmployeeMuted = step !== 2;
    const isDateTimeMuted = step !== 3;

    // Helper classes for visual hierarchy
    const getLabelClasses = (isMuted) => `mb-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors text-gray-400`;
    const getValueClasses = (isMuted) => `font-bold transition-colors ${isMuted ? 'text-sm text-gray-600' : 'text-sm text-gray-900'}`;
    const getIconClasses = (isMuted) => `w-4 h-4 shrink-0 transition-colors text-gray-400`;

    // Condition to show the summary bar in StickyCTA 
    // Wait until service is true to show (so it's hidden on Step 1 load)
    const hasSummaryContent = !!selectedService;

    return (
        <>
            {/* Mobile Bottom Sheet overlay */}
            <AnimatePresence>
                {isSheetOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 z-[99] md:hidden" 
                        onClick={() => setIsSheetOpen(false)} 
                    />
                )}
            </AnimatePresence>

            {/* Bottom Sheet Panel */}
            <AnimatePresence>
                {isSheetOpen && (
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        ref={sheetRef}
                        className="fixed bottom-0 left-0 right-0 z-[101] md:hidden bg-white rounded-t-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
                    >
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-gray-900 text-base">Pregled termina</h3>
                            <button
                                onClick={() => setIsSheetOpen(false)}
                                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <AnimatePresence initial={false}>
                            {/* Service */}
                            {isServiceVisible && (
                                <motion.div
                                    key="sm-service"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mb-4 pb-4 border-b border-gray-50 flex flex-col gap-1">
                                        <p className={getLabelClasses(isServiceMuted)}>Usluga</p>
                                        {selectedService ? (
                                            <>
                                                <p className={getValueClasses(isServiceMuted)}>{selectedService.name}</p>
                                                <div className={`flex items-center gap-2 text-xs font-medium mt-1 transition-colors ${isServiceMuted ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    <Clock className="w-3.5 h-3.5 opacity-60" />
                                                    <span>{selectedService.duration_minutes || selectedService.duration} min</span>
                                                    {selectedService.price > 0 && (
                                                        <>
                                                            <span className={`w-1 h-1 rounded-full transition-colors ${isServiceMuted ? 'bg-gray-200' : 'bg-gray-300'}`} />
                                                            <span className={`font-bold transition-colors ${isServiceMuted ? 'text-[var(--color-primary)]/50' : 'text-[var(--color-primary)]'}`}>
                                                                {Number(selectedService.price).toFixed(2)} €
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className={`${getValueClasses(isServiceMuted)} italic !font-medium !text-gray-400`}>Nije odabrano</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Staff */}
                            {isEmployeeVisible && (
                                <motion.div
                                    key="sm-employee"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mb-4 pb-4 border-b border-gray-50">
                                        <p className={getLabelClasses(isEmployeeMuted)}>Zaposlenik</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <User className={getIconClasses(isEmployeeMuted)} />
                                            {selectedSlot || selectedStaff ? (
                                                <p className={getValueClasses(isEmployeeMuted)}>
                                                    {selectedSlot?.worker_name || selectedStaff?.name || 'Bilo koji zaposlenik'}
                                                </p>
                                            ) : (
                                                <p className={`${getValueClasses(isEmployeeMuted)} italic !font-medium !text-gray-400`}>Nije odabrano</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Appointment time */}
                            {isDateTimeVisible && (
                                <motion.div
                                    key="sm-time"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div>
                                        <p className={getLabelClasses(isDateTimeMuted)}>Termin</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <Calendar className={getIconClasses(isDateTimeMuted)} />
                                            {selectedDate && selectedSlot ? (
                                                <p className={getValueClasses(isDateTimeMuted)}>
                                                    {format(new Date(selectedDate), 'dd.MM.yyyy')}
                                                    <span className={`ml-2 transition-colors ${isDateTimeMuted ? 'text-[var(--color-primary)]/50' : 'text-[var(--color-primary)]'}`}>{selectedSlot.time}</span>
                                                </p>
                                            ) : (
                                                <p className={`${getValueClasses(isDateTimeMuted)} italic !font-medium !text-gray-400`}>Nije odabrano</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sticky CTA bar — ALWAYS visible at bottom on mobile */}
            <div className="fixed bottom-0 left-0 right-0 w-full z-[100] bg-white border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 px-4 sm:px-6 md:hidden">
                <div className="max-w-xl mx-auto w-full">

                    {/* Tappable summary area (opens bottom sheet) */}
                    <AnimatePresence>
                        {hasSummaryContent && (
                            <motion.button
                                initial={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                                animate={{ height: 'auto', opacity: 1, marginTop: 4, marginBottom: 16 }}
                                exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                onClick={() => setIsSheetOpen(true)}
                                className="w-full flex justify-between items-center px-1 rounded-xl cursor-pointer group overflow-hidden"
                            >
                                <div className="flex flex-col items-start gap-0.5 min-w-0">
                                    <span className="font-bold text-gray-900 text-sm truncate max-w-[180px]">
                                        {selectedService?.name}
                                    </span>
                                    <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">
                                        {selectedService?.duration_minutes || selectedService?.duration} min
                                        {selectedService?.price > 0 && (
                                            <> • {Number(selectedService.price).toFixed(2)} €</>
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {selectedSlot && selectedDate ? (
                                        <span className="text-xs font-bold text-white bg-gray-900 px-2.5 py-1 rounded-full">
                                            {format(new Date(selectedDate), 'dd.MM.')} {selectedSlot.time}
                                        </span>
                                    ) : (
                                        <ChevronUp className="w-4 h-4 text-gray-400 transition-colors" />
                                    )}
                                </div>
                            </motion.button>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={onNext}
                        disabled={disableNext}
                        className="w-full h-14 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 active:scale-[0.98] shadow-md shadow-[var(--color-primary)]/20"
                    >
                        {nextLabel || 'Nastavi'}
                    </button>
                </div>
            </div>
        </>
    );
}
