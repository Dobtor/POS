# -*- coding: utf-8 -*-
import logging

from odoo import models, fields, api, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

class PosPointTransaction(models.Model):
    _name = "pos.point.transaction"

    # is_sfic_transaction = fields.Boolean("SFIC Transaction", default=False)
    date = fields.Datetime('Validation Date', readonly=True)
    pos_order_id = fields.Many2one("pos.order", required=True)
    reference = fields.Char("Reference", readonly=True, index=True)
    point_type = fields.Selection([
        ("credit", "Credit"),
        ("debit", "Debit")
    ], string="Point Process")
    state = fields.Selection([
        ('done', 'Done'),
        ('cancel', 'Canceled'),],
        string='Status', copy=False, default='draft', required=True, readonly=True)
    amount = fields.Integer(string='Amount', required=True, readonly=True)
    pos_type = fields.Many2one("pos.type", required=True, string="POS Type")
    partner_id = fields.Many2one('res.partner', 'Customer')

    @api.multi
    def get_next_sfic_reference(self):
        code = 1
        last = self.sudo().search([], order="id desc", limit=1)
        if last:
            code = int(last.reference.split('-')[1]) + 1
        reference = "Point-{}".format(code)
        return reference

    @api.model
    def create_point_transaction(self, total_amount, order, point_type):
        return self.create({
            'amount': total_amount,
            'partner_id': order.partner_id.id,
            'point_type': point_type,
            'pos_order_id': order.id,
            'state': 'done',
            'pos_type': order.session_id.config_id.pos_type.id,
            'reference': self.get_next_sfic_reference(),
            'date': fields.Datetime.now()
        })
