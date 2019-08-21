# -*- coding: utf-8 -*-
import logging
from odoo import models, fields, api, _

_logger = logging.getLogger(__name__)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    def _default_bill_journal(self):
        return self.env['account.journal'].search([('type', '=', 'purchase'), ('company_id', '=', self.env.user.company_id.id)], limit=1)

    def _default_invoice_bill(self):
        journal = self.env.ref(
            'dobtor_pos_promotion_return.pos_return_journal', raise_if_not_found=False
        )
        if journal and journal.sudo().company_id == self.env.user.company_id:
            return journal
        return self._default_bill_journal()

    bill_journal_id = fields.Many2one(
        string='Bill Journal',
        comodel_name='account.journal',
        domain=[('type', '=', 'purchase')],
        help="Accounting journal used to create bills.",
        default=_default_invoice_bill
    )
    purchase_journal_id = journal_id = fields.Many2one(
        'account.journal', string='Purchase Journal',
        domain=[('type', '=', 'purchase')],
        help="Accounting journal used to post Purchase entries.",
        default=_default_bill_journal)

    @api.onchange("auto_invoicing")
    def _onchange_auto_invoicing(self):
        super()._onchange_auto_invoicing()
        if self.auto_invoicing:
            self.bill_journal_id = self._default_invoice_bill()
