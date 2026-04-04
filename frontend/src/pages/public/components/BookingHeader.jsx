import React from 'react';
import { MapPin, Phone, Instagram, Facebook } from 'lucide-react';

export default function BookingHeader({ business, hours }) {
    if (!business) return null;

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 mb-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
                {business.logo_url ? (
                    <img src={business.logo_url} alt={business.name} className="w-16 h-16 rounded-full object-cover border border-gray-100" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--color-secondary)] flex items-center justify-center text-white text-2xl font-heading font-bold">
                        {business.name.charAt(0)}
                    </div>
                )}
                <div>
                    <h1 className="text-2xl font-heading font-bold text-[var(--color-text)] m-0">{business.name}</h1>
                    <p className="text-sm text-gray-500 mt-1">{business.description}</p>
                </div>
            </div>

            <div className="flex flex-col gap-2 text-sm text-gray-600">
                {business.address && (
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[var(--color-primary)] opacity-80" />
                        <span>{business.address}{business.city && `, ${business.city}`}</span>
                    </div>
                )}
                {business.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[var(--color-primary)] opacity-80" />
                        <span>{business.phone}</span>
                    </div>
                )}
                <div className="flex items-center gap-3 mt-1">
                    {business.instagram_url && (
                        <a href={business.instagram_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[var(--color-primary)] transition-colors">
                            <Instagram className="w-5 h-5" />
                        </a>
                    )}
                    {business.facebook_url && (
                        <a href={business.facebook_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[var(--color-primary)] transition-colors">
                            <Facebook className="w-5 h-5" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
