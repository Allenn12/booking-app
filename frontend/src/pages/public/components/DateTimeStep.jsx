import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '@/api/client';
import { format, addDays, startOfToday, isBefore, isSameDay } from 'date-fns';
import { hr } from 'date-fns/locale';
import { t } from '@/pages/public/translations';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useParams } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';

// ─────────────────────────────────────────────────────
// DateTile — one clickable date cell
// ─────────────────────────────────────────────────────
function DateTile({ day, dateStr, isSelected, isAvailable, onSelect }) {
    const today = startOfToday();
    const isPast = isBefore(day, today) && !isSameDay(day, today);
    const isUnavailable = isPast || !isAvailable;

    const dayNum = format(day, 'd');
    const dayName = format(day, 'EEE', { locale: hr }).replace('.', '').toUpperCase();

    // Matching Lime StudioFix EXACT layout:
    // 1. Top White area with Date/Day
    // 2. Bottom Dark area with Status/Price

    if (isUnavailable) {
        return (
            <div className="relative w-full rounded-xl border border-gray-100 overflow-hidden select-none cursor-default">
                <div className="flex h-20 flex-col items-center justify-center bg-white text-slate-200">
                    <span className="text-2xl font-extrabold">{dayNum}</span>
                    <span className="text-xs font-bold -mt-0.5">{dayName}</span>
                </div>
                <div className="bg-slate-900/40 py-2 text-center border-t border-slate-700/10">
                    <p className="text-[10px] font-medium tracking-tight text-white/60 whitespace-nowrap px-0.5">
                        Nije dostupno
                    </p>
                </div>
            </div>
        );
    }

    if (isSelected) {
        return (
            <button
                onClick={() => onSelect(dateStr)}
                className="relative w-full rounded-xl border-2 border-[var(--color-primary)] overflow-hidden shadow-lg shadow-[var(--color-primary)]/30 transition-all scale-[1.02]"
            >
                <div className="flex h-20 flex-col items-center justify-center bg-[var(--color-primary)] text-white">
                    <span className="text-2xl font-extrabold">{dayNum}</span>
                    <span className="text-xs font-bold -mt-0.5">{dayName}</span>
                </div>
                <div className="bg-slate-900/90 py-1.5 pt-[5px] text-center">
                    <p className="text-[10px] uppercase tracking-widest text-white font-bold">
                        Odabrano
                    </p>
                </div>
            </button>
        );
    }

    // Available (default)
    return (
        <button
            onClick={() => onSelect(dateStr)}
            className="relative w-full rounded-xl border border-gray-100 overflow-hidden hover:border-gray-300 transition-all group bg-white"
        >
            <div className="flex h-20 flex-col items-center justify-center bg-white text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">
                <span className="text-2xl font-extrabold">{dayNum}</span>
                <span className="text-xs font-bold text-slate-400 group-hover:text-[var(--color-primary)]/60 transition-colors -mt-0.5">{dayName}</span>
            </div>
            <div className="bg-slate-900 py-1.5 pt-[5px] text-center border-t border-slate-800">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white group-hover:text-white transition-colors">
                    15,00 €
                </p>
            </div>
        </button>
    );
}

// ─────────────────────────────────────────────────────
// DateStrip — horizontal Embla carousel of date tiles
// ─────────────────────────────────────────────────────
function DateStrip({ bookingWindowDays, scrollOffset, onScrollChange, selectedDate, onSelectDate, availabilityRange }) {
    const today = startOfToday();
    // Use ref so Embla event handlers don't need onScrollChange as a dep
    const onScrollChangeRef = useRef(onScrollChange);
    useEffect(() => { onScrollChangeRef.current = onScrollChange; }, [onScrollChange]);
    const onSelectDateRef = useRef(onSelectDate);
    useEffect(() => { onSelectDateRef.current = onSelectDate; }, [onSelectDate]);

    const allDays = useMemo(
        () => Array.from({ length: bookingWindowDays }).map((_, i) => addDays(today, i)),
        [bookingWindowDays, today]
    );

    const [emblaRef, emblaApi] = useEmblaCarousel({
        dragFree: true,
        slidesToScroll: 4,
        containScroll: 'trimSnaps',
        align: 'start',
        duration: 35,
        skipSnaps: false
    });

    const [isPrevDisabled, setIsPrevDisabled] = useState(true);
    const [isNextDisabled, setIsNextDisabled] = useState(false);
    const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);

    useEffect(() => {
        if (!emblaApi) return;

        const onSelect = () => {
            setIsPrevDisabled(!emblaApi.canScrollPrev());
            setIsNextDisabled(!emblaApi.canScrollNext());
            const snaps = emblaApi.slidesInView();
            if (snaps.length > 0) setFirstVisibleIndex(snaps[0]);
        };

        const onScroll = () => {
            onScrollChangeRef.current(emblaApi.scrollProgress());
            // Sync month label while dragging or during momentum
            const slides = emblaApi.slidesInView();
            if (slides.length > 0) setFirstVisibleIndex(slides[0]);
        };

        emblaApi.on('select', onSelect);
        emblaApi.on('scroll', onScroll);
        emblaApi.on('reInit', onSelect);

        onSelect();
        onScroll();

        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('scroll', onScroll);
            emblaApi.off('reInit', onSelect);
        };
        // Only depend on emblaApi itself — callbacks are stable via refs
    }, [emblaApi]);

    useEffect(() => {
        if (emblaApi && scrollOffset === 0) {
            emblaApi.scrollTo(0);
        }
    }, [scrollOffset, emblaApi]);

    const handlePrev = () => emblaApi && emblaApi.scrollPrev();
    const handleNext = () => emblaApi && emblaApi.scrollNext();
    const handleToday = () => {
        if (emblaApi) emblaApi.scrollTo(0);
        onScrollChangeRef.current(0);
        onSelectDateRef.current(format(today, 'yyyy-MM-dd'));
        setFirstVisibleIndex(0);
    };

    // Handle date selection — directly update via ref so it's always latest callback
    const handleTileSelect = useCallback((dateStr) => {
        onSelectDateRef.current(dateStr);
    }, []);

    const firstVisibleDay = allDays[firstVisibleIndex] || today;
    const rawMonthLabel = format(firstVisibleDay, 'LLLL yyyy', { locale: hr });
    const monthYearLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);

    const isOnToday = isPrevDisabled && selectedDate === format(today, 'yyyy-MM-dd');

    return (
        <div className="mb-6 select-none relative w-full overflow-hidden">
            {/* Header: Month label + nav controls */}
            <div className="flex justify-between items-center mb-5 px-1">
                <h4 className="text-sm font-extrabold text-gray-900 tracking-tight">
                    {monthYearLabel}
                </h4>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handlePrev}
                        disabled={isPrevDisabled}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50/80 border border-gray-100 text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleToday}
                        disabled={isOnToday}
                        className="h-8 px-4 flex items-center justify-center rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition-all text-[11px] font-extrabold text-gray-600 uppercase tracking-widest active:scale-95"
                    >
                        Danas
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={isNextDisabled}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50/80 border border-gray-100 text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Embla viewport */}
            <div
                className="overflow-hidden cursor-grab active:cursor-grabbing w-full"
                ref={emblaRef}
            >
                <div
                    className="flex ml-[-16px] backface-hidden"
                    style={{ backfaceVisibility: 'hidden', touchAction: 'pan-y' }}
                >
                    {allDays.map((d) => {
                        const dateStr = format(d, 'yyyy-MM-dd');
                        const isSelected = selectedDate === dateStr;
                        const isAvailable = availabilityRange[dateStr] === true;

                        return (
                            <div
                                key={dateStr}
                                className="flex-[0_0_auto] min-w-0 pl-4 w-[106px]"
                            >
                                <DateTile
                                    day={d}
                                    dateStr={dateStr}
                                    isSelected={isSelected}
                                    isAvailable={isAvailable}
                                    onSelect={handleTileSelect}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────
// Main DateTimeStep component
// ─────────────────────────────────────────────────────
export default function DateTimeStep({ state, actions }) {
    const { slug } = useParams();
    const [availabilityRange, setAvailabilityRange] = useState({});
    const bookingWindowDays = state.business?.booking_window_days || 30;

    // Auto-select today on mount if no date is selected
    useEffect(() => {
        if (!state.selectedDate) {
            actions.setDate(format(startOfToday(), 'yyyy-MM-dd'));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch FULL availability range for the booking window
    useEffect(() => {
        let mounted = true;
        const fetchRange = async () => {
            if (!state.selectedService) return;

            const today = startOfToday();
            const startStr = format(today, 'yyyy-MM-dd');
            const endStr = format(addDays(today, bookingWindowDays - 1), 'yyyy-MM-dd');

            try {
                const res = await api.getPublicAvailabilityRange(slug, startStr, endStr, state.selectedService.id);
                if (mounted && res?.success) {
                    setAvailabilityRange(prev => ({ ...prev, ...res.data.dates }));
                }
            } catch (err) {
                console.error("Failed to fetch availability range", err);
            }
        };
        fetchRange();
        return () => { mounted = false; };
    }, [slug, bookingWindowDays, state.selectedService]);

    // Group slots by time, aggregating workers at each slot time
    const groupedSlots = useMemo(() => {
        const slots = state.slots || [];
        const map = new Map();
        for (const s of slots) {
            if (!map.has(s.time)) map.set(s.time, []);
            map.get(s.time).push(s);
        }
        return Array.from(map.entries())
            .map(([time, workers]) => ({ time, workers }))
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [state.slots]);

    const handleJumpToNextFree = useCallback(async () => {
        const today = startOfToday();
        const allDays = Array.from(
            { length: bookingWindowDays },
            (_, i) => format(addDays(today, i), 'yyyy-MM-dd')
        );

        const firstAvailable = allDays.find(date => availabilityRange[date] === true);
        if (!firstAvailable) return;

        actions.onScrollChange(0);
        actions.setDate(firstAvailable);
    }, [availabilityRange, bookingWindowDays, actions]);

    return (
        <div className="flex flex-col w-full pb-8">
            <h2 className="text-2xl font-heading font-bold mb-2 text-[var(--color-text)]">
                {t.stepDateTime || 'Odaberi termin'}
            </h2>
            <p className="text-sm text-gray-500 mb-6 font-medium">
                {state.selectedService?.name} • {state.selectedStaff?.name || t.anyStaff || 'Bilo koji zaposlenik'}
            </p>

            {/* Date strip */}
            <DateStrip
                bookingWindowDays={bookingWindowDays}
                scrollOffset={state.scrollOffset || 0}
                onScrollChange={actions.onScrollChange}
                selectedDate={state.selectedDate}
                onSelectDate={actions.setDate}
                availabilityRange={availabilityRange}
            />

            {/* Slots grid */}
            {state.selectedDate && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 mb-4 min-h-[200px] relative">
                    {state.slotsLoading ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 opacity-70">
                            {[...Array(15)].map((_, i) => (
                                <div key={i} className="py-3 px-2 rounded-xl border border-gray-100 bg-slate-100 h-[52px] animate-pulse" />
                            ))}
                        </div>
                    ) : groupedSlots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <span className="text-2xl opacity-40">🗓️</span>
                            </div>
                            <p className="text-gray-500 font-medium mb-4">{t.noSlots}</p>
                            <button
                                onClick={handleJumpToNextFree}
                                className="text-[var(--color-primary)] font-semibold hover:underline text-sm min-h-[44px] px-4"
                            >
                                {t.jumpToNext}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
                            {groupedSlots.map(group => {
                                const isSelected = state.selectedSlot && state.selectedSlot.time === group.time;
                                const preferredWorker = group.workers[0];

                                return (
                                    <button
                                        key={group.time}
                                        onClick={() => actions.setSlot(preferredWorker)}
                                        className={`py-3.5 px-2 rounded-2xl transition-all flex flex-col items-center justify-center gap-1.5 min-h-[64px] border border-transparent shadow-sm ${isSelected
                                            ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20 scale-[1.03] ring-1 ring-[var(--color-primary)]'
                                            : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50 text-gray-800 hover:shadow-md'
                                            }`}
                                    >
                                        <span className={`font-extrabold text-[15px] tracking-tight ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                            {group.time}
                                        </span>
                                        {/* Worker preview dots */}
                                        {!state.selectedStaff && (
                                            <div className="flex -space-x-1.5 mt-0.5">
                                                {group.workers.slice(0, 3).map(w => (
                                                    <div
                                                        key={w.worker_id}
                                                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black border-2 ${isSelected ? 'border-[var(--color-primary)] bg-white text-[var(--color-primary)]' : 'border-white bg-gray-100 text-gray-400'}`}
                                                    >
                                                        {w.worker_name.charAt(0).toUpperCase()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {!state.selectedDate && (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100 font-medium mt-4">
                    Odaberite datum za prikaz slobodnih termina
                </div>
            )}
        </div>
    );
}
