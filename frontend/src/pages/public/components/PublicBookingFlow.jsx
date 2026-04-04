// HMR-FORCE-1: Tracking changes
import React, { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BookingProgressBar from './BookingProgressBar';
import StickyCTA from './StickyCTA';
import DesktopSidebar from './DesktopSidebar';

import ServiceStep from './ServiceStep';
import StaffStep from './StaffStep';
import DateTimeStep from './DateTimeStep';
import ContactStep from './ContactStep';
import ConfirmStep from './ConfirmStep';

const variants = {
  enter: (direction) => {
    return {
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction) => {
    return {
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    };
  }
};

export default function BookingFlow({ state, actions, children }) {
    // Keep track of previous step to know slide direction
    const prevStepRef = useRef(state.step);
    const [direction, setDirection] = useState(1);
    
    useEffect(() => {
        if (state.step > prevStepRef.current) setDirection(1);
        if (state.step < prevStepRef.current) setDirection(-1);
        prevStepRef.current = state.step;
    }, [state.step]);

    const handleBack = () => {
        if (state.step > 1) {
            actions.goToStep(state.step - 1);
        } else {
            window.history.back();
        }
    };

    const isStepValid = () => {
        if (state.submitting) return false;
        switch(state.step) {
            case 1: return !!state.selectedService;
            case 2: return true; // null is valid for 'Bilo tko' (Anyone)
            case 3: return !!(state.selectedDate && state.selectedSlot);
            case 4: {
                const { firstName, lastName, phone, smsConsent } = state.contactParams;
                const isPhoneValid = /^\+?[0-9\s-]{8,15}$/.test(phone || '');
                return !!(firstName?.trim().length >= 2 && lastName?.trim().length >= 2 && isPhoneValid && smsConsent);
            }
            case 5: return true;
            default: return true;
        }
    };

    const getNextLabel = () => {
        if (state.step === 5) {
            return state.submitting ? 'Obrada...' : 'Potvrdi rezervaciju';
        }
        return 'Nastavi';
    };

    const handleNext = () => {
        if (state.step === 5) {
            actions.submit();
        } else {
            actions.nextStep();
        }
    };

    const stepComponents = {
        1: <ServiceStep state={state} actions={actions} />,
        2: <StaffStep state={state} actions={actions} />,
        3: <DateTimeStep state={state} actions={actions} />,
        4: <ContactStep state={state} actions={actions} />,
        5: <ConfirmStep state={state} actions={actions} />
    };

    // On step 3 (DateTime), show sidebar on desktop; other steps are narrow/single-column
    const isDateTimeStep = state.step === 3;
    const isCompleted = state.step === 6;

    return (
        <div className="flex flex-col min-h-[100dvh] bg-[var(--color-background)] font-body text-gray-800">
            {/* Top Progress Bar */}
            <BookingProgressBar 
               step={state.step} 
               totalSteps={5} 
               onBack={handleBack} 
            />

            {/* Main Content Area */}
            <main className="flex-1 w-full pb-32 md:pb-16">
                {!isCompleted ? (
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex flex-col md:flex-row gap-8 items-start justify-center">
                        {/* Left: Step content */}
                        <div className="w-full flex-1 max-w-xl">
                            {state.step === 1 && <ServiceStep state={state} actions={actions} />}
                            {state.step === 2 && <StaffStep state={state} actions={actions} />}
                            {state.step === 3 && <DateTimeStep state={state} actions={actions} />}
                            {state.step === 4 && <ContactStep state={state} actions={actions} />}
                            {state.step === 5 && <ConfirmStep state={state} actions={actions} />}
                        </div>

                        {/* Right: Sticky Sidebar (Desktop only) */}
                        <DesktopSidebar
                            state={state}
                            onNext={handleNext}
                            disableNext={!isStepValid()}
                            nextLabel={getNextLabel()}
                        />
                    </div>
                ) : (
                    /* Step 6 (Completed): Full-width centered */
                    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-6 pb-16">
                        {children}
                    </div>
                )}
            </main>

            {/* Mobile Sticky CTA (hidden on desktop when sidebar is present) */}
            {state.step <= 5 && (
                <StickyCTA 
                    state={state} 
                    onNext={handleNext}
                    disableNext={!isStepValid()}
                    nextLabel={getNextLabel()}
                />
            )}
        </div>
    );
}
