# -*- coding: utf-8 -*-

from odoo import models, fields, api

class Pricelist(models.Model):
    _inherit = 'product.pricelist'
    
    discount_item = fields.Many2one('product.product.discount','Discount Type',required=True)
    discount_type = fields.Selection('discount_type',related='discount_item.paid_type')
    discount_product = fields.Many2one(string='related_discount_product',comodel_name='product.product',related='discount_item.product_id')
    
    @api.multi
    def get_discount_product(self):
        return self.discount_item.product_id.id
    
class PricelistItem(models.Model):
    
    _inherit = 'product.pricelist.item'
    _order = "sequence"

    # is_primary_key = fields.Boolean( string='is_primary_key',default=False)
    sequence = fields.Integer(string='sequence',default=10)
    

    related_product = fields.Many2one(
        string='related_product',
        comodel_name='product.product',
        related='pricelist_id.discount_product'
    )
    
        
    