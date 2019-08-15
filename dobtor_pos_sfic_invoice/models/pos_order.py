# -*- coding: utf-8 -*-
import logging
import math
import psycopg2

from odoo import models, fields, api, tools, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import safe_eval, float_is_zero

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = "pos.order"

    invoice_state = fields.Selection(
        string='Invoice state',
        selection=[('to_invoice', _('To invoice')),
                   ('invoiced', _('Fully invoiced'))],
        default='to_invoice'
    )

    def _default_point_balance_product_id(self):
        product_id = self.env["ir.config_parameter"].sudo().get_param(
            "dobtor_pos_sfic_invoice.point_balance_product")
        return self.env["product.product"].browse(int(product_id))

    def _default_point_balance_account_id(self):
        return self._default_point_balance_product_id().property_account_income_id

    def _prepare_point_balance_product(self):
        return {
            'name': _('Point balance'),
            'type': 'service',
            'invoice_policy': 'order',
            'property_account_income_id': self._default_point_balance_account_id().id,
            'taxes_id': None,
        }

    @api.model
    def create_from_ui_with_exiting_orders(self, orders):
        submitted_references = [o['data']['name'] for o in orders]
        pos_order = self.search(
            [('pos_reference', 'in', submitted_references)]
        )
        existing_orders = pos_order.read(['pos_reference'])
        existing_references = set(
            [o['pos_reference'] for o in existing_orders]
        )
        orders_to_save = [
            o for o in orders if o['data']['name'] in existing_references
        ]
        order_ids = self.return_from_ui(orders_to_save)
        return orders

    @api.model
    def create_from_ui(self, orders):
        orders = self.create_from_ui_with_exiting_orders(orders)
        # Keep only new orders
        submitted_references = [o['data']['name'] for o in orders]
        pos_order = self.search(
            [('pos_reference', 'in', submitted_references)]
        )
        existing_orders = pos_order.read(['pos_reference'])
        existing_references = set(
            [o['pos_reference'] for o in existing_orders]
        )
        orders_to_save = [
            o for o in orders if o['data']['name'] not in existing_references
        ]

        order_ids = []

        for tmp_order in orders_to_save:
            order = tmp_order['data']
            pos_session = self.env["pos.session"].browse(
                order.get("pos_session_id"))
            to_invoice = tmp_order['to_invoice'] or pos_session.config_id.auto_invoicing
            if to_invoice:
                self._match_payment_to_invoice(order)
            pos_order = self._process_order(order)
            order_ids.append(pos_order.id)

            try:
                pos_order.action_pos_order_paid()
            except psycopg2.DatabaseError:
                # do not hide transactional errors, the order(s) won't be saved!
                raise
            except Exception as e:
                _logger.error(
                    'Could not fully process the POS Order: %s', tools.ustr(e))

            if to_invoice:
                pos_order.action_pos_order_invoice()
                pos_order.invoice_id.sudo().with_context(
                    force_company=self.env.user.company_id.id).action_invoice_open()
                pos_order.account_move = pos_order.invoice_id.move_id
        return order_ids

    def _get_order_partner(self, order):
        partner_id = order.partner_id
        if not order.partner_id:
            if order.company_id.pos_guests_id:
                partner_id = order.company_id.pos_guests_id
            else:
                default_partner = self.env.ref('dobtor_pos_sfic_invoice.res_partner_pos_guests')
                partner_id = default_partner if default_partner else self.env['res.partner'].sudo().create({
                    'name': 'The POS Guests',
                    'supplier': True,
                })
                order.sudo().company_id.update({
                    'pos_guests_id': partner_id.id
                })
            order.sudo().update({'partner_id': partner_id})
        return partner_id


    @api.multi
    def return_from_ui(self, orders):
        for tmp_order in orders:
            order = tmp_order['data']
            pos_session = self.env["pos.session"].browse(
                order.get("pos_session_id"))
            to_bill = tmp_order['to_invoice'] or pos_session.config_id.auto_invoicing
            # if to_bill:
            #     self._match_payment_to_invoice(order)

            order['returned_order'] = True
            pos_order = self._process_order(order)

            try:
                pos_order.action_pos_order_paid()
            except psycopg2.OperationalError:
                raise
            except Exception as e:
                _logger.error(
                    'Could not fully process the POS Order: %s', tools.ustr(e)
                )

            if to_bill:
                pos_order.action_pos_order_bill()
                pos_order.invoice_id.sudo().action_invoice_open()
                pos_order.account_move = pos_order.invoice_id.move_id

    def _prepare_bill(self):
        """
        Prepare the dict of values to create the new invoice for a pos order.
        """
        return {
            'name': self.name,
            'origin': self.name,
            'account_id': self.partner_id.property_account_payable_id.id,
            'journal_id': self.session_id.config_id.bill_journal_id.id,
            'company_id': self.company_id.id,
            'type': 'in_invoice',
            'reference': self.name,
            'partner_id': self.partner_id.id,
            'comment': self.note or '',
            # considering partner's sale pricelist's currency
            'currency_id': self.pricelist_id.currency_id.id,
            'user_id': self.user_id.id,
        }


    @api.multi
    def action_pos_order_bill(self):
        Invoice = self.env['account.invoice']

        for order in self:
            # Force company for all SUPERUSER_ID action
            local_context = dict(
                self.env.context, force_company=order.company_id.id, company_id=order.company_id.id)
            if order.invoice_id:
                Invoice += order.invoice_id
                continue

            partner_id = self._get_order_partner(order)
            if not partner_id:
                raise UserError(_('Please provide a partner for the sale.'))

            invoice = Invoice.new(order._prepare_bill())
            invoice._onchange_partner_id()
            invoice.fiscal_position_id = order.fiscal_position_id

            inv = invoice._convert_to_write(
                {name: invoice[name] for name in invoice._cache})
            new_invoice = Invoice.with_context(
                local_context).sudo().create(inv)
            message = _(
                "This invoice has been created from the point of sale session: <a href=# data-oe-model=pos.order data-oe-id=%d>%s</a>") % (order.id, order.name)
            new_invoice.message_post(body=message)
            order.write({'invoice_id': new_invoice.id,
                         'invoice_state': 'invoiced'})
            Invoice += new_invoice

            for line in order.lines:
                self.with_context(local_context)._action_create_invoice_line(
                    line, new_invoice.id)

            new_invoice.with_context(local_context).sudo().compute_taxes()
            order.sudo().write({'invoice_state': 'invoiced'})

        if not Invoice:
            return {}

        return {
            'name': _('Customer Bill'),
            'view_type': 'form',
            'view_mode': 'form',
            'view_id': self.env.ref('account.invoice_form').id,
            'res_model': 'account.invoice',
            'context': "{'type':'in_invoice'}",
            'type': 'ir.actions.act_window',
            'nodestroy': True,
            'target': 'current',
            'res_id': Invoice and Invoice.ids[0] or False,
        }

    @api.multi
    def action_pos_order_invoice(self):
        Invoice = self.env['account.invoice']

        for order in self:
            # Force company for all SUPERUSER_ID action
            local_context = dict(
                self.env.context, force_company=order.company_id.id, company_id=order.company_id.id)
            if order.invoice_id:
                Invoice += order.invoice_id
                continue

            partner_id = self._get_order_partner(order)
            if not partner_id:
                raise UserError(_('Please provide a partner for the sale.'))

            prepare_invoice = order._prepare_invoice()
            invoice = Invoice.new(prepare_invoice)
            invoice._onchange_partner_id()
            invoice.fiscal_position_id = order.fiscal_position_id

            inv = invoice._convert_to_write(
                {name: invoice[name] for name in invoice._cache})
            new_invoice = Invoice.with_context(
                local_context).sudo().create(inv)
            message = _(
                "This invoice has been created from the point of sale session: <a href=# data-oe-model=pos.order data-oe-id=%d>%s</a>") % (order.id, order.name)
            new_invoice.message_post(body=message)
            # order.write({'invoice_id': new_invoice.id, 'state': 'invoiced'})
            order.write({'invoice_id': new_invoice.id,
                         'invoice_state': 'invoiced'})
            Invoice += new_invoice

            self.with_context(local_context)._action_create_invoice_lines(
                local_context, order, new_invoice.id)

            new_invoice.with_context(local_context).sudo().compute_taxes()
            new_invoice.with_context(
                local_context).sudo().set_round_off_value(order)
            # order.sudo().write({'state': 'invoiced'})
            order.sudo().write({'invoice_state': 'invoiced'})

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

        product_lines = order.lines.filtered(
            lambda x: not x.product_id.discount_type)
        for product_line in product_lines:
            self.with_context(local_context)._create_invoice_line(
                product_line, invoice_id)

        discount_lines = order.lines.filtered(
            lambda x: x.product_id.discount_type)
        for discount_line in order.lines.filtered(lambda x: x.product_id.discount_type):
            self.with_context(local_context).calculate_invoice_discount_line(
                discount_line, invoice_id)

        self._calculate_point_discount_line(local_context, order, invoice_id)

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
                inv_line = Invoice.invoice_line_ids.filtered(
                    lambda x: x.product_id.id == prod_id)
                if inv_line:
                    invoice_lines.append(inv_line)

            if invoice_lines:
                amount_total = sum(
                    x.price_unit * x.quantity for x in invoice_lines)
                for inv_line in invoice_lines:
                    discount_value = float(line.price_unit * line.qty) * float(
                        inv_line.price_unit * inv_line.quantity) / float(amount_total)
                    inv_line.discount_value += float("%.2f" %
                                                     abs(discount_value))
                    percentage = float(
                        inv_line.discount_value) * 100 / float(inv_line.price_unit * inv_line.quantity)
                    inv_line.discount = float("%.2f" % percentage)
        else:
            if Invoice.invoice_line_ids:
                amount_total = sum(
                    x.price_unit * x.quantity for x in Invoice.invoice_line_ids)
                for inv_line in Invoice.invoice_line_ids:
                    discount_value = float(line.price_unit * line.qty) * float(
                        inv_line.price_unit * inv_line.quantity) / float(amount_total)
                    inv_line.discount_value += float("%.2f" %
                                                     abs(discount_value))
                    percentage = float(
                        inv_line.discount_value) * 100 / float(inv_line.price_unit * inv_line.quantity)
                    inv_line.discount = float("%.2f" % percentage)

    def _create_invoice_line(self, line=False, invoice_id=False):
        if not line or not invoice_id:
            return

        if line.product_id.discount_type:
            return

        invoice_line = self._action_create_invoice_line(line, invoice_id)

    def _calculate_point_discount_line(self, local_context, order, invoice_id):
        Invoice = self.env["account.invoice"]

        for payment in order.statement_ids:
            if payment.journal_id.is_points:
                inv = Invoice.browse(invoice_id)
                if inv:
                    amount = payment.amount
                    invoice_amount = sum(
                        x.price_unit * x.quantity for x in inv.invoice_line_ids)
                    for line in inv.invoice_line_ids:
                        discount_value = float(
                            amount) * (line.price_unit * line.quantity) / float(invoice_amount)
                        line.discount_value += discount_value
                        percentage = float(
                            line.discount_value) * 100 / float(line.price_unit * line.quantity)
                        line.update({
                            'discount': float("%.2f" % percentage)
                        })
                    self.with_context(local_context)._create_point_balance_invoice_line(
                        float(amount), False, invoice_id)

    def _create_point_balance_invoice_line(self, amount, line=False, invoice_id=False):
        if not invoice_id:
            return

        point_product_id = self._default_point_balance_product_id()

        if not point_product_id:
            vals = self._prepare_point_balance_product()
            point_product_id = self.env["product.product"].create(vals)
            self.env["ir.config_parameter"].sudo().set_param(
                "dobtor_pos_sfic_invoice.point_balance_product", point_product_id.id)

        AccountInvoiceLine = self.env["account.invoice.line"].sudo()

        inv_line = {
            "name": point_product_id.name,
            "quantity": 1,
            "product_id": point_product_id.id,
            "invoice_id": invoice_id,
            "account_analytic_id": self._prepare_analytic_account(line),
            "invoice_id": invoice_id,
            "price_unit": amount,
            "discount": 0,
        }

        invoice_line = AccountInvoiceLine.sudo().new(inv_line)
        invoice_line._onchange_product_id()
        inv_line = invoice_line._convert_to_write(
            {name: invoice_line[name] for name in invoice_line._cache})
        inv_line.update(price_unit=amount, discount=0,
                        name=point_product_id.name, invoice_line_tax_ids=None)
        invoice_line = AccountInvoiceLine.create(inv_line)

        return invoice_line
