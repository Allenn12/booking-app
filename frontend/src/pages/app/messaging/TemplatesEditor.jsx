import React, { useState, useRef } from 'react';
import { toast } from 'sonner';

const DEFAULT_TEMPLATES = {
    confirmation: 'Poštovani/a {ime}, vaš termin za {usluga} je potvrđen za {vrijeme}. {biznis}',
    reminder: 'Podsjetnik: sutra u {vrijeme} imate zakazan termin za {usluga} kod {radnik}. {biznis}',
    cancellation: 'Obavijest: vaš termin za {usluga} ({vrijeme}) je otkazan. Javite nam se za novi termin. {biznis}'
};

const TAB_CONFIG = {
    confirmation: { label: 'Potvrda', icon: '✅' },
    reminder: { label: 'Podsjetnik', icon: '⏰' },
    cancellation: { label: 'Otkazivanje', icon: '❌' }
};

const VARIABLES = [
    { key: '{ime}', label: 'Ime', preview: 'Ana Marić' },
    { key: '{vrijeme}', label: 'Vrijeme', preview: '10:00, 15.03.2026.' },
    { key: '{usluga}', label: 'Usluga', preview: 'Šišanje' },
    { key: '{radnik}', label: 'Radnik', preview: 'Marko' },
    { key: '{biznis}', label: 'Biznis', preview: 'Salon Lucija' }
];

function TemplatesEditor() {
    const [activeTab, setActiveTab] = useState('confirmation');
    const [templates, setTemplates] = useState({ ...DEFAULT_TEMPLATES });
    const [senderName, setSenderName] = useState('SalonLucija');
    const textareaRef = useRef(null);

    const currentContent = templates[activeTab];

    const updateTemplate = (value) => {
        setTemplates(prev => ({ ...prev, [activeTab]: value }));
    };

    const insertVariable = (variable) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = currentContent.substring(0, start);
        const after = currentContent.substring(end);
        const newContent = before + variable + after;

        updateTemplate(newContent);

        // Restore cursor position after React re-render
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + variable.length;
            textarea.focus();
        }, 0);
    };

    const resetToDefault = () => {
        updateTemplate(DEFAULT_TEMPLATES[activeTab]);
        toast.success('Predložak vraćen na zadano');
    };

    const handleSave = () => {
        toast.success('Predlošci spremljeni!');
    };

    // Render preview: replace variables with mock data
    const renderPreview = (text) => {
        let rendered = text;
        VARIABLES.forEach(v => {
            rendered = rendered.replaceAll(v.key, v.preview);
        });
        return rendered;
    };

    // Character count and SMS segment calculation
    const charCount = currentContent.length;
    const segments = charCount <= 160 ? 1 : Math.ceil(charCount / 153); // Concatenated SMS uses 153 chars/segment
    const maxInSegment = segments === 1 ? 160 : segments * 153;

    return (
        <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Page Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', color: '#1a1a2e', fontWeight: '700' }}>
                    ✏️ Predlošci poruka
                </h1>
                <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                    Uredite tekst automatskih SMS poruka. Promjene se primjenjuju na sve buduće poruke.
                </p>
            </div>

            {/* Two-column layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 340px',
                gap: '28px',
                alignItems: 'start'
            }}>
                {/* ═══ LEFT: Editor ═══ */}
                <div>
                    {/* Tab Navigation */}
                    <div style={{
                        display: 'flex', gap: '0',
                        marginBottom: '0', borderBottom: '2px solid #e9ecef',
                        background: 'white', borderRadius: '12px 12px 0 0',
                        overflow: 'hidden'
                    }}>
                        {Object.entries(TAB_CONFIG).map(([key, cfg]) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                style={{
                                    flex: 1, padding: '14px 16px',
                                    background: activeTab === key ? 'white' : '#fafbfc',
                                    border: 'none',
                                    borderBottom: activeTab === key ? '3px solid #0d6efd' : '3px solid transparent',
                                    cursor: 'pointer',
                                    fontWeight: activeTab === key ? '700' : '500',
                                    fontSize: '14px',
                                    color: activeTab === key ? '#0d6efd' : '#666',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {cfg.icon} {cfg.label}
                            </button>
                        ))}
                    </div>

                    {/* Template Editor Card */}
                    <div style={{
                        background: 'white', borderRadius: '0 0 12px 12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        padding: '24px'
                    }}>
                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={currentContent}
                            onChange={e => updateTemplate(e.target.value)}
                            rows={5}
                            style={{
                                width: '100%', padding: '14px',
                                borderRadius: '10px', border: '1px solid #ddd',
                                fontSize: '15px', lineHeight: '1.6',
                                boxSizing: 'border-box', resize: 'none',
                                fontFamily: 'inherit', outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = '#0d6efd'}
                            onBlur={e => e.target.style.borderColor = '#ddd'}
                        />

                        {/* Character counter */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            marginTop: '8px', fontSize: '13px'
                        }}>
                            <span style={{
                                color: segments > 1 ? '#e67700' : '#888'
                            }}>
                                {charCount} / {maxInSegment} znakova ({segments} SMS{segments > 1 ? '-a' : ''})
                            </span>
                            <button
                                onClick={resetToDefault}
                                style={{
                                    background: 'none', border: 'none',
                                    color: '#0d6efd', cursor: 'pointer',
                                    fontSize: '13px', textDecoration: 'underline'
                                }}
                            >
                                Vrati na zadano
                            </button>
                        </div>

                        {/* Variable Chips */}
                        <div style={{ marginTop: '18px' }}>
                            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Varijable — kliknite za umetanje
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {VARIABLES.map(v => (
                                    <button
                                        key={v.key}
                                        onClick={() => insertVariable(v.key)}
                                        style={{
                                            padding: '6px 14px',
                                            background: '#f0f4ff',
                                            border: '1px solid #c7d2fe',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#4338ca',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = '#e0e7ff';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = '#f0f4ff';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        {v.key}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <button
                            onClick={handleSave}
                            style={{
                                padding: '12px 32px',
                                background: 'linear-gradient(135deg, #0d6efd, #6366f1)',
                                color: 'white', border: 'none', borderRadius: '8px',
                                fontWeight: '600', fontSize: '15px', cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(13,110,253,0.3)'
                            }}
                        >
                            Spremi predloške
                        </button>
                    </div>
                </div>

                {/* ═══ RIGHT: Phone Preview ═══ */}
                <div style={{ position: 'sticky', top: '30px' }}>
                    <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Pregled poruke
                    </div>

                    {/* Phone Frame */}
                    <div style={{
                        width: '100%', maxWidth: '320px',
                        background: '#1a1a2e',
                        borderRadius: '32px',
                        padding: '12px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.25), inset 0 0 0 2px #333'
                    }}>
                        {/* Phone screen */}
                        <div style={{
                            background: '#f5f5f5',
                            borderRadius: '22px',
                            overflow: 'hidden',
                            minHeight: '420px',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Status bar */}
                            <div style={{
                                background: '#fff',
                                padding: '8px 16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#1a1a2e'
                            }}>
                                <span>9:41</span>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px' }}>📶</span>
                                    <span style={{ fontSize: '10px' }}>🔋</span>
                                </div>
                            </div>

                            {/* Message header */}
                            <div style={{
                                background: '#fff',
                                padding: '12px 16px',
                                borderBottom: '1px solid #e9ecef',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <div style={{
                                    width: '36px', height: '36px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #0d6efd, #6366f1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '14px', fontWeight: '700'
                                }}>
                                    {(senderName || 'B').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#1a1a2e' }}>
                                        {senderName || 'BookingApp'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#999' }}>SMS poruka</div>
                                </div>
                            </div>

                            {/* Message area */}
                            <div style={{ flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                {/* Chat bubble */}
                                <div style={{
                                    background: '#fff',
                                    borderRadius: '16px 16px 16px 4px',
                                    padding: '14px 16px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    maxWidth: '95%',
                                    lineHeight: '1.5',
                                    fontSize: '14px',
                                    color: '#1a1a2e',
                                    wordBreak: 'break-word'
                                }}>
                                    {renderPreview(currentContent)}
                                </div>
                                <div style={{ fontSize: '11px', color: '#999', marginTop: '6px', paddingLeft: '4px' }}>
                                    Upravo sada
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Segment info below phone */}
                    <div style={{
                        marginTop: '14px', padding: '10px 14px',
                        background: segments > 1 ? '#fff7ed' : '#f0fdf4',
                        borderRadius: '8px', fontSize: '12px', lineHeight: '1.5',
                        color: segments > 1 ? '#9a3412' : '#166534',
                        border: segments > 1 ? '1px solid #fed7aa' : '1px solid #bbf7d0'
                    }}>
                        {segments > 1
                            ? `⚠️ Ova poruka koristi ${segments} SMS segmenta (${charCount} znakova). Svaki segment troši 1 kredit.`
                            : `✅ Ova poruka stane u 1 SMS (${charCount}/160 znakova). Troši 1 kredit.`
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TemplatesEditor;
