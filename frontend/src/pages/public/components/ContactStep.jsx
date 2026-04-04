import React, { useMemo } from 'react';
import { t } from '../translations';
import { motion } from 'framer-motion';

// Simple regex for basic validation
const PHONE_REGEX = /^\+?[0-9\s-]{8,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper to sanitize input (strips HTML/script tags)
const sanitize = (val) => {
    if (!val) return '';
    return val.toString().replace(/<[^>]*>?/gm, '').trim();
};

export default function ContactStep({ state, actions }) {
    const { contactParams } = state;
    
    // Real-time validation derived from state
    const validation = useMemo(() => {
        const fn = sanitize(contactParams.firstName);
        const ln = sanitize(contactParams.lastName);
        const ph = sanitize(contactParams.phone);
        const em = sanitize(contactParams.email);

        return {
            firstName: fn.length >= 2,
            lastName: ln.length >= 2,
            phone: PHONE_REGEX.test(ph),
            email: em === '' || EMAIL_REGEX.test(em),
            consent: contactParams.smsConsent === true
        };
    }, [contactParams]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const cleanValue = type === 'checkbox' ? checked : value;
        
        actions.updateContact({
            ...contactParams,
            [name]: cleanValue
        });
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const inputClasses = (isValid, isDirty) => `
        w-full px-4 py-3 rounded-2xl border-2 transition-all outline-none text-[16px]
        ${!isDirty 
            ? 'border-gray-100 bg-gray-50 focus:bg-white focus:border-[var(--color-primary)]' 
            : isValid 
                ? 'border-gray-100 bg-gray-50 focus:bg-white focus:border-[var(--color-primary)]'
                : 'border-red-100 bg-red-50 focus:bg-white focus:border-red-400'
        }
    `;

    return (
        <motion.div 
            className="flex flex-col w-full pb-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <motion.h2 variants={itemVariants} className="text-2xl font-heading font-bold mb-2 text-[var(--color-text)]">
                {t.stepContact || 'Vaši podaci'}
            </motion.h2>
            <motion.p variants={itemVariants} className="text-sm text-gray-500 mb-8 font-medium">
                Molimo unesite točne podatke kako bismo vas mogli obavijestiti o terminu.
            </motion.p>
            
            <div className="flex flex-col gap-6 max-w-xl">
                {/* Name Row */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                            {t.labelFirstName || 'Ime'} <span className="text-red-400">*</span>
                        </label>
                        <input 
                            type="text" 
                            name="firstName"
                            value={contactParams.firstName || ''}
                            onChange={handleChange}
                            className={inputClasses(validation.firstName, (contactParams.firstName || '').length > 0)}
                            placeholder="Ime"
                            autoComplete="given-name"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                            {t.labelLastName || 'Prezime'} <span className="text-red-400">*</span>
                        </label>
                        <input 
                            type="text" 
                            name="lastName"
                            value={contactParams.lastName || ''}
                            onChange={handleChange}
                            className={inputClasses(validation.lastName, (contactParams.lastName || '').length > 0)}
                            placeholder="Prezime"
                            autoComplete="family-name"
                        />
                    </div>
                </motion.div>

                {/* Phone */}
                <motion.div variants={itemVariants}>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                        {t.labelPhone || 'Broj mobitela'} <span className="text-red-400">*</span>
                    </label>
                    <input 
                        type="tel" 
                        name="phone"
                        value={contactParams.phone || ''}
                        onChange={handleChange}
                        className={inputClasses(validation.phone, (contactParams.phone || '').length > 0)}
                        placeholder="09X XXX XXXX"
                        autoComplete="tel"
                    />
                    {!validation.phone && (contactParams.phone || '').length > 3 && (
                        <span className="text-[10px] text-red-500 mt-1 ml-1 font-medium">Unesite ispravan format broja</span>
                    )}
                </motion.div>

                {/* Email */}
                <motion.div variants={itemVariants}>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                        {t.labelEmail || 'Email adresa (nije obavezno)'}
                    </label>
                    <input 
                        type="email" 
                        name="email"
                        value={contactParams.email || ''}
                        onChange={handleChange}
                        className={inputClasses(validation.email, (contactParams.email || '').length > 0)}
                        placeholder="vas@email.com"
                        autoComplete="email"
                    />
                </motion.div>

                {/* Notes (Napomena) */}
                <motion.div variants={itemVariants}>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                        Napomena (neobavezno)
                    </label>
                    <textarea 
                        name="notes"
                        rows="3"
                        value={contactParams.notes || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-[var(--color-primary)] transition-all outline-none text-[16px] resize-none"
                        placeholder="Imate li kakvu posebnu želju ili napomenu?"
                    />
                </motion.div>

                {/* Consent Card */}
                <motion.button 
                    variants={itemVariants}
                    type="button"
                    className={`flex flex-row items-start justify-start gap-4 p-5 rounded-2xl border-2 transition-all text-left focus:outline-none ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)]/20 ${contactParams.smsConsent ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20' : 'bg-white border-gray-100 hover:border-gray-200'}`} 
                    onClick={() => {
                        actions.updateContact({ ...contactParams, smsConsent: !contactParams.smsConsent });
                    }}
                >
                    <div className="shrink-0 mt-0.5">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${contactParams.smsConsent ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-gray-200 bg-white'}`}>
                            {contactParams.smsConsent && (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11.6667 3.5L5.25 9.91667L2.33333 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-bold text-gray-900 leading-tight">Pristanak na obavijesti</span>
                        <p className="text-[12px] font-medium text-gray-500 leading-relaxed">
                            {t.labelConsent || 'Pristajem na primanje sistemskih SMS i email obavijesti vezanih uz moj termin.'} <span className="text-red-500 font-bold">*</span>
                        </p>
                    </div>
                </motion.button>
            </div>
        </motion.div>
    );
}
