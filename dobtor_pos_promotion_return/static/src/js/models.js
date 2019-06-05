odoo.define('dobtor_pos_promotion_return.models', function (require) {
    "use strict";

    var models = require('pos_orders_history.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var _t = core._t;
    var round_pr = utils.round_precision;
    var exports = models;


    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
        return_all: function () {
            var order = this;
            _.each(order.return_lines, function (line) {
                var current_product = order.pos.db.get_product_by_id(line.product_id[0]);
                if (line.compute_name) {
                    current_product = $.extend(true, {}, current_product);
                }
                order.add_product(current_product, {
                    'price': line.price_unit,
                    'quantity': -line.qty
                });
                if (line.compute_name) {
                    order.selected_orderline.product.display_name = line.compute_name;
                }
            });
            if (order.return_lines.length) {
                this.select_orderline(order.orderlines.models[0]);
            }
        }
    });
});