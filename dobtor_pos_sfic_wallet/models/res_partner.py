# -*- coding: utf-8 -*-

from odoo import models, fields, api

class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.depends("sfic_transaction.amount", "sfic_transaction.state")
    def _get_point_bal(self):
        for record in self:
            credit_list = [credit.amount for credit in self.mapped('sfic_transaction').filtered(lambda l: l.point_type == 'credit' and l.state == 'done')]
            debit_list = [debit.amount for debit in self.mapped('sfic_transaction').filtered(lambda l: l.point_type == 'debit' and l.state == 'done')]
            record.update({
                'sfic_point': abs(sum(credit_list)) - sum(debit_list)
            })

    sfic_point = fields.Integer(
        'Point', store=True, readonly=True, compute="_get_point_bal")
    
    sfic_transaction = fields.One2many(
        'pos.point.transaction', 'partner_id', "Transaction")