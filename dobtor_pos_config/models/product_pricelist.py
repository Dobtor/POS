# -*- coding: utf-8 -*-

from odoo import models, fields, api

class Pricelist(models.Model):
    _inherit = 'product.pricelist'

    posconfig_ids = fields.Many2many('pos.config','pricelist_pos_config_rel','pricelist_id','config_id',string='Available Using POS')