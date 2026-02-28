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
  }
  
};

export default TeamController;
