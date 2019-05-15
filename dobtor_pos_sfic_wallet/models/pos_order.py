# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

class PosOrder(models.Model):
    _inherit = "pos.order"

    point_credit_id = fields.Many2one(
        'pos.point.transaction', 'Point Credit Transaction', on_delete='set null', copy=False)
    point_debit_id = fields.Many2one(
        'pos.point.transaction', 'Point Debit Transaction', on_delete='set null', copy=False)


    @api.model
    def _process_order(self, pos_order):
        order = super(PosOrder, self)._process_order(pos_order)
        if order and order.partner_id:
            for absl in order.statement_ids:
                if absl.journal_id.is_points and not order.point_debit_id:
                    pos_type = order.session_id.config_id.pos_type
                    ratio = pos_type.pos_point_ratio if pos_type else 50
                    txn_id = self.env['pos.point.transaction'].create({
                        'amount': absl.amount * ratio,
                        'partner_id': order.partner_id.id,
                        'point_type': 'debit',
                        'pos_order_id': order.id,
                        'state': 'done',
                        'pos_type': pos_type.id,
                        'reference': self.env['pos.point.transaction'].get_next_sfic_reference(),
                        'date': fields.Datetime.now()
                    })
                    if txn_id:
                        order.point_debit_id = txn_id
        return order

    @api.multi
    def make_point_transaction(self):
        for order in self:
            if order.partner_id:
                for absl in order.statement_ids:
                    if not absl.journal_id.is_points and not order.point_credit_id:
                        pos_type = order.session_id.config_id.pos_type
                        txn_id = self.env['pos.point.transaction'].create({
                            'amount': absl.amount,
                            'partner_id': order.partner_id.id,
                            'point_type': 'credit',
                            'pos_order_id': order.id,
                            'state': 'done',
                            'pos_type': pos_type.id,
                            'reference': self.env['pos.point.transaction'].get_next_sfic_reference(),
                            'date': fields.Datetime.now()
                        })
                        if txn_id:
                            order.point_credit_id = txn_id
