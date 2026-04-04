import React from 'react';
import { t } from '../translations';
import { Clock } from 'lucide-react';

export default function ServiceStep({ state, actions }) {
    const { services, selectedService } = state;

    return (
        <div className="flex flex-col w-full pb-8">
            <h2 className="text-2xl font-heading font-bold mb-6 text-[var(--color-text)]">
                {t.stepService || 'Odaberi uslugu'}
            </h2>
            
            <div className="flex flex-col gap-3">
                {services.map((svc) => {
                    const isSelected = selectedService?.id === svc.id;
                    return (
                        <button
                            key={svc.id}
                            onClick={() => actions.setService({
                                ...svc,
                                duration: svc.duration_minutes // Normalize for StickyCTA
                            })}
                            className={`p-4 min-h-[72px] rounded-2xl cursor-pointer transition-all border-2 text-left bg-white select-none ${
                                isSelected 
                                ? 'border-[var(--color-primary)] shadow-sm bg-[var(--color-primary)]/[0.03]' 
                                : 'border-gray-100 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-bold text-base text-gray-900 mb-1">{svc.name}</div>
                            
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                                    <Clock className="w-4 h-4 opacity-70" /> {svc.duration_minutes} {t.minutes || 'min'}
                                </span>
                                {svc.price > 0 && (
                                    <span className="text-[var(--color-primary)] font-bold text-base">
                                        {Number(svc.price).toFixed(2)} €
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
            
            {services.length === 0 && (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100 font-medium mt-4">
                    Trenutno nema dostupnih usluga.
                </div>
            )}
        </div>
    );
}
