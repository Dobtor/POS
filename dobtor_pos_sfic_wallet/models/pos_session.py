# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

class PosSession(models.Model):
    _inherit = "pos.session"

    @api.multi
    def action_pos_session_close(self):
        super(PosSession, self).action_pos_session_close()
        self.make_point_transaction()

    @api.multi
    def make_point_transaction(self):
        for session in self:
            orders = session.order_ids.filtered(lambda order: order.state in ['done', 'invoiced'])
            for order in orders:
                order.make_point_transaction()
