import UserBusiness from '../../models/UserBusiness.js';
import { ERRORS } from '../../utils/errors.js';

export const TeamController = {
  
  // GET /api/v1/business/:businessId/team
  getTeam: async (req, res, next) => {
    try {
      const { id } = req.params; // businessId
      const userId = req.session.userId;
      
      // Security: Check da user ima pristup businessu
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      if (!hasAccess) {
        throw ERRORS.FORBIDDEN('You do not have access to this business');
      }
      
      // Get team members
      const team = await UserBusiness.getBusinessUsers(id);
      
      res.status(200).json({
        success: true,
        data: team
      });
      
    } catch (error) {
      next(error);
    }
  },

  // PATCH /api/v1/business/:id/team/:userId/role
  updateRole: async (req, res, next) => {
    try {
      const { id, userId: targetUserId } = req.params;
      const { role: newRole } = req.body;
      const currentUserId = req.session.userId;

      // Ensure caller is owner or admin of business
      const membership = await UserBusiness.findByUserAndBusiness(currentUserId, id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ERRORS.FORBIDDEN('You must be an owner or admin to change roles');
      }

      await UserBusiness.updateRole(id, targetUserId, newRole);

      res.status(200).json({
        success: true,
        message: 'Member role updated successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/v1/business/:id/team/:userId
  removeMember: async (req, res, next) => {
    try {
      const { id, userId: targetUserId } = req.params;
      const currentUserId = req.session.userId;

      // Ensure caller is owner or admin of business
      const membership = await UserBusiness.findByUserAndBusiness(currentUserId, id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ERRORS.FORBIDDEN('You must be an owner or admin to remove members');
      }

      // Prevent removing self
      if (Number(currentUserId) === Number(targetUserId)) {
          throw ERRORS.FORBIDDEN('You cannot remove yourself. Leave the business instead.');
      }

      await UserBusiness.removeUser(id, targetUserId);

      res.status(200).json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
};

export default TeamController;
