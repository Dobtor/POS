# -*- coding: utf-8 -*-
import logging
import math

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import safe_eval

_logger = logging.getLogger(__name__)

class PosConfig(models.Model):
    _inherit = 'pos.config'

    auto_invoicing = fields.Boolean(string="Auto Invoicing")

    @api.onchange("auto_invoicing")
    def _onchange_auto_invoicing(self):
        if self.auto_invoicing:
            self.invoice_journal_id = self.env.ref('point_of_sale.pos_sale_journal')