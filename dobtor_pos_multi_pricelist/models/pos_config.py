# -*- coding: utf-8 -*-

from odoo import models, fields, api

class PosConfig(models.Model):
    
    _inherit = 'pos.config'

    multi_pricelist_ids = fields.Many2many(string='Available Multi Pricelists',comodel_name='product.pricelist')
    use_multi_pricelists = fields.Boolean(string="Use Multi pricelists.")
