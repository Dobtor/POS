/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.model', function (require) {
    var models = require('point_of_sale.models');
    var time = require('web.time');
    var utils = require('web.utils');
    var core = require('web.core');
    var round_pr = utils.round_precision;
    var _t = core._t;
    var rpc = require('web.rpc');
    var big_data = require('pos_retail.big_data');

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {

            var self = this;
            var product_model = _.find(this.models, function (model) {
                return model.model === 'product.product';
            });
            product_model.fields.push(
                'combo_limit',
                'uom_po_id',
                'barcode_ids',
                'pos_categ_ids',
                'supplier_barcode',
                'qty_available',
                'supplier_taxes_id',
                'volume',
                'weight',
                'description_sale',
                'description_picking',
                'type',
                'categ_id'
            );

            var partner_model = _.find(this.models, function (model) {
                return model.model === 'res.partner';
            });
            partner_model.fields.push('credit', 'debit', 'balance', 'limit_debit', 'wallet', 'pos_loyalty_point', 'pos_loyalty_type', 'property_product_pricelist'); // v10 add property_product_pricelist
            var journal_model = _.find(this.models, function (model) {
                return model.model === 'account.journal';
            });
            journal_model.fields.push('pos_method_type');

            _super_PosModel.initialize.apply(this, arguments);
            this.bind('change:selectedOrder', function () {
                var selectedOrder = self.get_order();
                if (self.pos_bus && self.config && self.config.bus_id[0] && selectedOrder) {
                    self.pos_bus.push_message_to_other_sessions({
                        action: 'selected_order',
                        data: {
                            uid: selectedOrder['uid']
                        },
                        bus_id: self.config.bus_id[0],
                        order_uid: selectedOrder['uid'],
                    });
                }
            });
            this.get('orders').bind('change add remove', function (order) {
                self.trigger('update:table-list');
            });
            // timeout 5s auto call backend get data so
            setInterval(function () {
                self.get_data_from_sale_order();
            }, 5000);
        },
        // thay doi thong tin san pham
        syncing_product: function (product_data) {
            var self = this;
            this.trigger('product:updated', product_data)

        },
        syncing_partner: function (customer_data) {
            this.trigger('update:customer_screen', customer_data);
        },
        // thay doi items cua pricelist
        syncing_pricelist: function (pricelist_data) {
            if (this.default_pricelist && this.default_pricelist['id'] == pricelist_data['id']) {
                pricelist_data['items'] = this.default_pricelist['items']
                this.default_pricelist = pricelist_data;
            }
            if (this.pricelists) {
                for (var i = 0; i < this.pricelists.length; i++) {
                    if (this.pricelists[i]['id'] == pricelist_data['id']) {
                        pricelist_data['items'] = this.pricelists[i]['items']
                        this.pricelists[i] = pricelist_data;
                    }
                }
            }
        },
        // thay doi items cua pricelist
        syncing_pricelist_item: function (pricelist_item) {
            var pricelist_by_id = {};
            _.each(this.pricelists, function (pricelist) {
                pricelist_by_id[pricelist.id] = pricelist;
            });
            var pricelist = pricelist_by_id[pricelist_item.pricelist_id[0]];
            if (pricelist) {
                var append_items = false;
                for (var i = 0; i < pricelist.items.length; i++) {
                    if (pricelist.items[i]['id'] == pricelist_item['id']) {
                        pricelist.items[i] = pricelist_item;
                        append_items = true
                    }
                }
                if (append_items == false) {
                    pricelist.items.push(pricelist_item);
                }
            }
        },
        scan_product: function (parsed_code) {
            var self = this;
            var product = this.db.get_product_by_barcode(parsed_code.base_code);
            var lot_by_barcode = this.lot_by_barcode;
            var lots = lot_by_barcode[parsed_code.base_code];
            var selectedOrder = this.get_order();
            var products_by_supplier_barcode = this.db.product_by_supplier_barcode[parsed_code.base_code];
            var barcodes = this.barcodes_by_barcode[parsed_code.base_code];
            if (!product && lots && lots.length) { // scan lot
                if (lots.length > 1) {
                    var list = [];
                    for (var i = 0; i < lots.length; i++) {
                        list.push({
                            'label': lots[i]['name'],
                            'item': lots[i]
                        })
                    }
                    this.gui.show_popup('selection', {
                        title: _t('Select Lot'),
                        list: list,
                        confirm: function (lot) {
                            product = self.db.product_by_id[lot.product_id[0]]
                            selectedOrder.add_product(product, {});
                            $('.packlot-line-input').remove(); // fix on safari
                            self.gui.close_popup();
                            var selected_orderline = selectedOrder.get_selected_orderline();
                            setTimeout(function () {
                                var pack_models = selected_orderline.pack_lot_lines.models;
                                for (var i = 0; i < pack_models.length; i++) {
                                    var pack_model = pack_models[i];

                                    pack_model.set_lot_name(lot['name']);
                                }
                                selected_orderline.trigger('change', selected_orderline);
                            }, 1000);
                            return true
                        }
                    });
                    return true
                }
                else if (lots.length == 1) {
                    var lot = lots[0];
                    product = self.db.product_by_id[lot.product_id[0]]
                    selectedOrder.add_product(product, {});
                    $('.packlot-line-input').remove(); // fix on safari
                    this.gui.close_popup();
                    var selected_orderline = selectedOrder.get_selected_orderline();
                    setTimeout(function () {
                        var pack_models = selected_orderline.pack_lot_lines.models;
                        for (var i = 0; i < pack_models.length; i++) {
                            var pack_model = pack_models[i];

                            pack_model.set_lot_name(lot['name']);
                        }
                        selected_orderline.trigger('change', selected_orderline);
                    }, 1000);
                    return true
                }
            }
            else if (products_by_supplier_barcode) { // scan code by suppliers code
                var products = []
                for (var i = 0; i < products_by_supplier_barcode.length; i++) {
                    products.push({
                        label: products_by_supplier_barcode[i]['display_name'],
                        item: products_by_supplier_barcode[i]
                    })
                }

                var product = this.db.get_product_by_barcode(parsed_code.base_code);
                if (product) {
                    products.push({
                        label: product['display_name'],
                        item: product
                    })
                }
                this.gui.show_popup('selection', {
                    title: _t('Select product'),
                    list: products,
                    confirm: function (product) {
                        var selectedOrder = self.get('selectedOrder');
                        if (selectedOrder) {
                            if (parsed_code.type === 'price') {
                                selectedOrder.add_product(product, {
                                    quantity: 1,
                                    price: product['list_price'],
                                    merge: true
                                });
                            } else if (parsed_code.type === 'weight') {
                                selectedOrder.add_product(product, {
                                    quantity: 1,
                                    price: product['list_price'],
                                    merge: false
                                });
                            } else if (parsed_code.type === 'discount') {
                                selectedOrder.add_product(product, {discount: parsed_code.value, merge: false});
                            } else {
                                selectedOrder.add_product(product);
                            }
                        }
                    }
                });
                return true
            }
            else if (product && barcodes) { // multi barcode, if have product and barcodes
                var list = [{
                    'label': product['name'] + '| price: ' + product['list_price'] + ' | qty: 1 ' + '| and Uoms: ' + product['uom_id'][1],
                    'item': product,
                }];
                for (var i = 0; i < barcodes.length; i++) {
                    var barcode = barcodes[i];
                    list.push({
                        'label': barcode['product_id'][1] + '| price: ' + barcode['list_price'] + ' | qty: ' + barcode['quantity'] + '| and Uoms: ' + barcode['uom_id'][1],
                        'item': barcode,
                    });
                }

                this.gui.show_popup('selection', {
                    title: _t('Select product'),
                    list: list,
                    confirm: function (item) {
                        var barcode;
                        var product;
                        if (item['product_id']) {
                            barcode = item;
                            product = self.db.product_by_id[barcode.product_id[0]]
                            selectedOrder.add_product(product, {
                                price: barcode['list_price'],
                                quantity: barcode['quantity'],
                                extras: {
                                    uom_id: barcode['uom_id'][0]
                                }
                            });
                        } else {
                            product = item;
                            selectedOrder.add_product(product, {});
                        }
                    }
                });
                if (list.length > 0) {
                    return true;
                }
            }
            else if (!product && barcodes) { // not have product but have barcodes
                if (barcodes.length == 1) {
                    var barcode = barcodes[0]
                    var product = this.db.product_by_id[barcode['product_id'][0]];
                    if (product) {
                        selectedOrder.add_product(product, {
                            price: barcode['list_price'],
                            quantity: barcode['quantity'],
                            extras: {
                                uom_id: barcode['uom_id'][0]
                            }
                        });
                        return true;
                    }
                } else if (barcodes.length > 1) {
                    // if multi items the same barcode, require cashier select
                    var list = [];
                    for (var i = 0; i < barcodes.length; i++) {
                        var barcode = barcodes[i];
                        list.push({
                            'label': barcode['product_id'][1] + '| price: ' + barcode['list_price'] + ' | qty: ' + barcode['quantity'] + '| and Uoms: ' + barcode['uom_id'][1],
                            'item': barcode,
                        });
                    }
                    this.gui.show_popup('selection', {
                        title: _t('Select product'),
                        list: list,
                        confirm: function (barcode) {
                            var product = self.db.product_by_id[barcode['product_id'][0]];
                            if (product) {
                                selectedOrder.add_product(product, {
                                    price: barcode['list_price'],
                                    quantity: barcode['quantity'],
                                    extras: {
                                        uom_id: barcode['uom_id'][0]
                                    }
                                });
                            }
                        }
                    });
                    if (list.length > 0) {
                        return true;
                    }
                }
            }
            // if not pass any conditions, return to default odoo
            return _super_PosModel.scan_product.apply(this, arguments);
        },
        set_table: function (table) {
            _super_PosModel.set_table.apply(this, arguments);
            this.trigger('update:table-list');
        },
        _save_to_server: function (orders, options) {
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                if ((order.data.plus_point || order.data.redeem_point) && order.data.partner_id) {
                    var customer = this.db.get_partner_by_id(order.data.partner_id)
                    if (order.data.plus_point != undefined) {
                        customer['pos_loyalty_point'] += order.data.plus_point;
                    }
                    if (order.data.redeem_point != undefined) {
                        customer['pos_loyalty_point'] -= order.data.redeem_point;
                    }
                    this.db.partner_by_id[order.data.partner_id] = customer;
                    this.trigger('update:point-client');
                }
            }
            return _super_PosModel._save_to_server.call(this, orders, options);
        },
        push_order: function (order, opts) {
            var self = this;
            var pushed = _super_PosModel.push_order.apply(this, arguments);
            var client = order && order.get_client();
            if (client) {
                for (var i = 0; i < order.paymentlines.models.length; i++) {
                    var line = order.paymentlines.models[i];
                    var amount = line.get_amount();
                    var journal = line.cashregister.journal;
                    if (journal.pos_method_type == 'wallet') {
                        client.wallet = -amount;
                    }
                    if (journal.credit) {
                        client.balance -= line.get_amount(); // update balance when payment viva credit journal
                    }
                }
                this.trigger('update:customer_screen');
            }
            return pushed;
        },
        get_balance: function (client) {
            var balance = round_pr(client.balance, this.currency.rounding)
            return (Math.round(balance * 100) / 100).toString()
        },
        get_wallet: function (client) {
            var wallet = round_pr(client.wallet, this.currency.rounding)
            return (Math.round(wallet * 100) / 100).toString()
        },
        get_data_from_sale_order: function () {
            var self = this;
            if (!this.the_first_load || this.the_first_load == true || !this.config || !this.config.shop_ids) {
                return;
            }
            if (this.config && this.config.shop_ids && this.config.shop_ids.length) {
                return;
            }
            rpc.query({
                model: 'sale.order',
                method: 'compute_orders_send_to_pos',
                args: [this.config.shop_ids],
            }, {
                timeout: 1000,
                shadow: true
            })
                .then(function (sale_orders) {
                    if (!sale_orders.length) {
                        return;
                    }
                    var orders = self.get('orders');
                    for (var x = 0; x < sale_orders.length; x++) {
                        var order = orders.find(function (order) {
                            return order.uid == sale_orders[x].uid;
                        });
                        if (order) {
                            order.destroy({'reason': 'abandon'});
                        }
                        var order = new models.Order({}, {pos: self, json: sale_orders[x]});
                        order.syncing = true;
                        orders.add(order);
                        order.trigger('change', order);
                    }
                }).fail(function (type, error) {
                if (error.code === 200) {
                    self.gui.show_popup('error-traceback', {
                        'title': error.data.message,
                        'body': error.data.debug
                    });
                }
            });
        },
        add_return_order: function (order, lines) {
            var partner_id = order['partner_id']
            var return_order_id = order['id']
            var order = new models.Order({}, {pos: this});
            order['is_return'] = true;
            this.get('orders').add(order);
            if (partner_id && partner_id[0]) {
                var client = this.db.get_partner_by_id(partner_id[0]);
                order['return_order_id'] = return_order_id;
                order['pos_reference'] = 'Return/' + order['name'];
                order['name'] = 'Return/' + order['name'];
                order.set_client(client);
            }
            this.set('selectedOrder', order);
            for (var i = 0; i < lines.length; i++) {
                var line_return = lines[i];
                var price = line_return['price_unit'];
                var quantity = 0;
                var product = this.db.get_product_by_id(line_return.product_id[0])
                var line = new models.Orderline({}, {pos: this, order: order, product: product});
                line['is_return'] = true;
                // loyalty back
                if (line_return.plus_point) {
                    line.plus_point = -line_return.plus_point;
                }
                if (line_return.redeem_point) {
                    line.redeem_point = -line_return.redeem_point;
                }
                // end loyalty
                order.orderlines.add(line);
                line.set_unit_price(price);
                if (line_return['new_quantity']) {
                    quantity = -line_return['new_quantity']
                } else {
                    quantity = -line_return['qty']
                }
                if (quantity > 0) {
                    quantity = -quantity
                }
                line.set_quantity(quantity, 'keep price when return');
                line.trigger('change', line);
                order.trigger('change', order);
            }
            return order;
        },
        // sync stock on hand
        update_stock: function (message) {
            var self = this;
            var product_id = message['product_id']
            var product = this.db.get_product_by_id(product_id);
            var data = _.find(message['stock_datas'], function (vals) {
                return vals['stock_location_id'] == self.config.stock_location_id[0]
            });
            if (data && product) {
                product['qty_available'] = data['qty_available'];
                self.trigger('product:updated', product);

            }
        },
        // lock unlock order
        set_start_order: function () {
            var self = this;
            var res = _super_PosModel.set_start_order.apply(this, arguments);
            var order = this.get_order();
            if (order && order['lock'] && this.config.lock_order_printed_receipt) {
                setTimeout(function () {
                    self.lock_order();
                }, 1000)
            }
            if (this.version['server_serie'] == "10.0" && order && order.pricelist) {
                order.set_pricelist_to_order(order.pricelist)
            }
            return res
        },
        lock_order: function () {
            $('.rightpane').addClass('oe_hidden');
            $('.buttons_pane').addClass('oe_hidden');
            $('.timeline').addClass('oe_hidden');
            $('.find_customer').addClass('oe_hidden');
            $('.hide_numpad').addClass('oe_hidden');
            $('.leftpane').css({'left': '0px'});
            if (this.config.staff_level == 'marketing' || this.config.staff_level == 'waiter') {
                $('.numpad').addClass('oe_hidden');
                $('.actionpad').addClass('oe_hidden');
            }
            if (this.config.staff_level == 'cashier') {
                $('.numpad').addClass('oe_hidden');
            }

        },
        unlock_order: function () {
            $('.rightpane').removeClass('oe_hidden');
            $('.buttons_pane').removeClass('oe_hidden');
            $('.timeline').removeClass('oe_hidden');
            $('.find_customer').removeClass('oe_hidden');
            $('.hide_numpad').removeClass('oe_hidden');
            $('.numpad').removeClass('oe_hidden');
            $('.actionpad').removeClass('oe_hidden');
            $('.leftpane').css({'left': '220px'});

        }
    });

    models.load_models([
        {
            model: 'res.users',
            fields: [],
            loaded: function (self, users) {
                self.user_by_id = {};
                self.user_by_pos_security_pin = {};
                self.user_by_barcode = {};
                for (var i=0; i < users.length; i++) {
                    if (users[i]['pos_security_pin']) {
                        self.user_by_pos_security_pin[users[i]['pos_security_pin']] = users[i];
                    }
                    if (users[i]['barcode']) {
                        self.user_by_barcode[users[i]['barcode']] = users[i];
                    }
                    self.user_by_id[users[i]['id']] = users[i];
                }
            }
        },
        {
            model: 'pos.promotion',
            condition: function (self) {
                return self.config.promotion;
            },
            fields: [],
            domain: function (self) {
                return [
                    ['id', 'in', self.config.promotion_ids],
                    ['start_date', '<=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                    ['end_date', '>=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                ]
            },
            context: {'pos': true},
            loaded: function (self, promotions) {
                self.promotions = promotions;
                self.promotion_by_id = {};
                self.promotion_ids = [];
                var i = 0;
                while (i < promotions.length) {
                    self.promotion_by_id[promotions[i].id] = promotions[i];
                    self.promotion_ids.push(promotions[i].id);
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.order',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, discounts) {
                self.promotion_discount_order_by_id = {};
                self.promotion_discount_order_by_promotion_id = {};
                var i = 0;
                while (i < discounts.length) {
                    self.promotion_discount_order_by_id[discounts[i].id] = discounts[i];
                    if (!self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]]) {
                        self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]] = [discounts[i]]
                    } else {
                        self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]].push(discounts[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.category',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, discounts_category) {
                self.promotion_by_category_id = {};
                var i = 0;
                while (i < discounts_category.length) {
                    self.promotion_by_category_id[discounts_category[i].category_id[0]] = discounts_category[i];
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.quantity',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, discounts_quantity) {
                self.promotion_quantity_by_product_id = {};
                var i = 0;
                while (i < discounts_quantity.length) {
                    if (!self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]]) {
                        self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]] = [discounts_quantity[i]]
                    } else {
                        self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]].push(discounts_quantity[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.gift.condition',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, gift_conditions) {
                self.promotion_gift_condition_by_promotion_id = {};
                var i = 0;
                while (i < gift_conditions.length) {
                    if (!self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]]) {
                        self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]] = [gift_conditions[i]]
                    } else {
                        self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]].push(gift_conditions[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.gift.free',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, gifts_free) {
                self.promotion_gift_free_by_promotion_id = {};
                var i = 0;
                while (i < gifts_free.length) {
                    if (!self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]]) {
                        self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]] = [gifts_free[i]]
                    } else {
                        self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]].push(gifts_free[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.condition',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, discount_conditions) {
                self.promotion_discount_condition_by_promotion_id = {};
                var i = 0;
                while (i < discount_conditions.length) {
                    if (!self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]]) {
                        self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]] = [discount_conditions[i]]
                    } else {
                        self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]].push(discount_conditions[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.apply',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, discounts_apply) {
                self.promotion_discount_apply_by_promotion_id = {};
                var i = 0;
                while (i < discounts_apply.length) {
                    if (!self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]]) {
                        self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]] = [discounts_apply[i]]
                    } else {
                        self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]].push(discounts_apply[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.price',
            fields: [],
            condition: function (self) {
                return self.config.promotion;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, prices) {
                self.promotion_price_by_promotion_id = {};
                var i = 0;
                while (i < prices.length) {
                    if (!self.promotion_price_by_promotion_id[prices[i].promotion_id[0]]) {
                        self.promotion_price_by_promotion_id[prices[i].promotion_id[0]] = [prices[i]]
                    } else {
                        self.promotion_price_by_promotion_id[prices[i].promotion_id[0]].push(prices[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.tag',
            fields: [],
            loaded: function (self, tags) {
                self.tags = tags;
                self.tag_by_id = {};
                var i = 0;
                while (i < tags.length) {
                    self.tag_by_id[tags[i].id] = tags[i];
                    i++;
                }
            }
        }, {
            model: 'pos.note',
            fields: [],
            loaded: function (self, notes) {
                self.notes = notes;
                self.note_by_id = {};
                var i = 0;
                while (i < notes.length) {
                    self.note_by_id[notes[i].id] = notes[i];
                    i++;
                }
            }
        }, {
            model: 'pos.combo.item',
            fields: ['product_id', 'product_combo_id', 'default', 'quantity', 'uom_id', 'tracking'],
            loaded: function (self, combo_items) {
                self.combo_items = combo_items;
                self.combo_item_by_id = {}
                for (var i = 0; i < combo_items.length; i++) {
                    self.combo_item_by_id[combo_items[i].id] = combo_items[i];
                }
            }
        },
        {
            model: 'stock.production.lot',
            fields: [],
            loaded: function (self, lots) {
                self.lots = lots;
                self.lot_by_name = {};
                self.lot_by_barcode = {};
                for (var i = 0; i < lots.length; i++) {
                    var lot = lots[i];
                    self.lot_by_name[lot['name']] = lot;
                    if (lot['barcode']) {
                        if (self.lot_by_barcode[lot['barcode']]) {
                            self.lot_by_barcode[lot['barcode']].push(lot)
                        } else {
                            self.lot_by_barcode[lot['barcode']] = [lot]
                        }
                    }
                }
            }
        }, {
            model: 'account.journal',
            fields: [],
            domain: function (self, tmp) {
                return [['id', 'in', tmp.journals]];
            },
            context: {'pos': true},
            loaded: function (self, journals) {
                self.journal_by_id = {};
                for (var i = 0; i < journals.length; i++) {
                    self.journal_by_id[journals[i]['id']] = journals[i];
                }
            }
        }, {
            model: 'pos.config.image',
            condition: function (self) {
                return self.config.is_customer_screen;
            },
            fields: [],
            domain: function (self) {
                return [['config_id', '=', self.config.id]]
            },
            context: {'pos': true},
            loaded: function (self, images) {
                self.images = images;
            }
        }, {
            model: 'pos.global.discount',
            fields: [],
            context: {'pos': true},
            loaded: function (self, discounts) {
                self.discounts = discounts;
                self.discount_by_id = {};
                var i = 0;
                while (i < discounts.length) {
                    self.discount_by_id[discounts[i].id] = discounts[i];
                    i++;
                }
            }
        }, {
            model: 'stock.picking.type',
            domain: function (self) {
                return [['code', '=', 'internal']]
            },
            condition: function (self) {
                return self.config.internal_transfer;
            },
            loaded: function (self, stock_picking_types) {
                for (var i = 0; i < stock_picking_types.length; i++) {
                    if (stock_picking_types[i].warehouse_id) {
                        stock_picking_types[i]['name'] = stock_picking_types[i].warehouse_id[1] + ' / ' + stock_picking_types[i]['name']
                    }
                }
                self.stock_picking_types = stock_picking_types;
                self.stock_picking_type_by_id = {};
                for (var i = 0; i < stock_picking_types.length; i++) {
                    self.stock_picking_type_by_id[stock_picking_types[i]['id']] = stock_picking_types[i];
                }
                if (stock_picking_types.length == 0) {
                    self.config.internal_transfer = false
                }
            }
        },
        {
            model: 'stock.location',
            domain: function (self) {
                return [['usage', '=', 'internal']]
            },
            condition: function (self) {
                return self.config.internal_transfer;
            },
            loaded: function (self, stock_locations) {
                for (var i = 0; i < stock_locations.length; i++) {
                    if (stock_locations[i].location_id) {
                        stock_locations[i]['name'] = stock_locations[i].location_id[1] + ' / ' + stock_locations[i]['name']
                    }
                }
                self.stock_locations = stock_locations;
                self.stock_location_by_id = {};
                for (var i = 0; i < stock_locations.length; i++) {
                    self.stock_location_by_id[stock_locations[i]['id']] = stock_locations[i];
                }
                if (stock_locations.length == 0) {
                    console.error('Location have usage is internal is null');
                }
            },
        }, {
            model: 'pos.loyalty',
            fields: [],
            domain: function (self) {
                return [
                    ['id', 'in', self.config.loyalty_ids],
                    ['start_date', '<=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                    ['end_date', '>=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                ]
            },
            loaded: function (self, loyalties) {
                self.loyalty_by_id = {};
                self.loyalty_ids = [];
                for (var i = 0; i < loyalties.length; i++) {
                    self.loyalty_by_id[loyalties[i].id] = loyalties[i];
                    self.loyalty_ids.push(loyalties[i].id)
                }
            }
        }
        , {
            model: 'pos.loyalty.rule',
            fields: [],
            domain: function (self) {
                return [['loyalty_id', 'in', self.loyalty_ids]]
            },
            loaded: function (self, rules) {
                self.rules = rules;
                self.rule_ids = [];
                self.rule_by_id = {};
                self.rules_by_loyalty_id = {};
                for (var i = 0; i < rules.length; i++) {
                    self.rule_by_id[rules[i].id] = rules[i];
                    self.rule_ids.push(rules[i].id)
                    if (!self.rules_by_loyalty_id[rules[i].loyalty_id[0]]) {
                        self.rules_by_loyalty_id[rules[i].loyalty_id[0]] = [rules[i]];
                    } else {
                        self.rules_by_loyalty_id[rules[i].loyalty_id[0]].push(rules[i]);
                    }
                }
            }
        }, {
            model: 'pos.loyalty.rule.order.amount',
            fields: [],
            domain: function (self) {
                return [['rule_id', 'in', self.rule_ids]]
            },
            loaded: function (self, rules_order_amount) {
                self.rules_order_amount = rules_order_amount;
                self.order_amount_by_rule_id = {};
                for (var i = 0; i < rules_order_amount.length; i++) {
                    if (!self.order_amount_by_rule_id[rules_order_amount[i].rule_id[0]]) {
                        self.order_amount_by_rule_id[rules_order_amount[i].rule_id[0]] = [rules_order_amount[i]];
                    } else {
                        self.order_amount_by_rule_id[rules_order_amount[i].rule_id[0]].push(rules_order_amount[i]);
                    }
                }
            }
        }, {
            model: 'pos.loyalty.reward',
            fields: [],
            domain: function (self) {
                return [['loyalty_id', 'in', self.loyalty_ids]]
            },
            loaded: function (self, rewards) {
                self.rewards = rewards;
                self.reward_by_id = {};
                self.rewards_by_loyalty_id = {};
                for (var i = 0; i < rewards.length; i++) {
                    self.reward_by_id[rewards[i].id] = rewards[i];
                    if (!self.rewards_by_loyalty_id[rewards[i].loyalty_id[0]]) {
                        self.rewards_by_loyalty_id[rewards[i].loyalty_id[0]] = [rewards[i]];
                    } else {
                        self.rewards_by_loyalty_id[rewards[i].loyalty_id[0]].push([rewards[i]]);
                    }
                }
            }
        }, {
            model: 'res.currency',
            fields: ['id', 'name', 'rounding', 'rate'],
            domain: [],
            loaded: function (self, currencies) {
                self.currency_by_id = {}
                self.currencies = currencies;
                var i = 0
                while (i < currencies.length) {
                    self.currency_by_id[currencies[i].id] = currencies[i]
                    i++
                }
                var cashregisters = self.cashregisters;
                for (var i = 0; i < cashregisters.length; i++) {
                    cashregister = cashregisters[i];
                    if (cashregister['currency_id'] && cashregister['currency_id'][0]) {
                        cashregister['rate'] = self.currency_by_id[cashregister['currency_id'][0]]['rate']
                    }
                }
            }
        }, {
            model: 'product.uom.price',
            fields: [],
            domain: [],
            context: {'pos': true},
            loaded: function (self, uoms_prices) {
                self.uom_price_by_uom_id = {}
                self.uoms_prices_by_product_tmpl_id = {}
                self.uoms_prices = uoms_prices;
                for (var i = 0; i < uoms_prices.length; i++) {
                    var item = uoms_prices[i];
                    if (item.product_tmpl_id) {
                        self.uom_price_by_uom_id[item.uom_id[0]] = item;
                        if (!self.uoms_prices_by_product_tmpl_id[item.product_tmpl_id[0]]) {
                            self.uoms_prices_by_product_tmpl_id[item.product_tmpl_id[0]] = [item]
                        } else {
                            self.uoms_prices_by_product_tmpl_id[item.product_tmpl_id[0]].push(item)
                        }
                    }
                }
            }
        }, {
            model: 'product.barcode',
            fields: ['product_tmpl_id', 'quantity', 'list_price', 'uom_id', 'barcode', 'product_id'],
            domain: function (self) {
                return []
            },
            context: {'pos': true},
            loaded: function (self, barcodes) {
                self.barcodes = barcodes;
                self.barcodes_by_barcode = {};
                for (var i = 0; i < barcodes.length; i++) {
                    if (!barcodes[i]['product_id']) {
                        continue
                    }
                    if (!self.barcodes_by_barcode[barcodes[i]['barcode']]) {
                        self.barcodes_by_barcode[barcodes[i]['barcode']] = [barcodes[i]];
                    } else {
                        self.barcodes_by_barcode[barcodes[i]['barcode']].push(barcodes[i]);
                    }
                }
            }
        }, {
            model: 'product.variant',
            fields: ['product_tmpl_id', 'value_id', 'price_extra', 'product_id', 'quantity', 'uom_id'],
            domain: function (self) {
                return [];
            },
            loaded: function (self, variants) {
                self.variants = variants;
                self.variant_by_product_tmpl_id = {};
                self.variant_by_id = {};
                for (var i = 0; i < variants.length; i++) {
                    var variant = variants[i];
                    self.variant_by_id[variant.id] = variant;
                    if (!self.variant_by_product_tmpl_id[variant['product_tmpl_id'][0]]) {
                        self.variant_by_product_tmpl_id[variant['product_tmpl_id'][0]] = [variant]
                    } else {
                        self.variant_by_product_tmpl_id[variant['product_tmpl_id'][0]].push(variant)
                    }
                }
            }
        }, {
            model: 'pos.category',
            fields: [],
            domain: null,
            loaded: function (self, categories) {
                self.categories = categories;
            }
        }, {
            model: 'pos.quickly.payment',
            fields: [],
            domain: function (self) {
                return []
            },
            context: {'pos': true},
            loaded: function (self, quickly_datas) {
                self.quickly_datas = quickly_datas;
                self.quickly_payment_by_id = {};
                for (var i = 0; i < quickly_datas.length; i++) {
                    self.quickly_payment_by_id[quickly_datas[i].id] = quickly_datas[i];
                }
            }
        }, {
            model: 'pos.voucher',
            fields: [],
            domain: function (self) {
                return [['state', '=', 'active']]
            },
            context: {'pos': true},
            loaded: function (self, vouchers) {
                self.vouchers = vouchers;
                self.voucher_by_id = {};
                for (var x = 0; x < vouchers.length; x++) {
                    self.voucher_by_id[vouchers[x].id] = vouchers[x];
                }
            }
        }, {
            model: 'pos.order',
            condition: function (self) {
                return self.config.allow_return_order;
            },
            fields: [],
            domain: function (self) {
                return [
                    ['state', '!=', 'cancel'],
                    ['lock_return', '=', false],
                ];
            },
            context: {'pos': true},
            loaded: function (self, orders) {
                self.order_ids = [];
                for (var i = 0; i < orders.length; i++) {
                    self.order_ids.push(orders[i].id)
                }
                self.db.save_pos_orders(orders);
            }
        }, {
            model: 'pos.order.line',
            fields: [],
            domain: function (self) {
                return [];
            },
            context: {'pos': true},
            loaded: function (self, order_lines) {
                self.db.save_pos_order_line(order_lines);
            }
        }, {
            model: 'account.invoice',
            condition: function (self) {
                return self.config.management_invoice;
            },
            fields: [],
            domain: function (self) {
                return [['state', '!=', 'cancel']];
            },
            context: {'pos': true},
            loaded: function (self, invoices) {
                self.db.save_invoices(invoices);
            }
        }, {
            model: 'account.payment.method',
            condition: function (self) {
                return self.config.management_invoice;
            },
            fields: [],
            domain: function (self) {
                return [];
            },
            context: {'pos': true},
            loaded: function (self, payment_methods) {
                self.payment_methods = payment_methods;
            }
        }, {
            model: 'account.payment.term',
            condition: function (self) {
                return true;
            },
            fields: [],
            domain: function (self) {
                return [];
            },
            context: {'pos': true},
            loaded: function (self, payments_term) {
                self.payments_term = payments_term;
            }
        }, {
            model: 'product.pricelist',
            fields: ['name', 'display_name'],
            domain: [],
            loaded: function (self, pricelists) {
                if (self.version.server_serie == "10.0") {
                    self.default_pricelist = _.find(pricelists, {id: self.config.pricelist_id[0]});
                    self.pricelists = pricelists;
                    self.pricelist_by_id = {};
                    _.map(pricelists, function (pricelist) {
                        pricelist.items = [];
                        self.pricelist_by_id[pricelist['id']] = pricelist;
                    });
                }
            }
        }, {
            model: 'product.pricelist.item',
            fields: [],
            domain: [],
            loaded: function (self, pricelist_items) {
                if (self.version.server_serie == "10.0") {
                    _.each(pricelist_items, function (item) {
                        var pricelist = self.pricelist_by_id[item.pricelist_id[0]];
                        if (pricelist) {
                            pricelist.items.push(item);
                        }
                        item.base_pricelist = self.pricelist_by_id[item.base_pricelist_id[0]];
                    });
                }

            }
        }, {
            model: 'product.cross',
            fields: ['product_id', 'list_price', 'quantity', 'discount_type', 'discount', 'product_tmpl_id'],
            domain: [],
            loaded: function (self, cross_items) {
                self.cross_items = cross_items;
                self.cross_item_by_id = {};
                for (var i = 0; i < cross_items.length; i++) {
                    self.cross_item_by_id[cross_items[i]['id']] = cross_items[i];
                }
            }
        }
    ]);
});
