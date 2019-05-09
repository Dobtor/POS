# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from datetime import date, datetime, time

class Product(models.Model):
    _inherit = "product.product"

    discount_type = fields.Boolean('discount_type',defult=False)

    @api.multi
    def get_discount_type(self):
        return self.discount_type


class ProductDiscount(models.Model):
    _name = "product.product.discount"
    _order = "sequence"
    _inherits = {'product.product': 'product_id'}
    
    sequence = fields.Integer(string='Sequence',default=10 )
    product_id = fields.Many2one("product.product", string="Discount Product", required=True, ondelete="cascade",)
    paid_type = fields.Selection(selection=[
        ('credit', 'Credit'),
        ('debit', 'Debit'),
        ], track_visibility='onchange', required=True,copy=False, default='credit')
    
class Pricelist(models.Model):
    _inherit = 'product.pricelist'
    
    discount_product = fields.Many2one('product.product.discount','discount item')
    discount_type = fields.Selection('discount_type',related='discount_product.paid_type')

    @api.multi
    def get_discount_product(self):
        return self.discount_product.product_id.id

    @api.multi
    def get_discount_displayname(self,product_id):
        product = self.env['product.product'].browse(product_id)
        name = self.name
        for item in self.item_ids:
            if item.product_tmpl_id == product.product_tmpl_id:
                name = self.name + ' ' +item.name
        return name
class PosOrder(models.Model):

    _inherit = 'pos.order'

class PosOrderLine(models.Model):

    _inherit = "pos.order.line"
    
    display_name = fields.Char(string='DisplayName',compute='default_display_name')
    discount_price_unit = fields.Float(string='original_price', digits=0)
    is_discount_line = fields.Boolean(string='is_discount_line',default=False)

    @api.multi
    def default_display_name(self):
        if self.product_id:
            self.display_name = self.product_id.product_tmpl_id.name
        else:
            self.display_name = ''

    @api.multi
    def rename_orderline(self,name):
        if name:
            self.name = name
            self.display_name = name


    def compute_product_pricelist(self,product_id,partner_id):
        today = datetime.today()
        if product_id:
            pricelists = self.env['product.pricelist'].search([])
            product = self.env['product.product'].browse(product_id)
            partner_id = self.env['res.partner'].browse(partner_id)
            pricelst = []
            for lst in pricelists :
                if lst.member_id == partner_id.member_id:
                    pricelst.append(lst)
                if not lst.member_id:
                    for item in lst.item_ids:
                        if item.product_tmpl_id and item.product_tmpl_id == product.product_tmpl_id or item.applied_on == '3_global':
                            pricelst.append(lst)
                        # elif item.applied_on=='2_product_category' and item.categ_id and item.categ_id==product.categ_id:
                        #     pricelst.append(lst)
            sorted_lst = sorted(pricelst,key=lambda x : x.discount_product.sequence)
            return list(set(sorted_lst))
        return 0
    
    @api.multi
    def compute_product_price(self,product_id,qty,partner_id):
        product = self.env['product.product'].browse(product_id)
        pricelists = self.compute_product_pricelist(product.id,partner_id)
        sorted_lst = sorted(pricelists,key=lambda x : x.discount_product.sequence)
        price_array = [] 
        total_discount = 1
        if sorted_lst:
            for lst in sorted_lst: 
                if total_discount > 0.6: 
                    price = lst.get_product_price(product,qty or 1.0 ,self.order_id.partner_id)
                    discount = (product.product_tmpl_id.lst_price -price)/product.product_tmpl_id.lst_price
                    total_discount = (1-discount) * total_discount
                    price_array.append([discount , lst.id])
            return price_array        
        return 0,False
