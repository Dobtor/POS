# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError


class Pos(models.Model):
    
    _inherit = ['pos.order']


    order_pricelist_id = fields.Many2one(string='order_pricelist_id',comodel_name='pos.order.pricelist')
    # @api.model
    # def _order_fields(self, ui_order):
    #     res = super()._order_fields(ui_order)
    #     print(res)
    #     return res
    
class PosOrderPircelist(models.Model):
    _name = "pos.order.pricelist"
    _order = "sequence"

    name= fields.Char(string='name',required=True)
    sequence = fields.Integer(string='Sequence',default=10)
    order_ids = fields.One2many(string='Pos orders',comodel_name='pos.order',inverse_name='order_pricelist_id')
    discount_rule = fields.One2many(
        string='Pricelist Items',
        comodel_name='pos.order.pricelist.rule',
        inverse_name='pricelist_id',
    )
    discount_product = fields.Many2one('product.product.discount','discount item',required=True,)

    
    
class PosOrderPircelistRule(models.Model):
    _name = "pos.order.pricelist.rule"
    _order = 'base_price'
    name = fields.Char(
        string='Name',
        required=True,
        
    )
    pricelist_id = fields.Many2one(
        string='pricelist_id',
        comodel_name='pos.order.pricelist',
    )
    base_price =  fields.Float(string='Base Price',
    required=True,
    )
    discount_price = fields.Float(string="Discount Price",
    )
    percent_price = fields.Float('Percentage Price')
    compute_price = fields.Selection([
        ('discount', 'Fix Discount'),
        ('percentage', 'Percentage (discount)')], index=True, default='discount')