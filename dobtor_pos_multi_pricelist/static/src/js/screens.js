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


})