odoo.define('dobtor_pos_promotion_return.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var _t = core._t;

    screens.OrdersHistoryScreenWidget.include({
        click_return_order_by_id: function (id) {
            var self = this;
            self._super(id);

            var order = self.pos.db.orders_history_by_id[id];
            var uid = order.pos_reference &&
                order.pos_reference.match(/\d{1,}-\d{1,}-\d{1,}/g) &&
                order.pos_reference.match(/\d{1,}-\d{1,}-\d{1,}/g)[0];
            var split_sequence_number = uid.split('-');
            var sequence_number = split_sequence_number[split_sequence_number.length - 1];

            var orders = this.pos.get('orders').models;
            var exist_order = orders.find(function (o) {
                return o.mode == "return" && o.uid === uid && Number(o.sequence_number) === Number(sequence_number);
            });

            if (exist_order && exist_order.return_lines.length && !exist_order.orderlines.length) {
                exist_order.return_all();
            }
            
        }
    });

    screens.ActionpadWidget.include({
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
});