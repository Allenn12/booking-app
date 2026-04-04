import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useBookingState } from './useBookingState';
import { t } from './translations';
import BookingFlow from './components/PublicBookingFlow';
import ServiceStep from './components/ServiceStep';
import StaffStep from './components/StaffStep';
import DateTimeStep from './components/DateTimeStep';
import ContactStep from './components/ContactStep';
import ConfirmStep from './components/ConfirmStep';
import SuccessStep from './components/SuccessStep';

/* 
 * ============================================================================
 * STEP 1: UX AUDIT OF CURRENT STATE (vs. Lime Booking / Industry Standard)
 * ============================================================================
 * 
 * 1. Current Steps: Service -> Staff -> DateTime -> Contact -> Confirm -> Success.
 * 
 * 2. Missing UX Elements:
 *    - No progressive visual indicator (e.g., progress bar "Step 1 of 5") at the top.
 *    - No slide left/right animations between steps; transitions are abrupt or use basic fade.
 *    - No global Sticky CTA at the bottom. Currently, each step defines its own "Next" button 
 *      at the bottom of its layout. Lime has a sticky floating bottom bar with a summary.
 *    - Loading states use a standard spinner instead of skeleton loaders matching the card layout.
 *    - Error states are just simple red banners or blocks, lacking inline polished feedback.
 * 
 * 3. Mobile-Unfriendly Components:
 *    - The overarching layout (BookingLayout) uses a Sidebar on desktop and stacks on mobile.
 *      On mobile, the sidebar is just pushed to the bottom, which breaks the "sticky CTA" paradigm.
 *    - The page has multiple scroll regions instead of a single document scroll.
 *    - Missing safe area insets for notched devices.
 *    - Some tap targets (like arrows or small text links) are under 44x44px.
 * 
 * 4. Potential Drop-off Points:
 *    - Loading screens (spinner) can cause perceived slow performance.
 *    - Not knowing how many steps remain (no progress bar).
 *    - Getting lost when clicking "Back" if the state is improperly maintained.
 *    - Contact form lacking auto-complete or clear inline validation.
 * ============================================================================
 */

// Fallback steps for now until they are built in later tasks
const PlaceholderStep = ({ title }) => <div className="p-8 text-center text-[var(--color-primary)] font-medium bg-[var(--color-secondary)]/10 rounded-xl border border-[var(--color-secondary)]/20">{title}</div>;

export default function PublicBookingPage() {
    const { slug } = useParams();
    const { state, actions } = useBookingState(slug);

    if (state.loading) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center font-body">
                <div className="animate-spin w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (state.error && !state.business) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4 font-body">
                <div className="bg-white p-8 rounded-2xl shadow-[var(--shadow-md)] max-w-md w-full text-center border border-gray-100">
                    <div className="text-4xl mb-4">🔗</div>
                    <h2 className="text-2xl font-heading font-bold text-[var(--color-text)] mb-2">{t.invalidLink}</h2>
                    <p className="text-gray-500">{state.error}</p>
                </div>
            </div>
        );
    }

    if (state.bookingDisabled) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4 font-body">
                <div className="bg-white p-8 rounded-2xl shadow-[var(--shadow-md)] max-w-md w-full text-center border border-gray-100">
                    <div className="text-4xl mb-4">🔒</div>
                    <h2 className="text-2xl font-heading font-bold text-[var(--color-text)] mb-2">{state.business?.name}</h2>
                    <p className="text-gray-500">{t.bookingDisabled}</p>
                </div>
            </div>
        );
    }

    if (state.step === 6) {
        return (
            <BookingFlow state={state} actions={actions}>
               <SuccessStep state={state} actions={actions} />
            </BookingFlow>
        );
    }

    return (
        <>
            <Helmet>
                <title>{state.business.name} | Online Booking</title>
                <meta name="description" content={state.business.description || `Book your appointment at ${state.business.name} online.`} />
            </Helmet>
            
            {state.error && (
                <div className="fixed top-20 left-4 right-4 z-[200] p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 flex justify-between items-center text-sm font-medium shadow-lg">
                    <span>{state.error}</span>
                    <button onClick={actions.clearError} className="opacity-70 hover:opacity-100 text-lg">&times;</button>
                </div>
            )}

            <BookingFlow state={state} actions={actions} />
        </>
    );
}
