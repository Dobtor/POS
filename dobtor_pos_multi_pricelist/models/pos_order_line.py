# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from datetime import date, datetime, time

class PosOrderLine(models.Model):

    _inherit = "pos.order.line"

    # @api.model
    # def _default_display_name(self):
    #     if self.product_id:
    #         self.line_name = self.product_id.product_tmpl_id.name
    #     else:
    #         self.line_name = False

    # line_name = fields.Char(string='DisplayName',default=_default_display_name)


    compute_name = fields.Char(
        string='Description',
        compute="_default_display_name"
    )
    line_name = fields.Char(string='DisplayName')

    @api.one
    def _default_display_name(self):
        if self.line_name:
            self.compute_name = self.line_name
        elif self.product_id:
            self.compute_name = self.product_id.product_tmpl_id.name

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
                        elif item.applied_on=='2_product_category' and item.categ_id and item.categ_id==product.categ_id:
                            pricelst.append(lst)
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