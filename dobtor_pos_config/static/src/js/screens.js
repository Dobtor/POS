odoo.define('dobtor_pos_config.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var _t = core._t;

    screens.ProductListWidget.include({
        render_product: function (product) {

            if(product.barcode && product.added_barcode==undefined){
                product.display_name = `[${product.barcode}]\n${product.display_name}`;
                product.added_barcode =true;
            }
            
            // if (product.default_code  && product.added_default_code==undefined){
            //     product.display_name = `[${product.default_code}]${product.display_name}`;
            //     product.added_default_code =true;
            // }
            var res = this._super(product);
            return res;
        },
    })
})