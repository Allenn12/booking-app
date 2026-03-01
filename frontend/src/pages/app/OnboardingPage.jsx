import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';

const OnboardingPage = () => {
    const [view, setView] = useState('CHOICE'); // CHOICE, CREATE, JOIN, CONFIRM
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [inviteData, setInviteData] = useState(null);
    const { checkSession } = useAuth();
    const navigate = useNavigate();

    // Form states
    const [businessForm, setBusinessForm] = useState({
        name: '',
        business_type_id: '1', // Default to first type
        address: ''
    });
    const [inviteCode, setInviteCode] = useState('');

    const handleCreateBusiness = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await api.createBusiness(businessForm);
            if (res.success) {
                await checkSession();
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleValidateCode = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.validateInvite(inviteCode);
            if (res.success) {
                setInviteData(res.invite);
                setView('CONFIRM');
            }
        } catch (err) {
            setError(err.message === 'INVITE_NOT_FOUND' ? 'Invalid invite code' : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinBusiness = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.joinBusiness(inviteData.token);
            if (res.success) {
                await checkSession();
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="onboarding-container" style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            {view === 'CHOICE' && (
                <div>
                    <h1>Welcome! How would you like to start?</h1>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '40px' }}>
                        <button
                            onClick={() => setView('CREATE')}
                            style={{ padding: '20px', cursor: 'pointer', flex: 1, fontSize: '18px' }}
                        >
                            Create My Business
                        </button>
                        <button
                            onClick={() => setView('JOIN')}
                            style={{ padding: '20px', cursor: 'pointer', flex: 1, fontSize: '18px' }}
                        >
                            Join a Team
                        </button>
                    </div>
                </div>
            )}

            {view === 'CREATE' && (
                <form onSubmit={handleCreateBusiness} style={{ textAlign: 'left' }}>
                    <h2>Create Your Business</h2>
                    <div style={{ marginBottom: '15px' }}>
                        <label>Business Name*</label>
                        <input
                            type="text"
                            required
                            value={businessForm.name}
                            onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label>Business Type</label>
                        <select
                            value={businessForm.business_type_id}
                            onChange={(e) => setBusinessForm({ ...businessForm, business_type_id: e.target.value })}
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        >
                            <option value="1">Hair Salon</option>
                            <option value="2">Dental Center</option>
                            <option value="3">Nail & Cosmetics</option>
                            <option value="4">Other</option>
                        </select>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label>Address</label>
                        <input
                            type="text"
                            value={businessForm.address}
                            onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        />
                    </div>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                            {loading ? 'Creating...' : 'Create Business'}
                        </button>
                        <button type="button" onClick={() => setView('CHOICE')} style={{ padding: '10px 20px' }}>Cancel</button>
                    </div>
                </form>
            )}

            {view === 'JOIN' && (
                <div style={{ textAlign: 'left' }}>
                    <h2>Join a Team</h2>
                    <p>Enter the invite code provided by your manager.</p>
                    <div style={{ marginBottom: '20px' }}>
                        <input
                            type="text"
                            placeholder="ABC-12345 or Business Name"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            style={{ width: '100%', padding: '12px', fontSize: '18px', textAlign: 'center' }}
                        />
                    </div>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                            onClick={handleValidateCode}
                            disabled={loading || !inviteCode.trim()}
                            style={{ padding: '10px 20px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none' }}
                        >
                            {loading ? 'Checking...' : 'Check Code'}
                        </button>

                        <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                                <strong>Don't have a code?</strong><br />
                                Please contact your business manager to get an invite link or code.
                            </p>
                        </div>

                        <button type="button" onClick={() => setView('CHOICE')} style={{ padding: '10px 20px', marginTop: '10px' }}>Back</button>
                    </div>
                </div>
            )}

            {view === 'CONFIRM' && inviteData && (
                <div>
                    <h2>Confirm Join</h2>
                    <p>You are joining: <strong>{inviteData.businessName}</strong></p>
                    <p>Role: {inviteData.role}</p>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '30px' }}>
                        <button
                            onClick={handleJoinBusiness}
                            disabled={loading}
                            style={{ padding: '10px 30px', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                            {loading ? 'Joining...' : 'Confirm'}
                        </button>
                        <button
                            onClick={() => setView('JOIN')}
                            style={{ padding: '10px 30px', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardingPage;
