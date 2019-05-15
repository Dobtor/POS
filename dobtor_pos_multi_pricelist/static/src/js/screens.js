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
        order_product: function () {
            var res = this._super();

            return res
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
})