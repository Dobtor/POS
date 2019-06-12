# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


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
