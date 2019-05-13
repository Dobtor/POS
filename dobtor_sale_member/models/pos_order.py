# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from datetime import datetime,timedelta

class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.multi
    def make_point_transaction(self):
        super().make_point_transaction()
        for order in self:
            if order.partner_id:
                for absl in order.statement_ids:
                    if not absl.journal_id.is_points:
                        self._update_member_info(order.partner_id.id,absl.amount)
    @api.multi
    def _update_member_info(self,partner_id,amount):
        partner = self.env['res.partner'].browse(partner_id)
        partner.update({'total_amount':partner.total_amount + amount})
        member_type= self.env['sales.member'].sudo().search([('annual_threshold', '<=', partner.total_amount)],order='annual_threshold desc',limit=1)
        direct_levelup_member = self.env['sales.member'].sudo().search([('single_threshold','<=',amount)],order='single_threshold desc',limit=1)
        if direct_levelup_member and partner.member_id.single_threshold <  direct_levelup_member.single_threshold:
            partner.update({
                'member_id':direct_levelup_member.id,
                'expired_date': datetime.today() + timedelta(days=direct_levelup_member.expired_date)})
            partner._add_history_tag()
        elif member_type and partner.member_id != member_type:
            partner.update({
                'member_id':member_type.id,
                'expired_date': datetime.today() + timedelta(days=member_type.expired_date)})
            partner._add_history_tag()