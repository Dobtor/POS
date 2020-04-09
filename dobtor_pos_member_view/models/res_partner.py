# -*- coding: utf-8 -*-

from odoo import models, fields, api

class ResPartner(models.Model):
    
    _inherit = 'res.partner'
    
    @api.model
    def create_from_ui(self, partner):
        partner_id = partner.get('id', False)
        if partner_id:
            del partner['config']
        else:
            partner['pos_counter'] = partner.pop('config', False)
        return super().create_from_ui(partner)
