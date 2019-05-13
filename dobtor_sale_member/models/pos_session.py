# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from datetime import datetime,timedelta
class PosSession(models.Model):
    _inherit = "pos.session"
        
    # member birthday point 5x  
    @api.multi
    def make_point_transaction(self):
        super().make_point_transaction()
        for session in self:
            orders = session.order_ids.filtered(lambda order: order.state == 'paid')
            for order in orders:
                if order.point_credit_id and order.partner_id.memeber_id:
                    if order.partner_id.birthday.month == order.date.month:
                        order.point_credit_id.update({
                            'amount':order.point_credit_id.amount * 5
                        })
