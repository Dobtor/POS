# -*- coding: utf-8 -*-
from odoo import fields, models, _, api

class stock_immediate_transfer(models.TransientModel):

    _inherit = 'stock.immediate.transfer'

    @api.model
    def pos_made_picking_done(self, picking_id):
        transfer = self.create({
            'pick_ids': [(4, picking_id)]
        })
        return transfer.process()

    @api.model
    def pos_made_invoice(self, invoice_val):
        purchase = self.env['purchase.order'].browse(invoice_val.get('purchase_id'))
        partner = self.env['res.partner'].browse(invoice_val['partner_id'])
        account_id = partner.property_account_payable_id.id
        invoice = self.env['account.invoice'].create({
            'currency_id': invoice_val.get('currency_id', False),
            'partner_id': partner.id,
            'origin': purchase.name,
            'account_id': account_id,
            'payment_term_id': partner.property_payment_term_id.id if partner.property_payment_term_id else None,
        })
        for po_line in purchase.order_line:
            self.env['account.invoice.line'].create({
                'invoice_line_tax_ids': [[6, False, [tax.id for tax in po_line.taxes_id]]],
                'product_id': po_line.product_id.id,
                'name': po_line.name if po_line.name else purchase.name,
                'account_id': account_id,
                'quantity': po_line.product_qty,
                'uom_id': po_line.product_uom.id if po_line.product_uom else None,
                'price_unit': po_line.price_unit,
                'invoice_id': invoice.id
            })
        invoice.action_invoice_open()
        return {
            'invoice_id': invoice.id,
            'name': invoice.number

        }