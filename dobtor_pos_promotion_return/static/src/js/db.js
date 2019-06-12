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
    });

    return PosDB;
});