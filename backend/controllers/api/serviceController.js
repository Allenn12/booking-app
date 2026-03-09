import Service from '../../models/Service.js';
import UserBusiness from '../../models/UserBusiness.js';
import { ERRORS } from '../../utils/errors.js';

export const ServiceController = {
  
  // POST /api/v1/business/:id/services
  create: async (req, res, next) => {
    try {
      const { id } = req.params; // businessId
      const userId = req.session.userId;
      
      // Ensure caller is owner or admin of business
      const membership = await UserBusiness.findByUserAndBusiness(userId, id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ERRORS.FORBIDDEN('You must be an owner or admin to manage services');
      }
      
      const newService = await Service.create(id, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Service created successfully',
        data: newService
      });
      
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/v1/business/:id/services/:serviceId
  update: async (req, res, next) => {
    try {
      const { id, serviceId } = req.params;
      const userId = req.session.userId;

      // Ensure caller is owner or admin of business
      const membership = await UserBusiness.findByUserAndBusiness(userId, id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ERRORS.FORBIDDEN('You must be an owner or admin to manage services');
      }

      const updatedService = await Service.update(serviceId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Service updated successfully',
        data: updatedService
      });
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/v1/business/:id/services/:serviceId
  delete: async (req, res, next) => {
    try {
      const { id, serviceId } = req.params;
      const userId = req.session.userId;

      // Ensure caller is owner or admin of business
      const membership = await UserBusiness.findByUserAndBusiness(userId, id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ERRORS.FORBIDDEN('You must be an owner or admin to manage services');
      }

      // Soft delete
      await Service.softDelete(serviceId, id);

      res.status(200).json({
        success: true,
        message: 'Service deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
};

export default ServiceController;
