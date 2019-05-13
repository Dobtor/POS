# -*- coding: utf-8 -*-

from odoo import models, fields, api

class PriceList(models.Model):
    _inherit = "product.pricelist"

    member_id = fields.Many2one(string='member_id',comodel_name='sales.member')
    
    @api.multi
    def write(self,value):
        if value.get('item_ids'):
            sales_member = self.env['sales.member'].browse(self.member_id.id)
            if sales_member:
                item = value.get('item_ids')[0][2]
                sales_member.discount_rate = item.get('percent_price')/100  
        super(PriceList,self).write(value)

