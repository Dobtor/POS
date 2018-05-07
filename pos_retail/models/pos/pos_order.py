# -*- coding: utf-8 -*-
from odoo import api, fields, models, tools, _
from odoo.tools import float_is_zero
from datetime import datetime
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
import odoo
import json
import ast
import logging

_logger = logging.getLogger(__name__)


class pos_order(models.Model):
    _inherit = "pos.order"

    picking_ids = fields.One2many('stock.picking', 'pos_order_id', 'Delivery Orders')
    promotion_ids = fields.Many2many('pos.promotion', 'pos_order_promotion_rel', 'order_id', 'promotion_id',
                                     string='Promotions')

    ean13 = fields.Char('Ean13')
    expire_date = fields.Datetime('Expired date')
    is_return = fields.Boolean('is Return')
    lock_return = fields.Boolean('Lock Return')
    return_order_id = fields.Many2one('pos.order', 'Return order')

    voucher_id = fields.Many2one('pos.voucher', 'Voucher')

    email = fields.Char('Email')
    sms = fields.Boolean('Sms')
    mrp_order_ids = fields.One2many('mrp.production', 'pos_id', 'Manufacturing orders', readonly=1)

    plus_point = fields.Float(compute="_get_point", styring='Plus point')
    redeem_point = fields.Float(compute="_get_point", styring='Redeem point')
    signature = fields.Binary('Signature', readonly=1)

    @api.one
    def made_invoice(self):
        self.action_pos_order_invoice()
        self.invoice_id.sudo().action_invoice_open()
        self.account_move = self.invoice_id.move_id
        return {
            'id': self.invoice_id.id,
            'number': self.invoice_id.number
        }

    @api.multi
    def _get_point(self):
        for order in self:
            order.plus_point = 0
            order.redeem_point = 0
            for line in order.lines:
                order.plus_point += line.plus_point
                order.redeem_point += line.redeem_point

    def get_data(self):
        params = self.env['ir.config_parameter'].sudo().get_param(self._name)
        if params:
            params = ast.literal_eval(params)
            datas = self.with_context(params.get('context', {})).read(params.get('fields', []))[0]
            datas['model'] = self._name
            return datas
        else:
            return None

    def sync_data(self):
        self.env['pos.cache.database'].add_cache_record(self)
        order_data = self.get_data()
        if order_data:
            sessions = self.env['pos.session'].sudo().search([
                ('state', '=', 'opened'),
            ])
            for session in sessions:
                _logger.info('sync order with %s' % session.user_id.login)
                self.env['bus.bus'].sendmany(
                    [[(self._cr.dbname, 'pos.order', session.user_id.id), json.dumps(order_data)]])
        return True

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_cache_record(record)
        return super(pos_order, self).unlink()

    @api.multi
    def write(self, vals):
        Credit = self.env['res.partner.credit']
        for order in self:
            if order.state in ['paid', 'done', 'invoiced'] and order.voucher_id and order.voucher_id.state != 'used':
                order.voucher_id.write({'state': 'used', 'use_date': fields.Datetime.now()})
            if order.state == 'paid' and order.session_id and order.session_id.config_id and order.session_id.config_id.send_sms_receipt and order.session_id.config_id.send_sms_receipt_template_id and order.partner_id and not order.sms:
                if order.partner_id.mobile:
                    order.session_id.config_id.send_sms_receipt_template_id.send_sms(order.id,
                                                                                     order.partner_id.mobile)
                if order.partner_id.phone:
                    order.session_id.config_id.send_sms_receipt_template_id.send_sms(order.id,
                                                                                     order.partner_id.phone)
                    vals.update({'sms': True})
            # add credit
            if vals.get('state', False) == 'paid' and order.partner_id.id:
                for line in order.lines:
                    if not line.is_return and line.product_id.is_credit and line.qty > 0:
                        Credit.create({
                            'name': order.name,
                            'type': 'plus',
                            'amount': line.price_subtotal,
                            'pos_order_id': order.id,
                            'partner_id': order.partner_id.id,
                        })
                    if line.product_id.is_credit and (line.is_return or line.qty < 0):
                        Credit.create({
                            'name': order.name,
                            'type': 'redeem',
                            'amount': - line.price_subtotal,
                            'pos_order_id': order.id,
                            'partner_id': order.partner_id.id,
                        })
        res = super(pos_order, self).write(vals)
        for order in self:
            if vals.get('state', False) and not order.lock_return and not order.is_return:  # sync amount paid, amount total to pos sessions
                order.sync_data()
            if order.partner_id: # sync credit, wallet balance to pos sessions
                order.partner_id.sync_data()

        return res

    def add_payment(self, data):
        res = super(pos_order, self).add_payment(data)
        self.sync_data()
        return res

    # method use for force picking done, function pos internal mode
    @api.model
    def pos_force_picking_done(self, picking_id):
        _logger.info('begin pos_force_picking_done')
        picking = self.env['stock.picking'].browse(picking_id)
        picking.action_assign()
        picking.force_assign()
        wrong_lots = self.set_pack_operation_lot(picking)
        _logger.info('wrong_lots: %s' % wrong_lots)
        if not wrong_lots:
            picking.action_done()

    # if line is return no need create invoice line
    def _action_create_invoice_line(self, line=False, invoice_id=False):
        if line.qty < 0:
            return False
        else:
            return super(pos_order, self)._action_create_invoice_line(line, invoice_id)

    # create 1 purchase get products return from customer
    def made_purchase_order(self):
        _logger.info(' begin made_purchase_order')
        customer_return = self.env['res.partner'].search([('name', '=', 'Customer return')])
        po = self.env['purchase.order'].create({
            'partner_id': self.partner_id.id if self.partner_id else customer_return[0].id,
            'name': 'Return/' + self.name,
        })
        for line in self.lines:
            if line.qty < 0:
                self.env['purchase.order.line'].create({
                    'order_id': po.id,
                    'name': 'Return/' + line.product_id.name,
                    'product_id': line.product_id.id,
                    'product_qty': - line.qty,
                    'product_uom': line.product_id.uom_po_id.id,
                    'price_unit': line.price_unit,
                    'date_planned': datetime.today().strftime(DEFAULT_SERVER_DATETIME_FORMAT),
                })
        po.button_confirm()
        for picking in po.picking_ids:
            picking.action_assign()
            picking.force_assign()
            wrong_lots = self.set_pack_operation_lot(picking)
            if not wrong_lots:
                picking.action_done()
        return True

    # create picking for return order
    # only give product have quantity > 0
    # and if quantity < 0, will made 1 purchase order
    def create_picking_return_order(self):
        """Create a picking for each order and validate it."""
        _logger.info('begin create_picking_return_order')
        Picking = self.env['stock.picking']
        Move = self.env['stock.move']
        StockWarehouse = self.env['stock.warehouse']
        for order in self:
            temp = False
            for line in order.lines:
                if line.qty > 0:
                    temp = True
            if temp == False:
                order.made_purchase_order()
                continue
            else:
                order.made_purchase_order()
            if not order.lines.filtered(lambda l: l.product_id.type in ['product', 'consu']):
                continue
            address = order.partner_id.address_get(['delivery']) or {}
            picking_type = order.picking_type_id
            return_pick_type = order.picking_type_id.return_picking_type_id or order.picking_type_id
            order_picking = Picking
            return_picking = Picking
            moves = Move
            location_id = order.location_id.id
            if order.partner_id:
                destination_id = order.partner_id.property_stock_customer.id
            else:
                if (not picking_type) or (not picking_type.default_location_dest_id):
                    customerloc, supplierloc = StockWarehouse._get_partner_locations()
                    destination_id = customerloc.id
                else:
                    destination_id = picking_type.default_location_dest_id.id

            if picking_type:
                message = _(
                    "This transfer has been created from the point of sale session: <a href=# data-oe-model=pos.order data-oe-id=%d>%s</a>") % (
                              order.id, order.name)
                picking_vals = {
                    'origin': order.name,
                    'pos_order_id': order.id,
                    'partner_id': address.get('delivery', False),
                    'date_done': order.date_order,
                    'picking_type_id': picking_type.id,
                    'company_id': order.company_id.id,
                    'move_type': 'direct',
                    'note': order.note or "",
                    'location_id': location_id,
                    'location_dest_id': destination_id,
                }
                pos_qty = any([x.qty > 0 for x in order.lines if x.product_id.type in ['product', 'consu']])
                if pos_qty:
                    order_picking = Picking.create(picking_vals.copy())
                    order_picking.message_post(body=message)
            for line in order.lines.filtered(
                    lambda l: l.product_id.type in ['product', 'consu'] and not float_is_zero(l.qty,
                                                                                              precision_digits=l.product_id.uom_id.rounding) and l.qty > 0):
                moves |= Move.create({
                    'name': line.name,
                    'product_uom': line.product_id.uom_id.id,
                    'picking_id': order_picking.id if line.qty >= 0 else return_picking.id,
                    'picking_type_id': picking_type.id if line.qty >= 0 else return_pick_type.id,
                    'product_id': line.product_id.id,
                    'product_uom_qty': abs(line.qty),
                    'state': 'draft',
                    'location_id': location_id if line.qty >= 0 else destination_id,
                    'location_dest_id': destination_id if line.qty >= 0 else return_pick_type != picking_type and return_pick_type.default_location_dest_id.id or location_id,
                })

            # prefer associating the regular order picking, not the return
            order.write({'picking_id': order_picking.id or return_picking.id})

            if return_picking:
                order._force_picking_done(return_picking)
            if order_picking:
                order._force_picking_done(order_picking)

            # when the pos.config has no picking_type_id set only the moves will be created
            if moves and not return_picking and not order_picking:
                moves._action_assign()
                moves.filtered(lambda m: m.state in ['confirmed', 'waiting']).force_assign()
                moves.filtered(lambda m: m.product_id.tracking == 'none')._action_done()

        return True

    @api.multi
    def action_pos_order_paid(self):
        temp = False
        for order in self:
            if order.is_return:
                temp = True
                self.create_picking_return_order()
        if temp == False:
            return super(pos_order, self).action_pos_order_paid()
        else:
            self.write({'state': 'paid'})

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(pos_order, self)._order_fields(ui_order)
        if ui_order.get('ean13', False):
            order_fields.update({
                'ean13': ui_order['ean13']
            })
        if ui_order.get('expire_date', False):
            order_fields.update({
                'expire_date': ui_order['expire_date']
            })
        if ui_order.get('is_return', False):
            order_fields.update({
                'is_return': ui_order['is_return']
            })
        if ui_order.get('return_order_ean13', False):
            order_fields.update({
                'return_order_ean13': ui_order['return_order_ean13']
            })
        if ui_order.get('voucher_id', False):
            order_fields.update({
                'voucher_id': ui_order['voucher_id']
            })
        if ui_order.get('email', False):
            order_fields.update({
                'email': ui_order.get('email')
            })
        if ui_order.get('plus_point', 0):
            order_fields.update({
                'plus_point': ui_order['plus_point']
            })
        if ui_order.get('redeem_point', 0):
            order_fields.update({
                'redeem_point': ui_order['redeem_point']
            })
        if ui_order.get('note', None):
            order_fields.update({
                'note': ui_order['note']
            })
        return order_fields

    @api.model
    def get_code(self, code):
        return self.env['barcode.nomenclature'].sudo().sanitize_ean(code)

    @api.model
    def create_from_ui(self, orders):
        _logger.info('begin create_from_ui')
        for o in orders:
            data = o['data']
            lines = data.get('lines')
            # creation_time, mp_dirty, mp_skip, note, quantity_done, state, tags
            for line_val in lines:
                line = line_val[2]
                tag_ids = []
                for tag in line['tags']:
                    tag_ids.append(tag['id'])
                line['tag_ids'] = [(6, False, tag_ids)]
                if line.get('creation_time'):
                    del line['creation_time']
                if line.get('mp_dirty', False):
                    del line['mp_dirty']
                if line.get('mp_skip', False):
                    del line['mp_skip']
                if line.get('note'):
                    del line['note']
                if line.get('quantity_wait'):
                    del line['quantity_wait']
                if line.get('state'):
                    del line['state']
                if line.get('tags'):
                    del line['tags']
                if line.get('quantity_done'):
                    del line['quantity_done']
                if line.get('promotion_discount_total_order'):
                    del line['promotion_discount_total_order']
                if line.get('promotion_discount_category'):
                    del line['promotion_discount_category']
                if line.get('promotion_discount_by_quantity'):
                    del line['promotion_discount_by_quantity']
                if line.get('promotion_discount'):
                    del line['promotion_discount']
                if line.get('promotion_gift'):
                    del line['promotion_gift']
                if line.get('promotion_price_by_quantity'):
                    del line['promotion_price_by_quantity']
            if data.get('return_order_ean13', ''):
                return_order_ids = self.search([('ean13', '=', o['data']['return_order_ean13'])])
                if return_order_ids:
                    o['data']['return_order_id'] = return_order_ids[0].id
        order_ids = super(pos_order, self).create_from_ui(orders)
        _logger.info(order_ids)
        orders_object = self.browse(order_ids)
        version_info = odoo.release.version_info
        for order in orders_object:
            # loyalty program
            if order.partner_id:
                pos_loyalty_point = order.partner_id.pos_loyalty_point
                if order.plus_point:
                    pos_loyalty_point += order.plus_point
                if order.redeem_point:
                    pos_loyalty_point += order.redeem_point
                loyalty_categories = self.env['pos.loyalty.category'].search([])
                pos_loyalty_type = order.partner_id.pos_loyalty_type.id if order.partner_id.pos_loyalty_type else None
                for loyalty_category in loyalty_categories:
                    if pos_loyalty_point >= loyalty_category.from_point and pos_loyalty_point <= loyalty_category.to_point:
                        pos_loyalty_type = loyalty_category.id
                order.partner_id.sudo().write(
                    {'pos_loyalty_point': pos_loyalty_point, 'pos_loyalty_type': pos_loyalty_type})
                order.write({'remaining_point': pos_loyalty_point})
            # variant
            self.create_picking_with_multi_variant(orders, order)
            # combo
            self.create_picking_combo(orders, order)
            # pos create mrp order
            # if have bill of material config for product
            for line in order.lines:
                product_template = line.product_id.product_tmpl_id
                if not product_template.manufacturing_out_of_stock:
                    continue
                else:
                    mrp_orders = self.env['mrp.production'].sudo().search([('name', '=', order.name)])
                    if mrp_orders:
                        continue
                    else:
                        quantity_available = 0
                        bom = product_template.bom_id
                        product_id = line.product_id.id
                        location_id = order.session_id.config_id.stock_location_id.id
                        quants = self.env['stock.quant'].search(
                            [('product_id', '=', product_id), ('location_id', '=', location_id)])
                        if quants:
                            quantity_available = 0
                            if version_info and version_info[0] == 11:
                                quantity_available = sum([q.quantity for q in quants])
                            if version_info and version_info[0] == 10:
                                quantity_available = sum([q.qty for q in quants])
                        pos_min_qty = product_template.pos_min_qty
                        if quantity_available <= pos_min_qty:
                            pos_manufacturing_quantity = product_template.pos_manufacturing_quantity
                            mrp_order = self.env['mrp.production'].create({
                                'name': order.name,
                                'product_id': line.product_id.id,
                                'product_qty': pos_manufacturing_quantity,
                                'bom_id': bom.id,
                                'product_uom_id': bom.product_uom_id.id,
                                'pos_id': order.id,
                                'origin': order.name,
                                'pos_user_id': self.env.user.id,
                            })
                            if product_template.manufacturing_state == 'manual':
                                mrp_order.action_assign()
                                _logger.info('MRP action_assign')
                            if product_template.manufacturing_state == 'auto':
                                mrp_order.action_assign()
                                _logger.info('MRP button_mark_done')
                                mrp_order.button_plan()
                                work_orders = self.env['mrp.workorder'].search([('production_id', '=', mrp_order.id)])
                                if work_orders:
                                    work_orders.button_start()
                                    work_orders.record_production()
                                else:
                                    produce_wizard = self.env['mrp.product.produce'].with_context({
                                        'active_id': mrp_order.id,
                                        'active_ids': [mrp_order.id],
                                    }).create({
                                        'product_qty': pos_manufacturing_quantity,
                                    })
                                    produce_wizard.do_produce()
                                mrp_order.button_mark_done()
            if not order.lock_return and not order.is_return:
                order.sync_data()
        _logger.info('end create_from_ui')
        return order_ids

    def create_picking_combo(self, orders, order):
        _logger.info('begin create_picking_combo')
        version_info = odoo.release.version_info
        for o in orders:
            warehouse_obj = self.env['stock.warehouse']
            move_object = self.env['stock.move']
            moves = move_object
            picking_obj = self.env['stock.picking']
            product_obj = self.env['product.product']
            if o['data']['name'] == order.pos_reference:
                combo_items = []
                picking_type = order.picking_type_id
                if not picking_type:
                    continue
                location_id = order.location_id.id
                address = order.partner_id.address_get(['delivery']) or {}
                if order.partner_id:
                    destination_id = order.partner_id.property_stock_customer.id
                else:
                    if (not picking_type) or (not picking_type.default_location_dest_id):
                        customerloc, supplierloc = warehouse_obj._get_partner_locations()
                        destination_id = customerloc.id
                    else:
                        destination_id = picking_type.default_location_dest_id.id
                if o['data'] and o['data'].get('lines', False):
                    for line in o['data']['lines']:
                        if line[2] and line[2].get('combo_items', False):
                            for item in line[2]['combo_items']:
                                combo_items.append(item)
                            del line[2]['combo_items']
                if combo_items:
                    _logger.info('Processing Order have combo lines')
                    picking_vals = {
                        'name': order.name + '/Combo',
                        'origin': order.name,
                        'partner_id': address.get('delivery', False),
                        'date_done': order.date_order,
                        'picking_type_id': picking_type.id,
                        'company_id': order.company_id.id,
                        'move_type': 'direct',
                        'note': order.note or "",
                        'location_id': location_id,
                        'location_dest_id': destination_id,
                        'pos_order_id': order.id,
                    }
                    _logger.info('{0}'.format(picking_vals))
                    order_picking = picking_obj.create(picking_vals)
                    for item in combo_items:
                        product = product_obj.browse(item['product_id'][0])
                        move = move_object.create({
                            'name': order.name,
                            'product_uom': item['uom_id'][0] if item['uom_id'] else product.uom_id.id,
                            'picking_id': order_picking.id,
                            'picking_type_id': picking_type.id,
                            'product_id': product.id,
                            'product_uom_qty': abs(item['quantity']),
                            'state': 'draft',
                            'location_id': location_id,
                            'location_dest_id': destination_id,
                        })
                        moves |= move
                        if item.get('lot_number', None):
                            self.create_stock_move_with_lot(move, item['lot_number'])
                    order_picking.action_assign()
                    order_picking.force_assign()
                    wiz = None
                    if version_info and version_info[0] == 11:
                        wiz = self.env['stock.immediate.transfer'].create({'pick_ids': [(4, order_picking.id)]})
                    if version_info and version_info[0] == 10:
                        wiz = self.env['stock.immediate.transfer'].create({'pick_id': order_picking.id})
                    if wiz:
                        wiz.process()
                    _logger.info('Delivery combo: %s' % order_picking.name)
        _logger.info('end create_picking_combo')
        return True

    def create_picking_with_multi_variant(self, orders, order):
        _logger.info('begin create_picking_with_multi_variant')
        for o in orders:
            warehouse_obj = self.env['stock.warehouse']
            move_object = self.env['stock.move']
            moves = move_object
            picking_obj = self.env['stock.picking']
            product_obj = self.env['product.product']
            variants = []
            if o['data']['name'] == order.pos_reference:
                picking_type = order.picking_type_id
                if not picking_type:
                    continue
                location_id = order.location_id.id
                address = order.partner_id.address_get(['delivery']) or {}
                if order.partner_id:
                    destination_id = order.partner_id.property_stock_customer.id
                else:
                    if (not picking_type) or (not picking_type.default_location_dest_id):
                        customerloc, supplierloc = warehouse_obj._get_partner_locations()
                        destination_id = customerloc.id
                    else:
                        destination_id = picking_type.default_location_dest_id.id
                if o['data'] and o['data'].get('lines', False):
                    for line in o['data']['lines']:
                        if line[2] and line[2].get('variants', False):
                            for var in line[2]['variants']:
                                if var.get('product_id'):
                                    variants.append(var)
                            del line[2]['variants']
                if variants:
                    _logger.info('Processing Order have variant items')
                    picking_vals = {
                        'name': order.name + '/Variant',
                        'origin': order.name,
                        'partner_id': address.get('delivery', False),
                        'date_done': order.date_order,
                        'picking_type_id': picking_type.id,
                        'company_id': order.company_id.id,
                        'move_type': 'direct',
                        'note': order.note or "",
                        'location_id': location_id,
                        'location_dest_id': destination_id,
                        'pos_order_id': order.id,
                    }
                    _logger.info('{0}'.format(picking_vals))
                    order_picking = picking_obj.create(picking_vals)
                    for variant in variants:
                        product = product_obj.browse(variant.get('product_id')[0])
                        move = move_object.create({
                            'name': order.name,
                            'product_uom': variant['uom_id'] and variant['uom_id'][0] if variant.get('uom_id',
                                                                                                     []) else product.uom_id.id,
                            'picking_id': order_picking.id,
                            'picking_type_id': picking_type.id,
                            'product_id': product.id,
                            'product_uom_qty': abs(variant['quantity']),
                            'state': 'draft',
                            'location_id': location_id,
                            'location_dest_id': destination_id,
                        })
                        moves |= move
                    order_picking.action_assign()
                    order_picking.force_assign()
                    wiz = self.env['stock.immediate.transfer'].create({'pick_ids': [(4, order_picking.id)]})
                    wiz.process()
                    _logger.info('Delivery Picking Variant : %s' % order_picking.name)
        _logger.info('end create_picking_with_multi_variant')
        return True

    def create_stock_move_with_lot(self, stock_move=None, lot_name=None):
        """set lot serial combo items"""
        """Set Serial/Lot number in pack operations to mark the pack operation done."""
        stock_production_lot = self.env['stock.production.lot']
        lots = stock_production_lot.search([('name', '=', lot_name)])
        if lots:
            move_line = self.env['stock.move.line'].create({
                'move_id': stock_move.id,
                'product_id': stock_move.product_id.id,
                'product_uom_id': stock_move.product_uom.id,
                'qty_done': stock_move.product_uom_qty,
                'location_id': stock_move.location_id.id,
                'location_dest_id': stock_move.location_dest_id.id,
                'lot_id': lots[0].id,
            })
            _logger.info('created move line %s (lot serial: %s)' % (move_line.id, lots[0].id))
        return True

    def _payment_fields(self, ui_paymentline):
        payment_fields = super(pos_order, self)._payment_fields(ui_paymentline)
        if ui_paymentline.get('currency_id', None):
            payment_fields['currency_id'] = ui_paymentline.get('currency_id')
        if ui_paymentline.get('amount_currency', None):
            payment_fields['amount_currency'] = ui_paymentline.get('amount_currency')
        return payment_fields

    # wallet rebuild partner for account statement line
    # default of odoo, if one partner have childs
    # and we're choice child
    # odoo will made account bank statement to parent, not child
    # what is that ??? i dont know reasons
    def _prepare_bank_statement_line_payment_values(self, data):
        datas = super(pos_order, self)._prepare_bank_statement_line_payment_values(data)
        if datas.get('journal_id', False):
            journal = self.env['account.journal'].search([('id', '=', datas['journal_id'])])
            if journal and journal[0] and (journal.pos_method_type == 'wallet') and self.partner_id:
                datas.update({'partner_id': self.partner_id.id})
        if data.get('currency_id', None):
            datas['currency_id'] = data['currency_id']
        if data.get('amount_currency', None):
            datas['amount_currency'] = data['amount_currency']
        if data.get('payment_name', False) == 'return':
            datas.update({
                'currency_id': self.env.user.company_id.currency_id.id if self.env.user.company_id.currency_id else None,
                'amount_currency': data['amount']
            })
        return datas


class pos_order_line(models.Model):
    _inherit = "pos.order.line"

    plus_point = fields.Float('Plus point')
    redeem_point = fields.Float('Redeem point')
    partner_id = fields.Many2one('res.partner', related='order_id.partner_id', string='Partner', readonly=1)

    promotion = fields.Boolean('Promotion', readonly=1)
    promotion_reason = fields.Text(string='Promotion reason', readonly=1)
    is_return = fields.Boolean('Return order')
    uom_id = fields.Many2one('product.uom', 'Uom', readonly=1)

    combo_items = fields.Text('Combo items', readonly=1)

    order_uid = fields.Text('order_uid', readonly=1)
    session_info = fields.Text('session_info', readonly=1)
    uid = fields.Text('uid', readonly=1)
    variants = fields.Text('variants', readonly=1)
    tag_ids = fields.Many2many('pos.tag', 'pos_order_line_tag_rel', 'line_id', 'tag_id', string='Tags')

    def get_data(self):
        params = self.env['ir.config_parameter'].sudo().get_param(self._name)
        if params:
            params = ast.literal_eval(params)
            datas = self.with_context(params.get('context', {})).read(params.get('fields', []))[0]
            datas['model'] = self._name
            return datas
        else:
            return None

    @api.model
    def create(self, vals):
        po_line = super(pos_order_line, self).create(vals)
        po_line.sync_data()
        return po_line

    @api.model
    def write(self, vals):
        res = super(pos_order_line, self).write(vals)
        for po_line in self:
            po_line.sync_data()
        return res

    def sync_data(self):
        self.env['pos.cache.database'].add_cache_record(self)
        order_data = self.get_data()
        if order_data:
            sessions = self.env['pos.session'].sudo().search([
                ('state', '=', 'opened'),
            ])
            for session in sessions:
                _logger.info('sync order line with %s' % session.user_id.login)
                self.env['bus.bus'].sendmany(
                    [[(self._cr.dbname, 'pos.order.line', session.user_id.id), json.dumps(order_data)]])
        return True

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_cache_record(record)
        return super(pos_order_line, self).unlink()
