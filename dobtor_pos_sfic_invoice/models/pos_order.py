# -*- coding: utf-8 -*-
import logging
import math

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import safe_eval

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

            new_invoice.with_context(local_context).sudo().compute_taxes()
            new_invoice.with_context(local_context).sudo().set_round_off_value(order)
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

        if not order or not invoice_id:
            return

        product_lines = order.lines.filtered(lambda x: not x.product_id.discount_type)
        for product_line in product_lines:
            self.with_context(local_context)._create_invoice_line(product_line, invoice_id)

        discount_lines = order.lines.filtered(lambda x: x.product_id.discount_type)
        for discount_line in order.lines.filtered(lambda x: x.product_id.discount_type):
            self.with_context(local_context).calculate_invoice_discount_line(discount_line, invoice_id)

        for payment in order.statement_ids:
            if payment.journal_id.is_points:
                inv = Invoice.browse(invoice_id)

                if inv:
                    amount = payment.amount
                    invoice_amount = sum(x.price_unit * x.quantity for x in inv.invoice_line_ids)
                    for line in inv.invoice_line_ids:
                        discount_value = float(amount) / float(invoice_amount) * (line.price_unit * line.quantity)
                        line.discount_value += discount_value
                        percentage = float(line.discount_value) * 100 / float(line.price_unit * line.quantity)
                        line.update({
                            'discount': float("%.2f" % percentage)
                        })

        # raise UserError("Take a break!!!")

    def calculate_invoice_discount_line(self, line=False, invoice_id=False):
        if not line or not invoice_id:
            return

        if not line.product_id.discount_type:
            return
        
        Invoice = self.env["account.invoice"].browse(invoice_id)
        if not Invoice:
            raise UserError(_("Invioce not found : %d" % invoice_id))
        if line.relation_product:
            relation_products = safe_eval('[' + line.relation_product + ']')

            invoice_lines = []
            for prod_id in relation_products:
                inv_line = Invoice.invoice_line_ids.filtered(lambda x: x.product_id.id == prod_id)
                if inv_line:
                    invoice_lines.append(inv_line)
            
            if invoice_lines:
                amount_total = sum(x.price_unit * x.quantity for x in invoice_lines)
                for inv_line in invoice_lines:
                    discount_value = float(line.price_unit * line.qty) * float(inv_line.price_unit * inv_line.quantity) / float(amount_total)
                    inv_line.discount_value += float("%.2f" % abs(discount_value))
                    percentage = float(inv_line.discount_value) * 100 / float(inv_line.price_unit * inv_line.quantity)
                    inv_line.discount = float("%.2f" % percentage)
        else:
            if Invoice.invoice_line_ids:
                amount_total = sum(x.price_unit * x.quantity for x in Invoice.invoice_line_ids)
                for inv_line in Invoice.invoice_line_ids:
                    discount_value = float(line.price_unit * line.qty) * float(inv_line.price_unit * inv_line.quantity) / float(amount_total)
                    inv_line.discount_value += float("%.2f" % abs(discount_value))
                    percentage = float(inv_line.discount_value) * 100 / float(inv_line.price_unit * inv_line.quantity)
                    inv_line.discount = float("%.2f" % percentage)

    def _create_invoice_line(self, line=False, invoice_id=False):
        if not line or not invoice_id:
            return
        
        if line.product_id.discount_type:
            return

        invoice_line = self._action_create_invoice_line(line, invoice_id)
