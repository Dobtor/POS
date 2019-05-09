# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

class PosSession(models.Model):
    _inherit = "pos.session"

    @api.multi
    def action_pos_session_close(self):
        self.make_point_transaction()
        super(PosSession, self).action_pos_session_close()

    @api.multi
    def make_point_transaction(self):
        for session in self:
            orders = session.order_ids.filtered(lambda order: order.state == 'paid')
            for order in orders:
                order.make_point_transaction()
