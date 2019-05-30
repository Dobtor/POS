# -*- coding: utf-8 -*-

from odoo import models, fields, api,_

class Sale_Member(models.Model):
    _inherit =  'sales.member'

    
    @api.model
    def get_discount(self):
        return self.env.ref('dobtor_pos_multi_pricelist.product_discount_members').product_id.id

    related_item = fields.Many2one(string='related_product',comodel_name='product.product',default=get_discount,readonly=1)

        