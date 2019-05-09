# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
import time
class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.multi
    def make_point_transaction(self):
        res = super(PosOrder,self).make_point_transaction()
        for order in self:
            if order.partner_id:
                for absl in order.statement_ids:
                    if not order.point_credit_id:
                        self.order_compute_memeber_count(order.partner_id.id,absl.amount)
       

    @api.multi                  
    def order_compute_memeber_count(self,partner_id,total):
        partner = self.env['res.partner'].browse(partner_id)
        partner.update({'total_amount':partner.total_amount + total})
        sale_member = self.env['sales.member'].sudo().search([('threshold','!=',0)])
        data = []
        for member in sale_member:
            data.append([member.threshold,member.id,member.expired_date])
        data.sort()
        for member in data:
            if partner.total_amount - member[0] >= 0:
                sale_member = self.env['sales.member'].browse(member[1])
                partner.update({
                    'member_id':sale_member.id,
                    'validity_period': datetime.today() + timedelta(days=member[2]),
                    'property_product_pricelist':sale_member.pricelist_id.id,})
                partner._add_history_tag()

        