odoo.define('dobtor_sfic_wallet.screens', function (require) {
"use strict";

var screen = require('point_of_sale.screens');
var core = require('web.core');
var gui = require('point_of_sale.gui');

var _t = core._t;

    screen.PaymentScreenWidget.include({
        validate_order: function(force_validation) {
            this._super(force_validation);
        },

        finalize_validation: function() {
            var self = this;
            var order = this.pos.get_order();

            this._super();
        },

        click_paymentmethods: function(id) {
            var cashregister = null;
            for (var i = 0; i < this.pos.cashregisters.length; i++) {
                if ( this.pos.cashregisters[i].journal_id[0] === id ){
                    cashregister = this.pos.cashregisters[i];
                    break;
                }
            }

            if (cashregister.journal.is_points) {
                if (this.pos.get_point_paid() > 0) {
                    this._super(id);
                    this.reset_paymentmethods();
                }
            } else {
                this._super(id);
            }
        },

        customer_changed: function() {
            var client = this.pos.get_client();
            this.$('.js_customer_name').text( client ? client.name + "[Points: " + client.sfic_point + "]" : _t('Customer') ); 

            this.reset_paymentmethods();
        },

        reset_paymentmethods: function() {
            this.$(".paymentmethod").off("click");
            this.$(".paymentmethods-container").find(".paymentmethod").remove();
            var methods = this.render_paymentmethods();
            methods.appendTo(this.$('.paymentmethods-container'));
        },

        show: function() {
            this._super();
            this.reset_paymentmethods();
        },
    })
});
