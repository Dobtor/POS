# -*- coding: utf-8 -*-

from odoo import models, fields, api

class PosOrder(models.Model):
    
    _inherit = 'pos.order'

    date_order = fields.Datetime(string='Order Date', readonly=False, index=True, default=fields.Datetime.now)
