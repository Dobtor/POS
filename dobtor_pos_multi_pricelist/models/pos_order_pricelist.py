# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError



class PosOrderPircelist(models.Model):
    _name = "pos.order.pricelist"
    _order = "sequence"
    name= fields.Char(string='name')
    sequence = fields.Integer(string='Sequence',default=10 )
    order_id = fields.Many2one(string='Pos order',comodel_name='pos.order')
    base_price = fields.Float(string='base_price',related='order_id.amount_total') 
    discount_rule = fields.One2many(
        string='discount_rule',
        comodel_name='pos.order.pricelist.rule',
        inverse_name='pricelist_id',
    )
    discounted_price = fields.Float(string='Price', compute='_compute_price')
    

    @api.depends('base_price','discount_rule','order_id')
    def _compute_price(self):
        for record in self:
            for rule in record.discount_rule:
                if record.base_price >= rule.base_price:
                    self.discounted_price = record.base_price- rule.discount_price
    
    
class PosOrderPircelistRule(models.Model):
    _name = "pos.order.pricelist.rule"
    _order = 'base_price'
    name = fields.Char(
        string='name',
        required=True,
        
    )
    pricelist_id = fields.Many2one(
        string='pricelist_id',
        comodel_name='pos.order.pricelist',
    )
    base_price =  fields.Float(string='base_price',
    required=True,
    )
    discount_price = fields.Float(string="discount price",
    required=True,
    )
    