import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';

const CreateJoinBusiness = () => {
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

    const [jobs, setJobs] = useState([]);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await api.getJobs();
                if (res.success) {
                    setJobs(res.data);
                    if (res.data.length > 0) {
                        setBusinessForm(prev => ({ ...prev, business_type_id: res.data[0].id.toString() }));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch jobs", err);
            }
        };
        fetchJobs();
    }, []);

    const handleCreateBusiness = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await api.createBusiness(businessForm);
            if (res.success) {
                toast.success('Business created successfully!');
                await api.selectBusiness(res.data.businessId);
                await checkSession();
                navigate('/business/overview');
            }
        } catch (err) {
            setError(err.message);
            toast.error(err.message || 'Failed to create business');
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
            const msg = err.message === 'INVITE_NOT_FOUND' ? 'Invalid invite code' : err.message;
            setError(msg);
            toast.error(msg);
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
                toast.success(`Successfully joined ${inviteData.businessName}!`);
                await api.selectBusiness(res.data.businessId);
                await checkSession();
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message);
            toast.error(err.message || 'Failed to join business');
        } finally {
            setLoading(false);
        }
    };

    const handleInviteCodeChange = (e) => {
        // Remove all non-alphanumeric characters and convert to uppercase
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Add hyphen after first 3 characters
        if (value.length > 3) {
            value = value.substring(0, 3) + '-' + value.substring(3);
        }

        setInviteCode(value);
    };

    return (
        <div className="onboarding-container" style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            {view === 'CHOICE' && (
                <div>
                    <h1>How would you like to start?</h1>
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
                            required
                            value={businessForm.business_type_id}
                            onChange={(e) => setBusinessForm({ ...businessForm, business_type_id: e.target.value })}
                            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        >
                            {jobs.map(job => (
                                <option key={job.id} value={job.id}>{job.name}</option>
                            ))}
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
                            placeholder="ABC-12345"
                            maxLength={9}
                            value={inviteCode}
                            onChange={handleInviteCodeChange}
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

export default CreateJoinBusiness;
