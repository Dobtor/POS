# -*- coding: utf-8 -*-

from odoo import models, fields, api,_

class dobtor_sale_member(models.Model):
    _name = 'sales.member'

    name = fields.Char(string='name',required=True,)
    member_ids =  fields.One2many(string='Members',comodel_name='res.partner',inverse_name='member_id')
    description = fields.Text(string="Description")
    # pricelist_id = fields.Many2one(string='Pricelist', comodel_name='product.pricelist')
    discount_rate = fields.Float(string='Discount rate',required=True)
    expired_date =fields.Integer(string="Expired Date",default=365)
    discount_price = fields.Char(string="Discount", compute='_get_discount_price_name_price')
    single_threshold = fields.Float(string="Single Threshold",required=True)
    annual_threshold = fields.Float(string="Threshold",required=True)
    next_threshold = fields.Float(string='next Threshold',required=True)
    birthday_discount_times = fields.Integer(string='Birthday Discount Times')
    birthday_discount = fields.Float(string="Birthday Discount",default=0.3)

    @api.one
    @api.depends('discount_rate')
    def _get_discount_price_name_price(self):
        if self.discount_rate:
            self.discount_price = _("%s %% discount") % (self.discount_rate*100)
        
    # @api.model
    # def create(self,value):
    #     pricelist = self.env['product.pricelist']
    #     res = super(dobtor_sale_member, self).create(value)
    #     if self.pricelist_id.id!=False:
    #         return res
    #     else:
    #         pslst=pricelist.create({'name':value['name']})      
    #         for item in pslst.item_ids:
    #             item.update({
    #                 'pricelist_id':pslst.id,
    #                 'compute_price':'percentage',
    #                 'percent_price':value['discount_rate']*100,
    #             })
    #         res.update({
    #             'pricelist_id':pslst.id,
    #         })
    #         pslst.update({
    #             'member_id':res.id,
    #         })
    #         return res
    # @api.multi
    # def write(self,value):
    #     res = super(dobtor_sale_member,self).write(value)
    #     if value.get('discount_rate'):
    #         pricelist_item = self.env['product.pricelist.item'].search([('pricelist_id','=',self.pricelist_id.id)])
    #         pricelist_item.update({
    #             'percent_price': value.get('discount_rate')*100})
    #     return