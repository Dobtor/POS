# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.tools import float_is_zero
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'


    def _payment_fields(self, ui_paymentline):
        res = super()._payment_fields(ui_paymentline)
        journal = self.env['account.journal'].browse(ui_paymentline['journal_id'])
        if journal and journal.is_points:
            res.update({
                'payment_name': _('point'),
            })
        return res

    @api.model
    def _process_order(self, pos_order):
        if pos_order.get('returned_order'):
            prec_acc = self.env['decimal.precision'].precision_get('Account')
            pos_session = self.env['pos.session'].browse(
                pos_order['pos_session_id'])
            if pos_session.state == 'closing_control' or pos_session.state == 'closed':
                pos_order['pos_session_id'] = self._get_valid_session(
                    pos_order).id
            order = self.create(self._order_fields(pos_order))
            order.write({'returned_order': True})
            journal_ids = set()
            for payments in pos_order['statement_ids']:
                if not float_is_zero(payments[2]['amount'], precision_digits=prec_acc):
                    order.add_payment(self._payment_fields(payments[2]))
                journal_ids.add(payments[2]['journal_id'])
            if pos_session.sequence_number <= pos_order['sequence_number']:
                pos_session.write(
                    {'sequence_number': pos_order['sequence_number'] + 1})
                pos_session.refresh()
            if not float_is_zero(pos_order['amount_return'], prec_acc):
                cash_journals = []
                cash_journal_id = pos_session.cash_journal_id.id
                if not cash_journal_id:
                    cash_journal = self.env['account.journal'].search([('id', 'in', list(journal_ids))], limit=1)
                    if not cash_journal:
                        journal_list = [statement.journal_id for statement in pos_session.statement_ids]
                        for journal in journal_list:
                            if not journal.is_points and journal.type == 'cash':
                                cash_journals.append(journal)
                    else:
                        cash_journals.append(cash_journal)
                if len(cash_journals):
                    cash_journal_id = cash_journals[0].id
                else:
                    raise UserError(
                        _("No cash statement found for this session. Unable to record returned cash."))
                order.add_payment({
                    'amount': -pos_order['amount_return'],
                    'payment_date': fields.Datetime.now(),
                    'payment_name': _('return'),
                    'journal': cash_journal_id,
                })
            return order
        else:
            return super()._process_order(pos_order)
