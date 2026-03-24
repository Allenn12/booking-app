import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../api/client';
import { toast } from 'sonner';
import { Copy, RefreshCw, Trash2, CalendarDays } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ScheduleModal } from '../../../components/scheduling/ScheduleModal';

function Team() {
    const { user } = useAuth();
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviteCode, setInviteCode] = useState('');
    const [inviteToken, setInviteToken] = useState('');
    const [generatingCode, setGeneratingCode] = useState(false);
    
    // Schedule Modal state
    const [businessHours, setBusinessHours] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);

    const isOwnerOrAdmin = ['owner', 'admin'].includes(user?.role);

    useEffect(() => {
        if (user?.activeBusinessId) {
            fetchTeamData();
            fetchInviteCode(user.activeBusinessId);
            fetchBusinessHours(user.activeBusinessId);
        }
    }, [user?.activeBusinessId]);

    const fetchBusinessHours = async (businessId) => {
        try {
            const res = await api.getBusinessById(businessId);
            if (res.success && res.data.business_hours) {
                setBusinessHours(res.data.business_hours);
            }
        } catch (err) {
            console.error('Failed to fetch business hours');
        }
    };

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
            if (res.success && res.data?.code) {
                setInviteCode(res.data.code);
                setInviteToken(res.data.token);
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

    const openSchedule = (member) => {
        setSelectedMember(member);
        setIsScheduleOpen(true);
    };

    const inviteLink = inviteToken ? `${window.location.origin}/onboarding?token=${inviteToken}` : '';

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading team members...</div>;

    return (
        <div className="max-w-5xl mx-auto bg-card p-8 rounded-xl shadow-sm border">
            
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-foreground m-0">Team Management</h2>
            </div>

            {/* Invitation Section */}
            {isOwnerOrAdmin && (
                <div className="bg-muted/30 p-6 rounded-xl mb-8 border border-border">
                    <h3 className="text-lg font-semibold mt-0 mb-5">Invite New Members</h3>

                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-muted-foreground mb-2 block tracking-wider">
                                    INVITE LINK
                                </label>
                                <div className="flex shadow-sm rounded-md">
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteLink || 'Generating...'}
                                        className="flex-1 px-3 py-2 border border-r-0 border-input bg-muted text-sm rounded-l-md truncate focus:outline-none"
                                    />
                                    <Button
                                        variant="secondary"
                                        className="rounded-l-none border border-input shadow-none px-4"
                                        onClick={() => handleCopy(inviteLink, 'Invite Link')}
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copy Link
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-muted-foreground mb-2 block tracking-wider">
                                    INVITE CODE
                                </label>
                                <div className="flex shadow-sm rounded-md">
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteCode || 'Generating...'}
                                        className="flex-1 px-3 py-2 border border-r-0 border-input bg-muted text-sm font-bold text-center tracking-widest rounded-l-md focus:outline-none"
                                    />
                                    <Button
                                        variant="secondary"
                                        className="rounded-l-none border border-input shadow-none px-4"
                                        onClick={() => handleCopy(inviteCode, 'Invite Code')}
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copy Code
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Button
                                variant="outline"
                                onClick={handleGenerateNewCode}
                                disabled={generatingCode}
                                className="text-primary border-primary hover:bg-primary/5"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${generatingCode ? 'animate-spin' : ''}`} />
                                {generatingCode ? 'Generating...' : 'Regenerate Code & Link'}
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2 mb-0">
                                Generating a new code will immediately invalidate the old link and code.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Members List */}
            <div>
                <h3 className="text-lg font-semibold mb-5">Current Members ({team.length})</h3>
                <div className="flex flex-col gap-3">
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
                                <div key={member.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-border rounded-lg bg-card hover:bg-muted/10 transition-colors gap-4">
                                    <div>
                                        <div className="font-bold text-base text-foreground">
                                            {member.user_first_name} {member.user_last_name}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {member.user_email}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        
                                        {/* Schedule Button */}
                                        {isOwnerOrAdmin && (
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openSchedule(member)}
                                                className="bg-background"
                                            >
                                                <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                                                Schedule
                                            </Button>
                                        )}

                                        {/* Role Badge / Selector */}
                                        <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
                                            {isCurrentUser ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground capitalize">
                                                    Role: {member.role} (You)
                                                </span>
                                            ) : (
                                                <>
                                                    {isOwnerOrAdmin && member.role !== 'owner' ? (
                                                        <select
                                                            value={member.role}
                                                            onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                                                            className="px-2 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                        >
                                                            <option value="admin">Admin</option>
                                                            <option value="employee">Employee</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                                                            member.role === 'owner' 
                                                                ? 'bg-primary text-primary-foreground' 
                                                                : 'bg-muted text-foreground'
                                                        }`}>
                                                            {member.role}
                                                        </span>
                                                    )}

                                                    {/* Remove Button */}
                                                    {isOwnerOrAdmin && member.role !== 'owner' && (
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => handleRemoveMember(member.user_id)}
                                                            className="h-8 w-8 ml-1"
                                                            title="Remove member"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Modals */}
            {selectedMember && (
                <ScheduleModal
                    isOpen={isScheduleOpen}
                    onClose={() => setIsScheduleOpen(false)}
                    userId={selectedMember.user_id}
                    userName={`${selectedMember.user_first_name} ${selectedMember.user_last_name}`}
                    businessId={user.activeBusinessId}
                    businessHours={businessHours}
                    isAdmin={isOwnerOrAdmin}
                />
            )}
        </div>
    );
}

export default Team;
