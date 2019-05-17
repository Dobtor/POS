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

    @api.multi
    def get_discount_displayname(self,product_id):
        product = self.env['product.product'].browse(product_id)
        name = self.name
        for item in self.item_ids:
            if item.product_tmpl_id == product.product_tmpl_id:
                name = self.name + ' ' +item.name
        return name
    

class PricelistItem(models.Model):
    
    _inherit = 'product.pricelist.item'
    _order = "sequence"
    is_primary_key =  fields.Boolean(string='Primary key',default=False)
    sequence = fields.Integer(string='sequence',default=10)
    
    