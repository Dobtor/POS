# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry


class pos_auto_invoice(models.Model):
    _name = "pos.auto.invoice"
    _description = "POS auto invoice"
    _rec_name = "order_id"

    order_id = fields.Many2one('pos.order', required=1, string='Order', readonly=1)

    @api.multi
    def auto_invoice(self):
        records = self.search([])
        for record in records:
            order = record.order_id
            if order.state == 'paid':
                order.action_pos_order_invoice()
                order.invoice_id.sudo().action_invoice_open()
                order.account_move = order.invoice_id.move_id
            record.unlink()
        return True