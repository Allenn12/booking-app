import Business  from '../../models/Business.js';
import UserBusiness from '../../models/UserBusiness.js';
import Invitation from '../../models/Invitation.js';
import { ERRORS } from '../../utils/errors.js';
import pool from '../../config/database.js';

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
      
      // 5. Auto-generate invitation (default 48h)
      const invite = await Invitation.create({ 
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

      // Get hours
      const BusinessHour = (await import('../../models/BusinessHour.js')).default;
      const hours = await BusinessHour.getByBusinessId(id);
      business.business_hours = hours || [];
      
      res.status(200).json({
        success: true,
        data: business
      });
      
    } catch (error) {
      next(error);
    }
  },
  
  // PATCH /api/v1/business/:id - Update business
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      const { 
        name, phone, email, address, city, post_code, country_id, business_hours, allow_public_booking,
        sms_enabled, send_confirmation, send_reminder, send_cancellation
      } = req.body;
      
      // Security: Check da user ima pristup businessu
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      if (!hasAccess) {
        throw ERRORS.FORBIDDEN('You do not have access to this business');
      }
      
      // Update business details
      const updated = await Business.update(id, {
        name,
        phone,
        email,
        address,
        city,
        post_code,
        country_id,
        allow_public_booking,
        sms_enabled,
        send_confirmation,
        send_reminder,
        send_cancellation
      });
      
      if (!updated) {
        throw ERRORS.NOT_FOUND('Business not found');
      }

      // Update business hours if provided
      if (business_hours && Array.isArray(business_hours)) {
        const BusinessHour = (await import('../../models/BusinessHour.js')).default;
        await BusinessHour.updateForBusiness(id, business_hours);
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
      const { id } = req.params; // Using standard :id from route
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

  getServices: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      // Security: Check da user ima pristup businessu
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      if (!hasAccess) {
        throw ERRORS.FORBIDDEN('You do not have access to this business');
      }
      
      // Lazy load Service model to avoid circular logic
      const Service = (await import('../../models/Service.js')).default;
      const services = await Service.findByBusinessId(id);
      
      res.status(200).json({
        success: true,
        data: services
      });
      
    } catch (error) {
      next(error);
    }
  },

  // POST /api/v1/business/select
  selectBusiness: async (req, res, next) => {
    try {
      const { businessId } = req.body;
      const userId = req.session.userId;

      if (!businessId) throw ERRORS.VALIDATION('Business ID is required');

      // Verify user has access
      const membership = await UserBusiness.findByUserAndBusiness(userId, businessId);
      if (!membership) throw ERRORS.FORBIDDEN('You do not have access to this business');

      // Store in session
      req.session.activeBusinessId = Number(businessId);
      req.session.role = membership.role;

      const redirectTo = (membership.role === 'owner' || membership.role === 'admin') ? "/dashboard" : "/appointments";

      req.session.save((err) => {
        if (err) return next(err);
        res.status(200).json({
          success: true,
          message: 'Business selected',
          data: {
            businessId,
            role: membership.role,
            redirectTo
          }
        });
      });
    } catch (error) {
      next(error);
    }
  },

  getBilling: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      const UserBusiness = (await import('../../models/UserBusiness.js')).default;
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      if (!hasAccess) {
        throw ERRORS.FORBIDDEN('You do not have access to this business');
      }

      // Fetch logs
      const [logs] = await pool.query(`
        SELECT l.id, DATE_FORMAT(l.sent_at, '%Y-%m-%d %H:%i') as date, 
               COALESCE(c.name, 'Nepoznato') as client, l.recipient_phone as phone,
               l.notification_type as type, l.status, l.message_text as message, l.failed_reason as error
        FROM notification_logs l
        LEFT JOIN clients c ON c.phone = l.recipient_phone COLLATE utf8mb4_unicode_ci AND c.business_id = ?
        WHERE l.business_id = ?
        ORDER BY l.sent_at DESC
        LIMIT 100
      `, [id, id]);

      // Calculate credits spent from logs if needed, normally 1 per msg, but we can just map based on success
      const formattedLogs = logs.map(l => ({
          ...l,
          credits: (l.status === 'sent' || l.status === 'delivered') ? 1 : 0
      }));

      const [transactions] = await pool.query(`
        SELECT id, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as date,
               transaction_type as type, amount, balance_after as balance, description
        FROM credit_transactions
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [id]);

      const [biz] = await pool.query('SELECT sms_credits FROM business WHERE id = ?', [id]);

      res.status(200).json({
        success: true,
        data: {
            logs: formattedLogs,
            transactions,
            creditBalance: biz[0]?.sms_credits || 0
        }
      });
    } catch (error) {
      next(error);
    }
  },

  getTemplates: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      const UserBusiness = (await import('../../models/UserBusiness.js')).default;
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      if (!hasAccess) throw ERRORS.FORBIDDEN('You do not have access to this business');

      const MessageTemplate = (await import('../../models/MessageTemplate.js')).default;
      const templates = await MessageTemplate.getByBusinessId(id);

      // Convert array of {type, content} to an object {confirmation: content, ...}
      const formatted = {};
      templates.forEach(t => { formatted[t.type] = t.content; });

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (error) {
      next(error);
    }
  },

  updateTemplates: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      const { confirmation, reminder, cancellation } = req.body;
      
      const UserBusiness = (await import('../../models/UserBusiness.js')).default;
      const hasAccess = await UserBusiness.checkAccess(userId, id);
      // Only owner/admin can update templates
      const membership = await UserBusiness.findByUserAndBusiness(userId, id);
      if (!hasAccess || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ERRORS.FORBIDDEN('You do not have permission to update templates');
      }

      const MessageTemplate = (await import('../../models/MessageTemplate.js')).default;
      
      if (confirmation) await MessageTemplate.upsert(id, 'confirmation', confirmation);
      if (reminder) await MessageTemplate.upsert(id, 'reminder', reminder);
      if (cancellation) await MessageTemplate.upsert(id, 'cancellation', cancellation);

      res.status(200).json({
        success: true,
        message: 'Templates updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

export default BusinessController;