import React from 'react';
import { t } from '../translations';
import { CalendarCheck, CalendarDays, Instagram } from 'lucide-react';

export default function SuccessStep({ state }) {
    const { business, selectedDate, selectedSlot } = state;

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center justify-center text-center py-12 px-4 max-w-lg mx-auto">
            
            <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-sm border-8 border-green-50">
                <CalendarCheck className="w-12 h-12" />
            </div>

            <h2 className="text-3xl font-heading font-bold mb-3 text-[var(--color-text)]">
                {t.successTitle}
            </h2>
            
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                {t.successMessage}
            </p>

            <div className="w-full bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-8 shadow-inner">
                <div className="text-sm text-gray-500 uppercase tracking-widest font-bold mb-2">Vaš termin</div>
                <div className="font-bold text-gray-900 text-2xl mb-1">{selectedDate}</div>
                <div className="text-gray-600 font-medium text-lg mb-4">u {selectedSlot?.time}</div>
                
                <div className="text-sm text-gray-500 bg-white p-3 rounded-lg border border-gray-100 inline-block">
                    Poslali smo vam potvrdu na <span className="font-semibold text-gray-700">{state.contactParams.phone}</span>
                    {state.contactParams.email ? ` i ${state.contactParams.email}` : ''}.
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-2">
                {business?.instagram_url ? (
                    <a 
                        href={business.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Instagram className="w-5 h-5" /> Pratite nas
                    </a>
                ) : (
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                        Nova rezervacija
                    </button>
                )}
                
                <button 
                    className="px-6 py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:opacity-90 shadow-[var(--shadow-md)] transition-colors flex items-center justify-center gap-2"
                    onClick={() => {
                        alert('Implementacija kalendara stiže uskoro!');
                    }}
                >
                    <CalendarDays className="w-5 h-5" />
                    {t.addToCalendar}
                </button>
            </div>
            
        </div>
    );
}
