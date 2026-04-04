import React from 'react';
import { format } from 'date-fns';
import { Clock, User, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DesktopSidebar({ state, onNext, disableNext, nextLabel }) {
    const { step, selectedService, selectedStaff, selectedDate, selectedSlot } = state;

    // Visibility Logic: Row is visible if we are AT LEAST on its step, OR if it has a confirmed value
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

    return (
        <aside className="hidden md:block sticky top-[72px] w-[22rem] shrink-0 self-start">
            <nav className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-[var(--color-secondary)]/10 p-5 shadow-sm">
                <h2 className="text-base font-bold text-gray-900 mb-1">Pregled termina</h2>

                <AnimatePresence initial={false}>
                    {/* Service Row (Top) */}
                    {isServiceVisible && (
                        <motion.div
                            key="serviceRow"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <div className="flex flex-col gap-1 pb-1">
                                <p className={getLabelClasses(isServiceMuted)}>
                                    Usluga
                                </p>
                                {selectedService ? (
                                    <>
                                        <p className={`${getValueClasses(isServiceMuted)} leading-snug`}>
                                            {selectedService.name}
                                        </p>
                                        <div className={`flex items-center gap-3 text-sm font-medium transition-colors ${isServiceMuted ? 'text-gray-400' : 'text-gray-500'}`}>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5 opacity-60" />
                                                {selectedService.duration_minutes || selectedService.duration} min
                                            </span>
                                            {selectedService.price > 0 && (
                                                <span className={`font-bold transition-colors ${isServiceMuted ? 'text-[var(--color-primary)]/50' : 'text-[var(--color-primary)]'}`}>
                                                    {Number(selectedService.price).toFixed(2)} €
                                                </span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className={`${getValueClasses(isServiceMuted)} italic !font-medium !text-gray-400`}>Nije odabrano</p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Employee Row */}
                    {isEmployeeVisible && (
                        <motion.div
                            key="employeeRow"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <div className="border-t border-gray-100 pt-4 pb-1 mt-1">
                                <p className={getLabelClasses(isEmployeeMuted)}>
                                    Zaposlenik
                                </p>
                                <div className="flex items-center gap-2">
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

                    {/* Appointment Time Row */}
                    {isDateTimeVisible && (
                        <motion.div
                            key="timeRow"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <div className="border-t border-gray-100 pt-4 pb-1 mt-1">
                                <p className={getLabelClasses(isDateTimeMuted)}>
                                    Termin
                                </p>
                                <div className="flex items-center gap-2">
                                    <Calendar className={getIconClasses(isDateTimeMuted)} />
                                    {selectedDate && selectedSlot ? (
                                        <p className={getValueClasses(isDateTimeMuted)}>
                                            {format(new Date(selectedDate), 'dd.MM.yyyy')}
                                            <span className={`ml-2 transition-colors ${isDateTimeMuted ? 'text-[var(--color-primary)]/50' : 'text-[var(--color-primary)]'}`}>
                                                {selectedSlot.time}
                                            </span>
                                        </p>
                                    ) : (
                                        <p className={`${getValueClasses(isDateTimeMuted)} italic !font-medium !text-gray-400`}>Nije odabrano</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CTA Button */}
                <button
                    onClick={onNext}
                    disabled={disableNext}
                    className="w-full h-14 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 active:scale-[0.98] shadow-md shadow-[var(--color-primary)]/20 mt-2"
                >
                    {nextLabel || 'Nastavi'}
                </button>
            </nav>
        </aside>
    );
}
