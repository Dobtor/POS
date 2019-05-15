# -*- coding: utf-8 -*-
from odoo import models, fields, api


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    referce_ids = fields.One2many(
        string='referce_ids',
        comodel_name='pos.order.line',
        inverse_name='res_id',
    )
    
    res_id = fields.Many2one(
        string='promotion id',
        comodel_name='pos.order.line',
        ondelete='cascade',
    )
    
    # discount_price = fields.