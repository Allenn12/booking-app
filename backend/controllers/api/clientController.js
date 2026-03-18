import Client from '../../models/Client.js';
import UserBusiness from '../../models/UserBusiness.js';
import { ERRORS } from '../../utils/errors.js';

const ClientController = {
    /**
     * GET /api/v1/business/:id/clients
     * Paginated list with stats. Owner/admin only.
     */
    getClients: async (req, res, next) => {
        try {
            const businessId = req.params.id;
            const userId = req.session.userId;

            const hasAccess = await UserBusiness.checkAccess(userId, businessId);
            if (!hasAccess) throw ERRORS.FORBIDDEN('You do not have access to this business');

            const { q, filter, sort, page, limit } = req.query;

            const result = await Client.listByBusiness(businessId, {
                search: q || null,
                filter: filter || null,
                sort: sort || 'last_visit',
                page: Number(page) || 1,
                limit: Number(limit) || 20
            });

            res.status(200).json({
                success: true,
                data: result.clients,
                pagination: result.pagination
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/v1/business/:id/clients/search?q=...&limit=10
     * Lightweight search for autocomplete.
     */
    searchClients: async (req, res, next) => {
        try {
            const businessId = req.params.id;
            const userId = req.session.userId;

            const hasAccess = await UserBusiness.checkAccess(userId, businessId);
            if (!hasAccess) throw ERRORS.FORBIDDEN('You do not have access to this business');

            const { q, limit } = req.query;
            if (!q || !q.trim()) {
                return res.status(200).json({ success: true, data: [] });
            }

            const results = await Client.search(businessId, q.trim(), Number(limit) || 10);

            res.status(200).json({
                success: true,
                data: results
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/v1/business/:id/clients/:clientId
     * Full client profile with upcoming + past appointments.
     */
    getClientDetail: async (req, res, next) => {
        try {
            const businessId = req.params.id;
            const clientId = req.params.clientId;
            const userId = req.session.userId;

            const hasAccess = await UserBusiness.checkAccess(userId, businessId);
            if (!hasAccess) throw ERRORS.FORBIDDEN('You do not have access to this business');

            const result = await Client.getDetailWithHistory(businessId, clientId);
            if (!result) throw ERRORS.NOT_FOUND('Client not found');

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /api/v1/business/:id/clients/:clientId/notes
     * Update client internal notes. Owner/admin only.
     */
    updateClientNotes: async (req, res, next) => {
        try {
            const businessId = req.params.id;
            const clientId = req.params.clientId;
            const userId = req.session.userId;
            const { notes } = req.body;

            // Verify access
            const hasAccess = await UserBusiness.checkAccess(userId, businessId);
            if (!hasAccess) throw ERRORS.FORBIDDEN('You do not have access to this business');

            // Verify client belongs to this business (multi-tenant safety)
            const client = await Client.getByBusinessAndId(businessId, clientId);
            if (!client) throw ERRORS.NOT_FOUND('Client not found in this business');

            if (notes === undefined) {
                throw ERRORS.VALIDATION('Notes field is required (can be empty string or null)');
            }

            await Client.updateNotes(clientId, notes);

            res.status(200).json({
                success: true,
                message: 'Client notes updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

export default ClientController;
