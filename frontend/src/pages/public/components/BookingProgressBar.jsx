import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { t } from '../translations';

export default function BookingProgressBar({ step, totalSteps, onBack }) {
    const progress = (step / totalSteps) * 100;

    return (
        <div className="w-full bg-[var(--color-background)] sticky top-0 z-50 pt-2 pb-2">
            <div className="max-w-xl mx-auto px-4 w-full flex items-center justify-between mb-2">
                <button 
                    onClick={onBack}
                    className={`w-10 h-10 flex items-center justify-center -ml-2 rounded-full transition-colors ${step === 1 ? 'opacity-0 pointer-events-none' : 'hover:bg-gray-100 active:bg-gray-200'}`}
                >
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <div className="flex-1 text-center font-bold text-sm text-gray-800 uppercase tracking-widest">
                    Korak {step} od {totalSteps}
                </div>
                <div className="w-10" /> {/* Spacer for precise centering */}
            </div>
            <div className="w-full max-w-xl mx-auto px-4">
               <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                   <div 
                       className="h-full bg-[var(--color-primary)] transition-all duration-300 ease-out rounded-full"
                       style={{ width: `${progress}%` }}
                   />
               </div>
            </div>
        </div>
    );
}
