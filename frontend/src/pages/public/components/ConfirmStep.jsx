import React from 'react';
import { t } from '../translations';
import { Clock, User, Calendar, Mail, Phone, MapPin } from 'lucide-react';

export default function ConfirmStep({ state }) {
    const { business, selectedService, selectedStaff, selectedDate, selectedSlot, contactParams } = state;

    return (
        <div className="flex flex-col w-full pb-8">
            <h2 className="text-2xl font-heading font-bold mb-6 text-[var(--color-text)]">
                {t.confirmTitle || 'Pregled termina'}
            </h2>
            
            <div className="bg-white rounded-2xl p-5 border border-gray-100 max-w-xl shadow-[var(--shadow-md)]">
                <div className="flex flex-col gap-6">
                    {/* Service & Price */}
                    <div className="flex justify-between items-start border-b border-gray-100 pb-5">
                        <div className="flex flex-col gap-1">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{t.sidebarService || 'Odabrana usluga'}</div>
                            <div className="font-bold text-gray-900 text-lg leading-tight mt-1">{selectedService?.name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1.5 font-medium">
                                <Clock className="w-4 h-4 opacity-70" /> {selectedService?.duration_minutes || selectedService?.duration} {t.minutes || 'min'}
                            </div>
                        </div>
                        {selectedService?.price > 0 && (
                            <div className="font-bold text-xl text-[var(--color-primary)] shrink-0 min-w-max">
                                {Number(selectedService.price).toFixed(2)} €
                            </div>
                        )}
                    </div>

                    {/* Time & Staff */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-b border-gray-100 pb-5">
                        <div className="flex flex-col gap-1">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{t.sidebarDateTime || 'Vrijeme'}</div>
                            <div className="font-bold text-gray-900 text-base flex items-center gap-2 mt-1">
                                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                                {selectedDate} <span className="text-[var(--color-primary)] ml-1">{selectedSlot?.time}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{t.sidebarStaff || 'Zaposlenik'}</div>
                            <div className="font-bold text-gray-900 text-base flex items-center gap-2 mt-1">
                                <User className="w-4 h-4 text-gray-400 shrink-0" />
                                {selectedSlot?.worker_name || selectedStaff?.name || t.anyStaff || 'Bilo koji zaposlenik'}
                            </div>
                        </div>
                    </div>

                    {/* Location & Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="flex flex-col gap-1">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Lokacija</div>
                            <div className="text-sm font-medium text-gray-700 flex items-start gap-2 mt-1">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <div className="font-bold text-gray-900">{business?.name}</div>
                                    <div className="mt-0.5">{business?.address}</div>
                                    <div>{business?.city}</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Informacije o klijentu</div>
                            <div className="text-sm font-medium text-gray-700 mt-1">
                                <div className="font-bold text-gray-900 mb-1 leading-snug">
                                    {contactParams.firstName} {contactParams.lastName}
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {contactParams.phone}
                                </div>
                                {contactParams.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {contactParams.email}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
            <p className="text-xs text-center text-gray-500 mt-6 max-w-sm mx-auto">
                Rezervacija će biti konačna tek nakon što pritisnete gumb u nastavku.
            </p>
        </div>
    );
}
