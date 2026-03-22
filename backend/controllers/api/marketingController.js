import Segment from '../../models/Segment.js';
import Campaign from '../../models/Campaign.js';
import Automation from '../../models/Automation.js';
import SegmentService from '../../services/SegmentService.js';
import CampaignService from '../../services/CampaignService.js';
import { ERRORS } from '../../utils/errors.js';

class MarketingController {
  // --- SEGMENTS ---
  static async getSegments(req, res, next) {
    try {
      const segments = await Segment.getAllForBusiness(req.business.id);
      res.json(segments);
    } catch (err) {
      next(err);
    }
  }

  static async createSegment(req, res, next) {
    try {
      const { name, type, rules } = req.body;
      if (!name || !type) throw ERRORS.VALIDATION('Name and type required');
      const id = await Segment.create(req.business.id, { name, type, rules });
      res.status(201).json({ id, name, type, rules });
    } catch (err) {
      next(err);
    }
  }

  static async getSegmentById(req, res, next) {
    try {
      const segment = await Segment.getById(req.business.id, req.params.segmentId);
      if (!segment) throw ERRORS.NOT_FOUND('Segment not found');
      
      const count = await SegmentService.countForSegment(req.business.id, segment);
      res.json({ ...segment, count });
    } catch (err) {
      next(err);
    }
  }

  static async updateSegment(req, res, next) {
    try {
      const success = await Segment.update(req.business.id, req.params.segmentId, req.body);
      if (!success) throw ERRORS.NOT_FOUND('Segment not found');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSegment(req, res, next) {
    try {
      const success = await Segment.delete(req.business.id, req.params.segmentId);
      if (!success) throw ERRORS.NOT_FOUND('Segment not found');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async previewSegment(req, res, next) {
    try {
      const obj = await Segment.getById(req.business.id, req.params.segmentId);
      let segment = obj || { type: 'all_clients' };
      
      const count = await SegmentService.countForSegment(req.business.id, segment);
      const clientIds = await SegmentService.getClientIdsForSegment(req.business.id, segment);
      
      let sample = [];
      if (clientIds.length > 0) {
        // We import pool here or do it properly. For now we can just leave sample empty if we don't have pool from model
        // Actually, SegmentService doesn't expose getting details. I'll omit sample for this basic endpoint, or just return counts.
        sample = { message: "Sample not implemented here, use campaign preview" };
      }
      res.json({ count, sample });
    } catch (err) {
      next(err);
    }
  }

  // --- CAMPAIGNS ---
  static async getCampaigns(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const data = await Campaign.getAllForBusiness(req.business.id, limit, offset);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async createCampaign(req, res, next) {
    try {
      const { name, channel, segment_id, client_id, template_id, inline_message } = req.body;
      if (!name) throw ERRORS.VALIDATION('Kampanja mora imati ime');
      
      if (!inline_message && !template_id) {
          throw ERRORS.VALIDATION('Sadržaj poruke ili predložak su obavezni');
      }

      const campaign = await CampaignService.createCampaign(req.business.id, req.user.id, {
        name, channel, segment_id, client_id, template_id, inline_message
      });
      res.status(201).json(campaign);
    } catch (err) {
      next(err);
    }
  }

  static async getCampaignById(req, res, next) {
    try {
      const cmp = await Campaign.getById(req.business.id, req.params.campaignId);
      if (!cmp) throw ERRORS.NOT_FOUND('Campaign not found');
      res.json(cmp);
    } catch (err) {
      next(err);
    }
  }

  static async updateCampaign(req, res, next) {
    try {
      const success = await Campaign.updateDraft(req.business.id, req.params.campaignId, req.body);
      if (!success) throw ERRORS.VALIDATION('Campaign not found or not in draft state');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCampaign(req, res, next) {
    try {
      const success = await Campaign.deleteDraft(req.business.id, req.params.campaignId);
      if (!success) throw ERRORS.VALIDATION('Campaign not found or not in draft state');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async previewCampaign(req, res, next) {
    try {
      // Validates business_id implicitly by previewRecipients? previewRecipients doesn't check owner.
      // So let's check ownership
      const cmp = await Campaign.getById(req.business.id, req.params.campaignId);
      if (!cmp) throw ERRORS.NOT_FOUND('Campaign not found');

      const data = await CampaignService.previewRecipients(req.params.campaignId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async sendCampaignNow(req, res, next) {
    try {
      const cmp = await Campaign.getById(req.business.id, req.params.campaignId);
      if (!cmp) throw ERRORS.NOT_FOUND('Campaign not found');

      await CampaignService.sendNow(req.params.campaignId);
      res.json({ success: true, message: 'Pokrenuto slanje' });
    } catch (err) {
      next(err);
    }
  }

  static async scheduleCampaign(req, res, next) {
    try {
      const cmp = await Campaign.getById(req.business.id, req.params.campaignId);
      if (!cmp) throw ERRORS.NOT_FOUND('Campaign not found');

      const { scheduledAt } = req.body;
      if (!scheduledAt) throw ERRORS.VALIDATION('scheduledAt required');

      await CampaignService.scheduleCampaign(req.params.campaignId, scheduledAt);
      res.json({ success: true, message: 'Zakazano slanje' });
    } catch (err) {
      next(err);
    }
  }

  static async cancelCampaign(req, res, next) {
    try {
      const cmp = await Campaign.getById(req.business.id, req.params.campaignId);
      if (!cmp) throw ERRORS.NOT_FOUND('Campaign not found');

      await CampaignService.cancelCampaign(req.params.campaignId);
      res.json({ success: true, message: 'Otkazano' });
    } catch (err) {
      next(err);
    }
  }

  static async getRecipients(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      const data = await Campaign.getRecipients(req.business.id, req.params.campaignId, limit, offset);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  // --- AUTOMATIONS ---
  static async getAutomations(req, res, next) {
    try {
      const automations = await Automation.getAllForBusiness(req.business.id);
      res.json(automations);
    } catch (err) {
      next(err);
    }
  }

  static async createAutomation(req, res, next) {
    try {
      const id = await Automation.create(req.business.id, req.body);
      res.status(201).json({ id, ...req.body });
    } catch (err) {
      next(err);
    }
  }

  static async getAutomationById(req, res, next) {
    try {
      const item = await Automation.getById(req.business.id, req.params.automationId);
      if (!item) throw ERRORS.NOT_FOUND('Automation not found');
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  static async updateAutomation(req, res, next) {
    try {
      const success = await Automation.update(req.business.id, req.params.automationId, req.body);
      if (!success) throw ERRORS.NOT_FOUND('Automation not found');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async deleteAutomation(req, res, next) {
    try {
      const success = await Automation.delete(req.business.id, req.params.automationId);
      if (!success) throw ERRORS.NOT_FOUND('Automation not found');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async enableAutomation(req, res, next) {
    try {
      const success = await Automation.setStatus(req.business.id, req.params.automationId, 'enabled');
      if (!success) throw ERRORS.NOT_FOUND('Automation not found');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async disableAutomation(req, res, next) {
    try {
      const success = await Automation.setStatus(req.business.id, req.params.automationId, 'disabled');
      if (!success) throw ERRORS.NOT_FOUND('Automation not found');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async getAutomationStats(req, res, next) {
    try {
      const days = parseInt(req.query.days) || 30;
      const stats = await Automation.getStats(req.business.id, req.params.automationId, days);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
}

export default MarketingController;
