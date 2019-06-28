odoo.define('dobtor_pos_promotion_return.models', function (require) {
    "use strict";

    var models = require('pos_orders_history.models');
    var utils = require('web.utils');
    var rpc = require('web.rpc');
    var core = require('web.core');
    var _t = core._t;
    var round_pr = utils.round_precision;
    var exports = models;

    var _super_pos_model = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        on_orders_history_updates: function (message) {
            _super_pos_model.on_orders_history_updates.apply(this, arguments);
            var self = this;
            message.updated_orders.forEach(function (id) {
                self.get_order_history_paymentlines_by_order_id(id).done(function (lines) {
                    self.update_orders_history_paymentlines(lines);
                });
            });
        },
        get_order_history_paymentlines_by_order_id: function (id) {
            return rpc.query({
                model: 'account.bank.statement.line',
                method: 'search_read',
                args: [
                    [
                        ['pos_statement_id', '=', id]
                    ]
                ]
            });
        },
        update_orders_history_paymentlines: function (lines) {
            var self = this;
            var all_lines = this.db.pos_orders_history_paymentlines.concat(lines);
            this.db.pos_orders_history_paymentlines = all_lines;
            all_lines.forEach(function (line) {
                self.db.paymentline_by_id[line.id] = line;
            });
        },
        
    });

    var _super_order = exports.Order.prototype;
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
        },
        get_return_paymentline: function() {
            return this.return_paymentline;
        },
        export_as_JSON: function () {
            var data = _super_order.export_as_JSON.apply(this, arguments);
            data.return_paymentline = this.return_paymentline;
            return data;
        },
        init_from_JSON: function (json) {
            this.return_paymentline = json.return_paymentline;
            _super_order.init_from_JSON.call(this, json);
        }
    });

    // paymentsline
    models.load_models({
        model: 'account.bank.statement.line',
        fields: [],
        domain: function (self) {
            return [
                ['pos_statement_id', 'in', self.order_ids]
            ];
        },
        condition: function (self) {
            return self.config.orders_history && !self.config.load_barcode_order_only;
        },
        loaded: function (self, lines) {
            self.update_orders_history_paymentlines(lines);
        },
    });

    return models;
});