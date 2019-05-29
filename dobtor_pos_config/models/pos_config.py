# -*- coding: utf-8 -*-

from odoo import models, fields, api

class PosConfig(models.Model):
    
    _inherit = 'pos.config'

    use_multi_pricelists = fields.Boolean(string="Use Multi pricelists.")
    multi_pricelist_ids = fields.Many2many('product.pricelist','pricelist_pos_config_rel','config_id','pricelist_id',string='Available Multi Pricelists')
    available_member_discount = fields.Boolean(string="Use Member Discount.")
    member_discount_limit = fields.Float(string="Member Discount Limit",default=0.6)