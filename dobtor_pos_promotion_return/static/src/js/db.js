odoo.define('dobtor_pos_promotion_return.db', function (require) {
    "use strict";
    var PosDB = require('point_of_sale.DB');

    PosDB.include({
        init: function (options) {
            // payment lines
            this.paymentline_by_id = {};
            this.pos_orders_history_paymentlines = [];
            this._super.apply(this, arguments);
        },
        get_unpaid_orders: function () {
            var saved = this.load('unpaid_orders', []);
            var orders = [];
            for (var i = 0; i < saved.length; i++) {
                if (saved[i].data.mode !== 'return') {
                    orders.push(saved[i].data);
                }
            }
            return orders;
        },
    });

    return PosDB;
});