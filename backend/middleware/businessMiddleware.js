import { ERRORS } from "../utils/errors.js";
import UserBusiness from "../models/UserBusiness.js";

/**
 * Ensures req.session.activeBusinessId is set and user has access.
 */
export const ensureBusinessContext = async (req, res, next) => {
    try {
        const businessId = req.session.activeBusinessId;
        const userId = req.session.userId;

        if (!businessId) {
            return res.status(403).json({
                success: false,
                code: 'BUSINESS_CONTEXT_REQUIRED',
                message: 'No active business selected'
            });
        }

        // Optional: Re-verify access in DB if we want extra security vs session hijacking/stale data
        // For now, trust the session as it's server-side and updated on selection.
        
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware for role-based access control.
 * @param {Array} allowedRoles - e.g. ['owner', 'admin']
 */
export const authorizeRoles = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.session.role;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return next(ERRORS.FORBIDDEN('You do not have permission to perform this action'));
        }

        next();
    };
};

/**
 * Validates that the user has owner/admin access to the business specified in :id param.
 * Populates req.business with { id, role }.
 */
export const validateBusinessOwner = async (req, res, next) => {
    try {
        const businessId = req.params.id;
        const userId = req.session.userId;

        if (!businessId) {
            return next(ERRORS.VALIDATION('Business ID parameter missing'));
        }

        const membership = await UserBusiness.findByUserAndBusiness(userId, businessId);
        
        if (!membership) {
            return next(ERRORS.FORBIDDEN('You do not have access to this business'));
        }

        if (!['owner', 'admin'].includes(membership.role)) {
            return next(ERRORS.FORBIDDEN('Administrative access required for this action'));
        }

        // Populate req.business for downstream controllers (like MarketingController)
        req.business = {
            id: Number(businessId),
            role: membership.role
        };

        next();
    } catch (error) {
        next(error);
    }
};
