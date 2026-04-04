import React from 'react';

export default function StepCTA({ onClick, disabled, loading, text, onBack }) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between sm:justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
            {onBack && (
                <button
                    onClick={onBack}
                    disabled={loading}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl border-2 border-[var(--color-primary)] text-[var(--color-primary)] font-semibold transition-all hover:bg-[var(--color-secondary)] hover:bg-opacity-10 disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-1"
                >
                    Nazad
                </button>
            )}
            <button
                onClick={onClick}
                disabled={disabled || loading}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold transition-all hover:opacity-90 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none disabled:cursor-not-allowed order-1 sm:order-2"
            >
                {loading ? 'Učitavanje...' : text}
            </button>
        </div>
    );
}
