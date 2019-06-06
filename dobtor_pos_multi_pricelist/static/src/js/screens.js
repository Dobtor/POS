odoo.define('dobtor_pos_multi_pricelist.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var _t = core._t;

    screens.ProductListWidget.include({
        render_product: function (product) {
            var res = this._super(product);
            res = this.render_product_template(res, product)
            return res;
        },
        render_product_template: function (res, product) {
            var $resobj = null;
            if (this.get_product(product)) {
                $resobj = $(res).css({
                    'display': 'none'
                })
            }
            return $resobj ? $resobj[0] : res;
        },
        get_product: function (product) {
            return product.discount_type
        }
    })

    screens.ActionpadWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.pay').off('click');
            this.$('.pay').on('click', function () {
                self.click_payment_btn(self);
            });
            this.click_customer_btn(self);
        },
        click_customer_btn: function (self) {
            this.$('.set-customer').click(function () {
                self.gui.show_screen('clientlist');
            });
        },
        click_payment_btn: function (self) {
            var order = self.pos.get_order();
            order.check_order_discount();
            var has_valid_product_lot = _.every(order.orderlines.models, function (line) {
                return line.has_valid_product_lot();
            });
            self.gui.show_popup('confirm', {
                'title': _t('Go To Payment'),
                'body': _t('Confirm to go to the payment page?'),
                confirm: function () {
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
                },
            });
        }
    })

    screens.ClientListScreenWidget.include({
        save_client_details: function(partner){
        var res = this._super(partner)
        this.$('.client-list').css('display','none');
        return res 
    },
 })
})