import React from 'react';
import { t } from '../translations';
import { User } from 'lucide-react';

export default function StaffStep({ state, actions }) {
    const { team, selectedStaff } = state;

    return (
        <div className="flex flex-col w-full pb-8">
            <h2 className="text-2xl font-heading font-bold mb-6 text-[var(--color-text)]">
                {t.stepStaff || 'Odaberi zaposlenika'}
            </h2>
            
            <div className="flex flex-col gap-3">
                {/* "Bilo tko" (Anyone) option. Using a dummy object for sticky CTA context. */}
                <button
                    onClick={() => actions.setStaff({ id: 'any', name: t.anyStaff || 'Bilo koji zaposlenik' })}
                    className={`p-4 min-h-[72px] rounded-2xl cursor-pointer transition-all border-2 flex items-center gap-4 bg-white text-left select-none ${
                        selectedStaff?.id === 'any'
                        ? 'border-[var(--color-primary)] shadow-sm bg-[var(--color-primary)]/[0.03]' 
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                >
                    <div className="w-12 h-12 rounded-full text-gray-500 bg-gray-100 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 opacity-80" />
                    </div>
                    <div className="font-bold text-base text-gray-900">{t.anyStaff || 'Bilo koji zaposlenik'}</div>
                </button>

                {/* Team members */}
                {team.map((member) => {
                    const isSelected = selectedStaff?.id === member.id;
                    return (
                        <button
                            key={member.id}
                            onClick={() => actions.setStaff(member)}
                            className={`p-4 min-h-[72px] rounded-2xl cursor-pointer transition-all border-2 flex items-center gap-4 bg-white text-left select-none ${
                                isSelected 
                                ? 'border-[var(--color-primary)] shadow-sm bg-[var(--color-primary)]/[0.03]' 
                                : 'border-gray-100 hover:border-gray-300'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-full border border-[var(--color-primary)] border-opacity-20 bg-[var(--color-secondary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-lg shrink-0">
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="font-bold text-base text-gray-900">{member.name}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
