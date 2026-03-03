import Invitation from '../../models/Invitation.js';
import UserBusiness from '../../models/UserBusiness.js';
import Business from '../../models/Business.js';
import User from '../../models/User.js';
import { ERRORS } from '../../utils/errors.js';
import { sendEmail } from '../../utils/emailService.js';

const InvitationController = {
    // POST /api/v1/invitations/validate
    validate: async (req, res, next) => {
        try {
            const { code } = req.body;
            if (!code) throw ERRORS.VALIDATION('Invite code is required');

            const invite = await Invitation.findByCode(code);
            if (!invite) throw ERRORS.NOT_FOUND('INVITE_NOT_FOUND');
            
            // Check expiry if needed (we are using permanent for now, but good to have)
            if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
                throw ERRORS.VALIDATION('INVITE_EXPIRED');
            }

            res.status(200).json({
                success: true,
                invite: {
                    businessName: invite.business_name,
                    role: invite.role,
                    token: invite.token
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/v1/invitations/join
    join: async (req, res, next) => {
        try {
            const { token } = req.body;
            const userId = req.session.userId;

            if (!token) throw ERRORS.VALIDATION('Token is required');

            const invite = await Invitation.findByToken(token);
            if (!invite) throw ERRORS.NOT_FOUND('INVITE_NOT_FOUND');

            // Check if already a member
            const existingMember = await UserBusiness.findByUserAndBusiness(userId, invite.business_id);
            if (existingMember) throw ERRORS.CONFLICT('ALREADY_MEMBER');

            // Join business
            await UserBusiness.create(userId, invite.business_id, invite.role);
            
            // Update usage
            await Invitation.incrementUsedCount(invite.id);

            res.status(200).json({ success: true, message: 'Joined successfully' });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/v1/invitations/regenerate
    regenerate: async (req, res, next) => {
        try {
            const { businessId } = req.body;
            const userId = req.session.userId;

            if (!businessId) throw ERRORS.VALIDATION('Business ID is required');

            // Security: Check if user is owner or admin of the business
            const membership = await UserBusiness.findByUserAndBusiness(userId, businessId);
            if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
                throw ERRORS.FORBIDDEN('You do not have permission to regenerate invite codes for this business');
            }

            // Deactivate old codes
            await Invitation.deactivateAllForBusiness(businessId);

            // Generate new code (default 48h expiry)
            const newInvite = await Invitation.create({
                businessId,
                createdBy: userId,
                role: 'employee'
            });

            res.status(200).json({
                success: true,
                message: 'New invite code generated successfully',
                data: {
                    code: newInvite.code,
                    token: newInvite.token,
                    expires_at: newInvite.expires_at
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /join/:token (Public link)
    handlePublicLink: async (req, res, next) => {
        try {
            const { token } = req.params;
            const invite = await Invitation.findByToken(token);

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

            if (!invite) {
                return res.redirect(`${frontendUrl}/invite-invalid`);
            }

            // Save token to session for later (after login/register)
            req.session.pendingInviteToken = token;

            if (req.session.authenticated) {
                // Already logged in, try to join immediately
                const userId = req.session.userId;
                const existingMember = await UserBusiness.findByUserAndBusiness(userId, invite.business_id);
                
                if (!existingMember) {
                    await UserBusiness.create(userId, invite.business_id, invite.role);
                    await Invitation.incrementUsedCount(invite.id);
                    
                    // Add success flash message
                    req.session.flash = { 
                        type: 'success', 
                        message: `Successfully joined ${invite.business_name}!` 
                    };
                } else {
                    // Add info flash message
                    req.session.flash = { 
                        type: 'info', 
                        message: `You are already a member of ${invite.business_name}.` 
                    };
                }
                
                return res.redirect(`${frontendUrl}/dashboard`);
            }

            // Not logged in, redirect to register
            res.redirect(`${frontendUrl}/register?invite=${token}`);
        } catch (error) {
            next(error);
        }
    },

};

export default InvitationController;
