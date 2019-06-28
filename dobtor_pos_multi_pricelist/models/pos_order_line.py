# -*- coding: utf-8 -*-

from odoo import models, fields, api

class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    description = fields.Char(string='Description',compute='_compute_description')
    compute_name = fields.Char(string="compute_name")
    # display_name = fields.Char(string="SXXXX")
    @api.depends('product_id','display_name')
    def _compute_description(self):
        for record in self:
            if record.compute_name:
                record.description = record.compute_name
            elif record.product_id:
                record.description = record.product_id.name

    
    def _order_line_fields(self, line, session_id=None):
        res = super()._order_line_fields(line, session_id)
        product = self.env['product.product'].browse(line[2]['product_id'])
        if res and 'compute_name' not in res[2]:
            res[2]['compute_name'] = product.name +' ('+'Demo Text'+')'
        return res
        
