odoo.define('dobtor_sfic_wallet.pos', function (require) {
    "use strict";
    
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var screen = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');

    var _t = core._t;

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            models.load_fields('res.partner', ['sfic_point', 'sfic_transaction']);
            models.load_fields('account.journal', ['is_points'])
            _super_posmodel.initialize.apply(this, arguments);
        },

        get_point_paid: function() {
            var order = this.get_order();
            var custom = this.get_client();
            var point_paid = 0;
            if (custom && order) {
                var amount_total = order.get_total_with_tax();
                var can_paid = parseInt(order.get_total_with_tax() * 2 / 100);
                var point_to_cash = parseInt(custom.sfic_point / 50);
                point_paid = Math.min(can_paid, point_to_cash);
                if (point_paid <= 0) {
                    return 0;
                }
                return point_paid - order.point_paid;
            }
            return 0;
        },

        get_point_paid_string: function() {
            return _t(' [Paid: ') + this.get_point_paid() + "]";
        }
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes,options){
            this.point_paid = 0;

            return _super_order.initialize.apply(this, arguments);
        },

        add_paymentline: function(cashregister) {
            if (cashregister.journal.is_points) {
                var newPaymentline = new models.Paymentline({},{order: this, cashregister:cashregister, pos: this.pos});
                newPaymentline.set_amount( this.pos.get_point_paid() );
                this.point_paid = this.pos.get_point_paid();
                this.paymentlines.add(newPaymentline);
                this.select_paymentline(newPaymentline);
            } else {
                return _super_order.add_paymentline.apply(this, arguments);
            }
        },
    });

});