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

            const { historyPage, historyLimit } = req.query;
            const result = await Client.getDetailWithHistory(
                businessId,
                clientId,
                Number(historyPage) || 1,
                Number(historyLimit) || 10
            );
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
     * PATCH /api/v1/business/:id/clients/:clientId
     * Update basic client info: name, phone, email, notes.
     */
    updateClient: async (req, res, next) => {
        try {
            const businessId = req.params.id;
            const clientId = req.params.clientId;
            const userId = req.session.userId;

            const hasAccess = await UserBusiness.checkAccess(userId, businessId);
            if (!hasAccess) throw ERRORS.FORBIDDEN('You do not have access to this business');

            // Multi-tenant safety
            const existing = await Client.getByBusinessAndId(businessId, clientId);
            if (!existing) throw ERRORS.NOT_FOUND('Client not found in this business');

            // Cannot edit the Walk-in sentinel
            if (existing.phone === 'WALKIN') {
                throw ERRORS.VALIDATION('Cannot edit the Walk-in profile');
            }

            const { name, phone, email, notes } = req.body;

            // Validate required fields
            if (name !== undefined && (!name || name.trim().length < 2)) {
                throw ERRORS.VALIDATION('Name must be at least 2 characters');
            }
            if (phone !== undefined) {
                const trimmedPhone = (phone || '').trim();
                if (!trimmedPhone) throw ERRORS.VALIDATION('Phone number is required');
                // Basic phone sanity: allow digits, +, -, spaces, parens
                if (!/^[+]?[0-9\s\-().]{6,20}$/.test(trimmedPhone)) {
                    throw ERRORS.VALIDATION('Invalid phone number format');
                }
            }
            if (email !== undefined && email && email.trim()) {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                    throw ERRORS.VALIDATION('Invalid email address format');
                }
            }

            const updateData = {};
            if (name  !== undefined) updateData.name  = name.trim();
            if (phone !== undefined) updateData.phone = phone.trim();
            if (email !== undefined) updateData.email = email ? email.trim() : null;
            if (notes !== undefined) updateData.notes = notes || null;

            if (Object.keys(updateData).length === 0) {
                throw ERRORS.VALIDATION('No valid fields provided for update');
            }

            await Client.update(clientId, updateData, businessId);

            // Return updated client
            const updated = await Client.getByBusinessAndId(businessId, clientId);

            res.status(200).json({
                success: true,
                message: 'Client updated successfully',
                data: updated
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

            await Client.updateNotes(clientId, notes, businessId);

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
