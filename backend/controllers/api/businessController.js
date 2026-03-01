import Business  from '../../models/Business.js';
import UserBusiness from '../../models/UserBusiness.js';
import Invitation from '../../models/Invitation.js';
import { ERRORS } from '../../utils/errors.js';

export const BusinessController = {
  
  // POST /api/v1/business - Create new business
  create: async (req, res, next) => {
    try {
      // 1. Extract data from request
      const { name, business_type_id, phone, email, address, city, post_code, country_id } = req.body;
      const userId = req.session.userId; // Iz session-a (authMiddleware već provjeri)
      
      // 2. Validation (dodatna layer, model također validira)
      if (!name || name.trim() === '') {
        throw ERRORS.VALIDATION('Business name is required');
      }
      
      if (!business_type_id) {
        throw ERRORS.VALIDATION('Business type is required');
      }
      
      // 3. Create business
      const business = await Business.create({
        name: name.trim(),
        business_type_id,
        owner_user_id: userId,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        post_code: post_code || null,
        country_id: country_id || null
      });
      
      // 4. Add owner to user_business table (relationship)
      await UserBusiness.create(userId, business, 'owner');
      
      // 5. Auto-generate permanent invitation
      const invite = await Invitation.createPermanent({ 
        businessId: business, 
        createdBy: userId, 
        role: 'employee' 
      });

      // 6. Response
      res.status(201).json({
        success: true,
        message: 'Business created successfully',
        data: {
          businessId: business,
          name: name,
          invite: {
            code: invite.code,
            token: invite.token
          }
        }
      });
      
    } catch (error) {
      next(error); // Forward to error handler
    }
  },
  
  // GET /api/v1/business/my - Get all businesses for logged user
  getMyBusinesses: async (req, res, next) => {
    try {
      const userId = req.session.userId;
      
      // Get businesses
      const businesses = await UserBusiness.getUserBusinesses(userId);
      
      res.status(200).json({
        success: true,
        data: businesses
      });
      
    } catch (error) {
      next(error);
    }
  },
  
  // GET /api/v1/business/:id - Get business details
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      // Security: Check da user ima pristup businessu
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      if (!hasAccess) {
        throw ERRORS.FORBIDDEN('You do not have access to this business');
      }
      
      // Get business
      const business = await Business.getById(id);
      
      if (!business) {
        throw ERRORS.NOT_FOUND('Business not found');
      }
      
      res.status(200).json({
        success: true,
        data: business
      });
      
    } catch (error) {
      next(error);
    }
  },
  
  // PUT /api/v1/business/:id - Update business
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      const { name, phone, email, address, city, post_code, country_id } = req.body;
      
      // Security: Check da user ima pristup businessu
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      if (!hasAccess) {
        throw ERRORS.FORBIDDEN('You do not have access to this business');
      }
      
      // Update business
      const updated = await Business.update(id, {
        name,
        phone,
        email,
        address,
        city,
        post_code,
        country_id
      });
      
      if (!updated) {
        throw ERRORS.NOT_FOUND('Business not found');
      }
      
      res.status(200).json({
        success: true,
        message: 'Business updated successfully'
      });
      
    } catch (error) {
      next(error);
    }
  },
  getTeam: async (req, res, next) => {
    try {
      const { businessId } = req.params;
      const userId = req.session.userId;
      
      // Security: Check da user ima pristup businessu
      const hasAccess = await UserBusiness.checkAccess(userId, businessId);
      if (!hasAccess) {
        throw ERRORS.FORBIDDEN('You do not have access to this business');
      }
      
      // Get team members
      const team = await UserBusiness.getBusinessUsers(businessId);
      
      res.status(200).json({
        success: true,
        data: team
      });
      
    } catch (error) {
      next(error);
    }
  }
  
};

export default BusinessController;