import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../api/client';
import { toast } from 'sonner';

function Team() {
    const { user } = useAuth();
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviteCode, setInviteCode] = useState('');
    const [inviteToken, setInviteToken] = useState('');
    const [generatingCode, setGeneratingCode] = useState(false);

    const isOwnerOrAdmin = ['owner', 'admin'].includes(user?.role);

    useEffect(() => {
        if (user?.activeBusinessId) {
            fetchTeamData();
            fetchInviteCode(user.activeBusinessId);
        }
    }, [user?.activeBusinessId]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const res = await api.getBusinessTeam(user.activeBusinessId);
            if (res.success) {
                setTeam(res.data);
            }
        } catch (err) {
            toast.error('Failed to load team members');
        } finally {
            setLoading(false);
        }
    };

    // We get the invite info from getMyBusinesses since it's attached to the business object
    const fetchInviteCode = async (businessId) => {
        try {
            const res = await api.getMyBusinesses();
            if (res.success) {
                const currentBiz = res.data.find(b => b.business_id === Number(businessId));
                if (currentBiz) {
                    setInviteCode(currentBiz.invite_code);
                    setInviteToken(currentBiz.invite_token);
                }
            }
        } catch (err) {
            console.error('Failed to fetch business details for invite token');
        }
    }

    const handleGenerateNewCode = async () => {
        try {
            setGeneratingCode(true);
            const res = await api.regenerateInviteCode(user.activeBusinessId);
            if (res.success && res.data?.newInviteCode) {
                setInviteCode(res.data.newInviteCode);
                setInviteToken(res.data.newToken);
                toast.success('Successfully generated new invite code');
            }
        } catch (err) {
            toast.error(err.message || 'Failed to generate new code');
        } finally {
            setGeneratingCode(false);
        }
    };

    const handleCopy = (text, label) => {
        if (!text) {
            toast.error(`No ${label} available to copy`);
            return;
        }
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const handleRoleChange = async (targetUserId, newRole) => {
        try {
            const res = await api.updateTeamMemberRole(user.activeBusinessId, targetUserId, newRole);
            if (res.success) {
                toast.success('Role updated');
                fetchTeamData(); // Refresh list
            }
        } catch (err) {
            toast.error(err.message || 'Failed to update role');
        }
    };

    const handleRemoveMember = async (targetUserId) => {
        if (!window.confirm("Are you sure you want to remove this member?")) return;

        try {
            const res = await api.removeTeamMember(user.activeBusinessId, targetUserId);
            if (res.success) {
                toast.success('Member removed');
                fetchTeamData(); // Refresh list
            }
        } catch (err) {
            toast.error(err.message || 'Failed to remove member');
        }
    };

    const inviteLink = inviteToken ? `${window.location.origin}/onboarding?token=${inviteToken}` : '';


    if (loading) return <div>Loading team members...</div>;

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, color: '#333' }}>Team Management</h2>
            </div>

            {/* Invitation Section */}
            {isOwnerOrAdmin && (
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e9ecef' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Invite New Members</h3>

                    <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '5px', display: 'block' }}>INVITE LINK</label>
                                <div style={{ display: 'flex' }}>
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteLink || 'Generating...'}
                                        style={{ flex: 1, padding: '10px', borderRadius: '4px 0 0 4px', border: '1px solid #ccc', background: '#eee' }}
                                    />
                                    <button
                                        onClick={() => handleCopy(inviteLink, 'Invite Link')}
                                        style={{ padding: '10px 15px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}
                                    >
                                        Copy Link
                                    </button>
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '5px', display: 'block' }}>INVITE CODE</label>
                                <div style={{ display: 'flex' }}>
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteCode || 'Generating...'}
                                        style={{ flex: 1, padding: '10px', borderRadius: '4px 0 0 4px', border: '1px solid #ccc', background: '#eee', fontWeight: 'bold', textAlign: 'center', letterSpacing: '2px' }}
                                    />
                                    <button
                                        onClick={() => handleCopy(inviteCode, 'Invite Code')}
                                        style={{ padding: '10px 15px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}
                                    >
                                        Copy Code
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <button
                                onClick={handleGenerateNewCode}
                                disabled={generatingCode}
                                style={{ padding: '8px 15px', background: 'transparent', color: '#0d6efd', border: '1px solid #0d6efd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                            >
                                {generatingCode ? 'Generating...' : 'Regenerate Code & Link'}
                            </button>
                            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px', marginBottom: 0 }}>
                                Generating a new code will immediately invalidate the old link and code.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Members List */}
            <div>
                <h3 style={{ marginBottom: '15px' }}>Current Members ({team.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {team
                        .sort((a, b) => {
                            if (a.role === 'owner') return -1;
                            if (b.role === 'owner') return 1;
                            if (a.user_id === user?.id) return -1;
                            if (b.user_id === user?.id) return 1;
                            return 0; // maintain original relative order otherwise
                        })
                        .map(member => {
                            const isCurrentUser = member.user_id === user?.id;

                            return (
                                <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #e9ecef', borderRadius: '6px' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                                            {member.user_first_name} {member.user_last_name}
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#666' }}>
                                            {member.user_email}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        {/* Role Badge / Selector */}
                                        {isCurrentUser ? (
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                background: '#0d6efd',
                                                color: 'white',
                                                textTransform: 'capitalize'
                                            }}>
                                                Role: {member.role} (You)
                                            </span>
                                        ) : (
                                            <>
                                                {isOwnerOrAdmin && member.role !== 'owner' ? (
                                                    <select
                                                        value={member.role}
                                                        onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                                                        style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc', background: 'white' }}
                                                    >
                                                        <option value="admin">Admin</option>
                                                        <option value="employee">Employee</option>
                                                    </select>
                                                ) : (
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        background: member.role === 'owner' ? '#0d6efd' : '#e9ecef',
                                                        color: member.role === 'owner' ? 'white' : '#333',
                                                        textTransform: 'capitalize'
                                                    }}>
                                                        {member.role}
                                                    </span>
                                                )}

                                                {/* Remove Button */}
                                                {isOwnerOrAdmin && member.role !== 'owner' && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.user_id)}
                                                        style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

        </div>
    );
}

export default Team;
