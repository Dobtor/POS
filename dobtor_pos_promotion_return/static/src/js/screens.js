odoo.define('dobtor_pos_promotion_return.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var models = require('pos_orders_history.models');
    var _t = core._t;

    screens.OrdersHistoryScreenWidget.include({
        click_return_order_by_id: function (id) {
            var self = this;
            var order = self.pos.db.orders_history_by_id[id];
            var uid = order.pos_reference &&
                order.pos_reference.match(/\d{1,}-\d{1,}-\d{1,}/g) &&
                order.pos_reference.match(/\d{1,}-\d{1,}-\d{1,}/g)[0];
            var split_sequence_number = uid.split('-');
            var sequence_number = split_sequence_number[split_sequence_number.length - 1];

            var orders = this.pos.get('orders').models;
            var exist_order = orders.find(function (o) {
                return o.uid === uid && Number(o.sequence_number) === Number(sequence_number);
            });

            if (exist_order) {
                this.pos.gui.show_popup('error', {
                    'title': _t('Warning'),
                    'body': _t('You have an unfinished return of the order. Please complete the return of the order and try again.'),
                });
                return false;
            }

            var paymentlines = [];
            order.statement_ids.forEach(function (paymentline_id) {
                paymentlines.push(self.pos.db.paymentline_by_id[paymentline_id]);
            });

            var lines = [];
            order.lines.forEach(function (line_id) {
                lines.push(self.pos.db.line_by_id[line_id]);
            });

            var product_list_widget = this.pos.chrome.screens.products.product_list_widget;

            var products = [];
            var current_products_qty_sum = 0;
            lines.forEach(function (line) {
                var product = self.pos.db.get_product_by_id(line.product_id[0]);
                if (line.price_unit !== product.price) {
                    product.old_price = line.price_unit;
                }
                current_products_qty_sum += line.qty;
                products.push(product);
            });

            var returned_orders = this.pos.get_returned_orders_by_pos_reference(order.pos_reference);
            var exist_products_qty_sum = 0;
            returned_orders.forEach(function (o) {
                o.lines.forEach(function (line_id) {
                    var line = self.pos.db.line_by_id[line_id];
                    exist_products_qty_sum += line.qty;
                });
            });

            if (exist_products_qty_sum + current_products_qty_sum <= 0) {
                this.pos.gui.show_popup('error', {
                    'title': _t('Error'),
                    'body': _t('All products have been returned.'),
                });
                return false;
            }

            var partner_id = order.partner_id || false;

            if (products.length > 0) {
                // create new order for return
                var json = _.extend({}, order);
                json.uid = uid;
                json.sequence_number = Number(sequence_number);
                json.lines = [];
                json.statement_ids = [];
                json.mode = "return";
                json.return_lines = lines;
                json.return_paymentline = paymentlines;
                json.pricelist_id = this.pos.default_pricelist.id;
                if (order.table_id) {
                    json.table_id = order.table_id[0];
                }
                var options = _.extend({
                    pos: this.pos
                }, {
                    json: json
                });
                order = new models.Order({}, options);
                
                order.temporary = true;
                var client = null;
                if (partner_id) {
                    client = this.pos.db.get_partner_by_id(partner_id[0]);
                    if (!client) {
                        console.error('ERROR: trying to load a parner not available in the pos');
                    }
                }
                console.log('new order :', order)
                order.set_client(client);
                this.pos.get('orders').add(order);
                this.pos.gui.show_screen('products');
                this.pos.set_order(order);
                product_list_widget.set_product_list(products);

                order.return_all();
            } else {
                this.pos.gui.show_popup('error', _t('Order Is Empty'));
            }
        },
    });

    screens.ActionpadWidget.include({
        click_customer_btn: function(self) {
            this.$('.set-customer').off('click');
            this.$('.set-customer').on('click',function () {
                var order = self.pos.get_order();
                if (!(order.mode && order.mode == 'return')) {
                    self.gui.show_screen('clientlist');
                }
            });
        },
        click_payment_btn: function (self) {
            var self = this;
            var order = self.pos.get_order();
            if (order.mode && order.mode == 'return') {
                var has_valid_product_lot = _.every(order.orderlines.models, function (line) {
                    return line.has_valid_product_lot();
                });
                if (!has_valid_product_lot) {
                    self.gui.show_popup('confirm', {
                        'title': _t('Empty Serial/Lot Number'),
                        'body': _t('One or more product(s) required serial/lot number.'),
                        confirm: function () {
                            self.gui.show_screen('payment');
                        },
                    });
                } else {
                    self.gui.show_screen('payment');
                }
            } else {
                self._super(self);
            }
        }
    });

    screens.OrderWidget.include({
        set_value: function (val) {
            var order = this.pos.get_order();
            if (!(order.mode && order.mode == 'return')) {
                if (order.get_selected_orderline()) {
                    var mode = this.numpad_state.get('mode');
                    if (mode === 'quantity') {
                        order.get_selected_orderline().set_quantity(val);
                    } else if (mode === 'discount') {
                        order.get_selected_orderline().set_discount(val);
                    } else if (mode === 'price') {
                        var selected_orderline = order.get_selected_orderline();
                        selected_orderline.price_manually_set = true;
                        selected_orderline.set_unit_price(val);
                    }
                }
            }
        },
    });

    screens.PaymentScreenWidget.include({
        click_paymentmethods_points: function (id) {
            var cashregister = null;
            for (var i = 0; i < this.pos.cashregisters.length; i++) {
                if (this.pos.cashregisters[i].journal_id[0] === id) {
                    cashregister = this.pos.cashregisters[i];
                    break;
                }
            }
            if (!this.pos.get_order().paymentlines.length) {
                this.pos.get_order().add_paymentline(cashregister);
                this.reset_input();
                this.render_paymentlines();
                var lines = this.pos.get_order().get_paymentlines();
                this.pos.get_order().select_paymentline(lines[0]);
            }
            
        },
        click_paymentmethods: function (id) {
            var order = this.pos.get_order();
            if (!(order.mode && order.mode == 'return')) {
                this._super(id);
            }
        },
        payment_input: function (input) {
            var order = this.pos.get_order();
            if (!(order.mode && order.mode == 'return')) {
                this._super(input);
            }
        },
        return_paymentlines: function () {
            var self = this;
            var order = self.pos.get_order();
            if (order.mode && order.mode == 'return') {
                if (order.return_paymentline && order.return_paymentline.length) {
                    order.return_paymentline.forEach(function (paymentline_id) {
                        if (paymentline_id.name.includes(_t('point'))) {
                            self.click_paymentmethods_points(paymentline_id.journal_id[0]);
                            order.selected_paymentline.set_amount(-paymentline_id.amount);
                            self.order_changes();
                            self.render_paymentlines();
                            self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(-paymentline_id.amount));
                        }
                    });
                }
            }
        },
        show: function () {
            this._super();
            this.return_paymentlines();
        },
    });

});