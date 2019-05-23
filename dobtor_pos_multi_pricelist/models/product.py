# -*- coding: utf-8 -*-

from odoo import models, fields, api

class Product(models.Model):
    _inherit = "product.product"

    discount_type = fields.Boolean('discount_type',defult=False)

class ProductDiscount(models.Model):
    _name = "product.product.discount"
    _order = "sequence"
    _inherits = {'product.product': 'product_id'}
    
    sequence = fields.Integer(string='Sequence',default=10 )
    product_id = fields.Many2one("product.product", string="Discount Product", required=True, ondelete="cascade",)
    paid_type = fields.Selection(selection=[('credit', 'Credit'), ('debit', 'Debit'), ], track_visibility='onchange', required=True,copy=False, default='credit')