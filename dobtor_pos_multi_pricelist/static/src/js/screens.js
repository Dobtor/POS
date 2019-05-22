odoo.define('dobtor_pos_multi_pricelist.screens', function (require) {
    "use strict";

    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var rpc = require('web.rpc');
    var utils = require('web.utils');
    var field_utils = require('web.field_utils');
    var BarcodeEvents = require('barcodes.BarcodeEvents').BarcodeEvents;
    var screens = require('point_of_sale.screens');
    var QWeb = core.qweb;
    var _t = core._t;
    var ajax = require('web.ajax');

    var round_pr = utils.round_precision;
    screens.ProductListWidget.include({

        render_product: function (product) {
            var res = this._super(product);
            res = this.render_product_template(res, product)
            return res;
        },
        render_product_template: function (res, product) {
            var $resobj = null;
            var product = this.get_product(product).then(function (response) {
                if (response) {
                    $resobj = $(res)
                    $resobj.css({
                        'display': 'none'
                    })
                }
            });
            return $resobj ? $resobj[0] : res;
        },
        get_product: function (product) {
            return rpc.query({
                model: 'product.product',
                method: 'get_discount_type',
                args: [
                    [product.id]
                ],
            }, {
                async: false,
            })
        },
    })
    screens.ProductScreenWidget.include({
        click_product: function (product) {
            var res = this._super(product);
            return res
        },
    })
    screens.ActionpadWidget.include({
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.pay').click(function(){
                var order = self.pos.get_order();
                // order.check_order_discount();
                // console.log('in here')
                // self.gui.show_popup('confirm',{
                //     'title': _t('Confirm'),
                //     'body':  _t('Confirm to go to the payment page?.'),
                //     confirm: function(){
                //         self.gui.show_screen('payment');
                //     },
                // });
                // alert('done confirm');
                var has_valid_product_lot = _.every(order.orderlines.models, function(line){
                    return line.has_valid_product_lot();
                });
                if(!has_valid_product_lot){
                    self.gui.show_popup('confirm',{
                        'title': _t('Empty Serial/Lot Number'),
                        'body':  _t('One or more product(s) required serial/lot number.'),
                        confirm: function(){
                            self.gui.show_screen('payment');
                        },
                    });
                }else{
                    self.gui.show_screen('payment');
                }
            });
            this.$('.set-customer').click(function(){
                self.gui.show_screen('clientlist');
            });
        }
    })
})