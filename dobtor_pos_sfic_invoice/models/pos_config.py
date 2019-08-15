# -*- coding: utf-8 -*-
import logging
import math

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import safe_eval

_logger = logging.getLogger(__name__)

class PosConfig(models.Model):
    _inherit = 'pos.config'

    def _default_bill_journal(self):
        return self.env['account.journal'].search([('type', '=', 'purchase'), ('company_id', '=', self.env.user.company_id.id)], limit=1)

    def _default_invoice_bill(self):
        journal = self.env.ref(
            'dobtor_pos_sfic_invoice.pos_return_journal', raise_if_not_found=False
        )
        if journal and journal.sudo().company_id == self.env.user.company_id:
            return journal
        return self._default_bill_journal()

    auto_invoicing = fields.Boolean(string="Auto Invoicing")
    bill_journal_id = fields.Many2one(
        string='Bill Journal',
        comodel_name='account.journal',
        domain=[('type', '=', 'purchase')],
        help="Accounting journal used to create bills.",
        default=_default_invoice_bill
    )

    @api.onchange("auto_invoicing")
    def _onchange_auto_invoicing(self):
        if self.auto_invoicing:
            self.invoice_journal_id = self.env.ref('point_of_sale.pos_sale_journal')
            self.bill_journal_id = self._default_invoice_bill()
