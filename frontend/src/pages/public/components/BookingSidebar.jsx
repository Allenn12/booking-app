import React, { useState } from 'react';
import { t } from '../translations';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function BookingSidebar({ state, onChangeStep }) {
    const [mobileExpanded, setMobileExpanded] = useState(false);

    // Sidebar Summary Item renderer
    const SummaryItem = ({ stepNum, title, isComplete, currentStep, valuePrimary, valueSecondary, avatarInitial }) => {
        const isActive = currentStep === stepNum || (currentStep > 3 && stepNum === 3); // step 4/5 keeps step 3 active if we don't refine it purely
        // More precise exactly active logic:
        let dotColor = 'bg-gray-200 border border-gray-300';
        if (isComplete) dotColor = 'bg-green-500';
        else if (currentStep === stepNum) dotColor = 'bg-[var(--color-primary)]';

        return (
            <div className="relative pl-6">
                <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full transition-colors ${dotColor}`} />
                <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-gray-500 tracking-wider font-heading uppercase">{title}</span>
                    {isComplete && currentStep > stepNum && stepNum < 5 && (
                        <button onClick={() => { setMobileExpanded(false); onChangeStep(stepNum); }} className="text-xs font-semibold text-[var(--color-primary)] hover:underline opacity-80">
                            {t.change}
                        </button>
                    )}
                </div>
                {isComplete || valuePrimary ? (
                    <div>
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                            {avatarInitial && (
                                <div className="w-6 h-6 rounded-full bg-[var(--color-secondary)] text-[var(--color-primary)] bg-opacity-20 flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {avatarInitial}
                                </div>
                            )}
                            {valuePrimary}
                        </div>
                        {valueSecondary && <div className="text-sm text-gray-500 mt-0.5">{valueSecondary}</div>}
                    </div>
                ) : (
                    <div className="text-sm text-gray-400 italic">{t.notSelected}</div>
                )}
            </div>
        );
    };

    const isStep1Done = !!state.selectedService;
    const isStep2Done = state.step > 2 && !!state.selectedService; // Selected staff can be null (Bilo tko) but step>2 ensures it was processed
    const isStep3Done = !!state.selectedSlot;

    const getStaffPrimary = () => {
        if (!isStep2Done) return null;
        return state.selectedStaff ? state.selectedStaff.name : t.anyStaff;
    };
    const getStaffInitial = () => {
        if (!isStep2Done) return null;
        return state.selectedStaff ? state.selectedStaff.name.charAt(0).toUpperCase() : '?';
    };

    // Desktop view (hidden on small) + mobile expansion layer
    const renderSidebarContent = () => (
        <div className="flex flex-col gap-6">
            <SummaryItem 
                stepNum={1} 
                title={t.sidebarService} 
                isComplete={isStep1Done} 
                currentStep={state.step} 
                valuePrimary={state.selectedService?.name} 
                valueSecondary={state.selectedService ? `${state.selectedService.duration_minutes} ${t.minutes} · ${Number(state.selectedService.price).toFixed(2)} €` : null} 
            />
            <SummaryItem 
                stepNum={2} 
                title={t.sidebarStaff} 
                isComplete={isStep2Done} 
                currentStep={state.step} 
                valuePrimary={getStaffPrimary()} 
                avatarInitial={getStaffInitial()}
            />
            <SummaryItem 
                stepNum={3} 
                title={t.sidebarDateTime} 
                isComplete={isStep3Done} 
                currentStep={state.step} 
                valuePrimary={state.selectedDate} 
                valueSecondary={state.selectedSlot?.time} 
            />
        </div>
    );

    // Only render if we have initialized business basically
    if (state.loading || !state.business || state.step === 6) return null;

    // Mobile specific summarized text for collapsed state
    const getMobileSummarizedText = () => {
        if (state.step === 1) return t.stepService;
        if (state.step === 2) return state.selectedService?.name || t.stepStaff;
        if (state.step >= 3 && !state.selectedSlot) return `${state.selectedService?.name} · ${getStaffPrimary()}`;
        if (state.selectedSlot) return `${state.selectedDate} u ${state.selectedSlot.time}`;
        return t.sidebarTitle;
    };

    return (
        <>
            {/* DESKTOP SIDEBAR */}
            <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 sticky top-8 border border-gray-100 hidden md:block">
                <h3 className="font-heading font-bold text-xl mb-6 text-[var(--color-text)] border-b-2 border-[var(--color-primary)] pb-2 inline-block">
                    {t.sidebarTitle}
                </h3>
                {renderSidebarContent()}
            </div>

            {/* MOBILE FLOATING STICKY BAR */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_15px_rgba(0,0,0,0.05)] border-t border-gray-100 transition-all rounded-t-2xl">
                {/* Mobile Expansion Header */}
                <div 
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setMobileExpanded(!mobileExpanded)}
                >
                    <div>
                        <div className="text-xs text-gray-500 font-bold tracking-wider mb-1 uppercase">
                            {t.sidebarTitle}
                        </div>
                        <div className="font-semibold text-[var(--color-text)] truncate max-w-[250px]">
                            {getMobileSummarizedText()}
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                        {mobileExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </div>
                </div>

                {/* Mobile Expansion Panel */}
                {mobileExpanded && (
                    <div className="px-5 pb-6 pt-2 border-t border-gray-50 max-h-[50vh] overflow-y-auto">
                        {renderSidebarContent()}
                    </div>
                )}
            </div>
            
            {/* Add padding to body so mobile bar doesn't overlap content */}
            <style>{`@media (max-width: 767px) { body { padding-bottom: 80px; } }`}</style>
        </>
    );
}
