import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';
import { useNavigate, Link, useLocation } from 'react-router-dom';

function Header() {
    const { user, businesses, logout, checkSession } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleSwitch = async (e) => {
        const businessId = e.target.value;
        if (!businessId) return;

        try {
            const res = await api.selectBusiness(businessId);
            if (res.success) {
                toast.success('Switched business');
                await checkSession();
                navigate(res.data.redirectTo);
            }
        } catch (err) {
            toast.error('Switch failed');
        }
    };

    return (
        <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 20px',
            background: '#343a40',
            color: 'white'
        }}>
            <div style={{ fontWeight: 'bold', fontSize: '20px' }}>
                BookingApp
            </div>

            <nav style={{ display: 'flex', gap: '20px' }}>
                {['owner', 'admin'].includes(user?.role) && (
                    <Link
                        to="/dashboard"
                        style={{
                            color: 'white',
                            textDecoration: location.pathname === '/dashboard' ? 'underline' : 'none',
                            fontWeight: location.pathname === '/dashboard' ? 'bold' : 'normal'
                        }}
                    >
                        Dashboard
                    </Link>
                )}
                {user?.activeBusinessId && (
                    <Link
                        to="/appointments"
                        style={{
                            color: 'white',
                            textDecoration: location.pathname === '/appointments' ? 'underline' : 'none',
                            fontWeight: location.pathname === '/appointments' ? 'bold' : 'normal'
                        }}
                    >
                        Appointments
                    </Link>
                )}
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {businesses.length > 0 && (
                    <select
                        value={user?.activeBusinessId || ''}
                        onChange={handleSwitch}
                        style={{
                            padding: '5px',
                            borderRadius: '4px',
                            background: '#495057',
                            color: 'white',
                            border: '1px solid #6c757d'
                        }}
                    >
                        <option value="" disabled>Select Business</option>
                        {businesses.map(biz => (
                            <option key={biz.business_id} value={biz.business_id}>
                                {biz.business_name} ({biz.role})
                            </option>
                        ))}
                    </select>
                )}

                <div style={{ fontSize: '14px' }}>
                    {user?.email}
                </div>

                <button
                    onClick={logout}
                    style={{
                        padding: '5px 10px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Logout
                </button>
            </div>
        </header>
    );
}

export default Header;
