import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';

function MyBusinesses() {
    const { user, checkSession } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBusinesses = async () => {
            try {
                const res = await api.getMyBusinesses();
                if (res.success) {
                    setBusinesses(res.data);

                    // If 1 business and not selected, we could auto-select, 
                    // but login already does this. This page is usually for multiple.
                    if (res.data.length === 1 && !user?.activeBusinessId) {
                        handleSelect(res.data[0].business_id);
                    }
                }
            } catch (err) {
                toast.error('Failed to load businesses');
            } finally {
                setLoading(false);
            }
        };
        fetchBusinesses();
    }, []);

    const handleSelect = async (businessId) => {
        try {
            const res = await api.selectBusiness(businessId);
            if (res.success) {
                toast.success('Business context switched');
                await checkSession(); // Refresh auth state with new business context
                navigate(res.data.redirectTo);
            }
        } catch (err) {
            toast.error(err.message || 'Selection failed');
        }
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

    return (
        <div style={{ padding: '50px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <h1>Choose Business</h1>
            <p>Select the business you want to manage right now:</p>

            <div style={{ display: 'grid', gap: '15px', marginTop: '30px' }}>
                {businesses.map(biz => (
                    <div
                        key={biz.business_id}
                        onClick={() => handleSelect(biz.business_id)}
                        style={{
                            padding: '20px',
                            background: user?.activeBusinessId === biz.business_id ? '#e9ecef' : 'white',
                            border: '2px solid #007bff',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'transform 0.1s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#333' }}>{biz.business_name}</div>
                            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                                Role: <span style={{ fontWeight: 'bold', color: '#007bff' }}>{biz.role}</span>
                            </div>
                        </div>
                        <div style={{ background: '#007bff', color: 'white', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Enter &rarr;
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default MyBusinesses;
