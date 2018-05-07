# -*- coding: utf-8 -*-
from odoo import models, fields, _, api
import logging
from odoo.exceptions import UserError
import odoo

_logger = logging.getLogger(__name__)


class sale_shop(models.Model):
    _name = "sale.shop"
    name = fields.Char('Shop Name', size=64, required=True)


class sale_order(models.Model):
    _inherit = "sale.order"

    shop_id = fields.Many2one('sale.shop', string='Shop')
    pos_status = fields.Selection([
        ('draft', 'Draft'),
        ('cancel', 'Cancel'),
        ('request', 'Requesting'),
        ('success', 'Success')
    ], default='draft', string='POS Status', readonly=1)
    signature = fields.Binary('Signature', readonly=1)
    signature_on_report = fields.Boolean('Signature on report',
                                         help='Check this if you need include signature on report SO')

    @api.model
    def compute_orders_send_to_pos(self, shop_ids):
        orders = self.sudo().search([('pos_status', '=', 'request'), ('shop_id', 'in', shop_ids)])
        values = []
        if orders:
            for order in orders:
                pos_vals = {
                    'sequence_number': order.id,
                    'name': order.name,
                    'partner_id': order.partner_id.id,
                    'lines': [],
                    'amount_total': order.amount_total,
                    'statement_ids': [],
                    'id': order.id
                }
                if order.order_line:
                    for line in order.order_line:
                        if line.product_id.available_in_pos:
                            pos_vals['lines'].append(
                                [0, 0, {
                                    'price_unit': line.price_unit,
                                    'qty': line.product_uom_qty,
                                    'product_id': line.product_id.id,
                                    'discount': line.discount,
                                    'pack_lot_ids': [],
                                    'id': line.id
                                }]
                            )
                values.append(pos_vals)
                order.write({'pos_status': 'success'})
        return values

    @api.multi
    def request_to_pos(self):
        for order in self:
            if not order.shop_id:
                raise UserError('Please choice shop before request to POS')
            for line in order.order_line:
                if not line.product_id.available_in_pos:
                    raise UserError(
                        '%s not available in pos, please go to Product menu and check to field Available in POS' % line.product_id.name)
            order.write({'pos_status': 'request'})
        return 1

    @api.multi
    def cancel_request_to_pos(self):
        self.write({'pos_status': 'cancel'})

    @api.multi
    def re_request_to_pos(self):
        for order in self:
            if not order.shop_id:
                raise UserError('Please choice shop before request to POS')
            for line in order.order_line:
                if not line.product_id.available_in_pos:
                    raise UserError(
                        '%s not available in pos, please go to Product menu and check to field Available in POS' % line.product.name)
            order.write({'pos_status': 'request'})
        return 1

    @api.model
    def create_sale_order_from_pos(self, vals):
        _logger.info('{create_sale_order_from_pos} begin')
        auto_invoice = vals.get('auto_invoice', False)
        invoice_state = vals.get('invoice_state', False)
        auto_delivered = vals.get('auto_delivered', False)
        customer = self.env['res.partner'].browse(vals.get('partner_id', False))
        so = self.create({
            'partner_id': customer.id,
            'signature': vals.get('signature', None),
            'note': vals.get('note', None),
            'signature_on_report': vals.get('signature_on_report', None),
            'origin': vals.get('origin', None),
            'pricelist_id': vals.get('pricelist_id', False),
            'payment_term_id': customer.property_payment_term_id.id if customer.property_payment_term_id else None,
        })
        for line in vals['lines']:
            uom = self.env['product.product'].browse(line.get('product_id')).uom_id
            self.env['sale.order.line'].create({
                'product_id': line.get('product_id'),
                'product_uom_qty': line.get('quantity'),
                'price_unit': line.get('price_unit'),
                'discount': line.get('discount'),
                'order_id': so.id,
                'product_uom': uom.id if uom else None,
            })
        context = {"active_model": 'sale.order', "active_ids": [so.id], "active_id": so.id}
        so.with_context(context).action_confirm()
        _logger.info('{create_sale_order_from_pos} SO confirmed')
        if auto_invoice:
            if so.partner_id.supplier:
                payment = self.env['sale.advance.payment.inv'].with_context(active_ids=[so.id]).create({
                    'advance_payment_method': 'percentage',
                    'amount': 100
                })
            else:
                payment = self.env['sale.advance.payment.inv'].with_context(active_ids=[so.id]).create({
                    'advance_payment_method': 'all',
                })
            payment.with_context(context).create_invoices()
            _logger.info('so invoiced')
            invoice = so.invoice_ids[0]
            if invoice_state in ['open', 'paid']:
                invoice.action_invoice_open()
                _logger.info('{create_sale_order_from_pos} invoice opened')
            if invoice_state == 'paid':
                invoice.with_context(context).invoice_validate()
                _logger.info('{create_sale_order_from_pos} invoiced')
        if auto_delivered:
            version_info = odoo.release.version_info
            for picking in so.picking_ids:
                wiz_transfer = None
                if version_info and version_info[0] == 11:
                    wiz_transfer = self.env['stock.immediate.transfer'].create({
                        'pick_ids': [(4, picking.id)]
                    })
                if version_info and version_info[0] == 10:
                    wiz_transfer = self.env['stock.immediate.transfer'].create({
                        'pick_id': picking.id
                    })
                if wiz_transfer:
                    wiz_transfer.process()
                    _logger.info('{create_sale_order_from_pos} transfer processed.')
        _logger.info('{create_sale_order_from_pos} end')
        return {'name': so.name, 'id': so.id}

    @api.multi
    def write(self, vals):
        res = super(sale_order, self).write(vals)
        for record in self:
            self.env['pos.cache.database'].add_cache_record(record)
        return res

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_cache_record(record)
        return super(sale_order, self).unlink()

    @api.model
    def create(self, vals):
        record = super(sale_order, self).create(vals)
        self.env['pos.cache.database'].add_cache_record(record)
        return record

