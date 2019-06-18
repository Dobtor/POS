# -*- coding: utf-8 -*-
import re
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
        order = super()._process_order(pos_order)
        if order and order.partner_id:
            pos_type = order.session_id.config_id.pos_type
            ratio = pos_type.pos_point_ratio if pos_type else 50
            amount_of_multi_point_method = [absl.amount * ratio for absl in order.mapped('statement_ids')
                                            .filtered(lambda statement: statement.journal_id.is_points and not order.point_debit_id)]
            total_amount = sum(amount_of_multi_point_method)
            if total_amount:
                txn_id = self.env['pos.point.transaction'].create_point_transaction(
                    total_amount=total_amount,
                    order=order,
                    point_type='debit'
                )
                if txn_id:
                    order.point_debit_id = txn_id
        return order

    @api.multi
    def make_point_transaction(self):
        for order in self:
            if order.partner_id:
                amount_of_multi_payment_method = [absl.amount for absl in order.mapped('statement_ids')
                                                  .filtered(lambda statement: not statement.journal_id.is_points and not order.point_credit_id)]
                total_amount = sum(amount_of_multi_payment_method)
                if total_amount:
                    txn_id = self.env['pos.point.transaction'].create_point_transaction(
                        total_amount=total_amount,
                        order=order,
                        point_type='credit'
                    )
                    if txn_id:
                        order.point_credit_id = txn_id
