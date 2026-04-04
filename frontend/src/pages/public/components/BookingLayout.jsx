import React from 'react';
import BookingHeader from './BookingHeader';
import BookingSidebar from './BookingSidebar';

export default function BookingLayout({ state, actions, children }) {
    return (
        <div className="min-h-screen bg-[var(--color-background)] font-body text-gray-800">
            <div className="h-4 sm:h-8"></div>
            
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 md:pb-12">
                <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 mb-6 border border-gray-100">
                    <BookingHeader business={state.business} hours={state.hours} />
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Main content area */}
                    <div className="flex-1 bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 border border-gray-100 min-w-0">
                        {children}
                    </div>

                    {/* Sidebar Area */}
                    <div className="w-full md:w-80 shrink-0">
                        <BookingSidebar state={state} onChangeStep={actions.goToStep} />
                    </div>
                </div>
            </div>
        </div>
    );
}
