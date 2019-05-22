# -*- coding: utf-8 -*-
import logging
import math

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.multi
    def action_pos_order_invoice(self):
        Invoice = self.env['account.invoice']

        for order in self:
            # Force company for all SUPERUSER_ID action
            local_context = dict(self.env.context, force_company=order.company_id.id, company_id=order.company_id.id)
            if order.invoice_id:
                Invoice += order.invoice_id
                continue

            if not order.partner_id:
                raise UserError(_('Please provide a partner for the sale.'))

            prepare_invoice = order._prepare_invoice()
            invoice = Invoice.new(prepare_invoice)
            invoice._onchange_partner_id()
            invoice.fiscal_position_id = order.fiscal_position_id

            inv = invoice._convert_to_write({name: invoice[name] for name in invoice._cache})
            new_invoice = Invoice.with_context(local_context).sudo().create(inv)
            message = _("This invoice has been created from the point of sale session: <a href=# data-oe-model=pos.order data-oe-id=%d>%s</a>") % (order.id, order.name)
            new_invoice.message_post(body=message)
            order.write({'invoice_id': new_invoice.id, 'state': 'invoiced'})
            Invoice += new_invoice

            self.with_context(local_context)._action_create_invoice_lines(local_context, order, new_invoice.id)

            # for line in order.lines:
            #     self.with_context(local_context)._action_create_invoice_line(line, new_invoice.id)

            new_invoice.with_context(local_context).sudo().compute_taxes()
            order.sudo().write({'state': 'invoiced'})

        if not Invoice:
            return {}

        return {
            'name': _('Customer Invoice'),
            'view_type': 'form',
            'view_mode': 'form',
            'view_id': self.env.ref('account.invoice_form').id,
            'res_model': 'account.invoice',
            'context': "{'type':'out_invoice'}",
            'type': 'ir.actions.act_window',
            'nodestroy': True,
            'target': 'current',
            'res_id': Invoice and Invoice.ids[0] or False,
        }

    def _action_create_invoice_lines(self, local_context, order, invoice_id=False):
        InvoiceLine = self.env['account.invoice.line']
        Invoice = self.env["account.invoice"]

        if not order:
            return
        
        for line in order.lines:
            self.with_context(local_context)._create_invoice_line(line, invoice_id)

        for payment in order.statement_ids:
            if payment.journal_id.is_points:
                inv = Invoice.browse(invoice_id)

                if inv:
                    amount = payment.amount
                    for line in inv.invoice_line_ids:
                        discount_value = line.discount_value
                        point_diff = float((payment.amount * float(line.price_subtotal) / order.amount_total) / line.quantity)
                        discount_value += point_diff
                        percentage = ( float(discount_value) / line.price_unit ) * 100
                        line.update({
                            'discount': float("%.2f" % percentage),
                            'discount_value': float("%.2f" % discount_value)
                        })


    def _create_invoice_line(self, line=False, invoice_id=False):
        if not line or not invoice_id:
            return
        
        if line.product_id.discount_type:
            return

        price_data = self.env['pos.order.line'].sudo().compute_product_price(line.product_id.id, line.qty, self.partner_id.id)

        discount_list = [discount[0] for discount in price_data if discount[0] > 0]
        percentage = False
        discount_value = 0
        if discount_list:
            percentage = 1.0
            product_price_modify = line.price_unit
            for discount in discount_list:
                product_price_modify *= (1 - float(discount))
            discount_value = line.price_unit - product_price_modify
            percentage = ( float(discount_value) / line.price_unit ) * 100

        invoice_line = self._action_create_invoice_line(line, invoice_id)
        if invoice_line:
            if percentage and discount_value:
                invoice_line.update({
                    'discount': float("%.2f" % percentage),
                    'discount_value': float("%.2f" % discount_value)
                })
