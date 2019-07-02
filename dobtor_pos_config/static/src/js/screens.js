odoo.define('dobtor_pos_config.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var _t = core._t;

    screens.ProductListWidget.include({
        render_product: function (product) {

            if (product.barcode && product.added_barcode == undefined) {
                product.display_name = `[${product.barcode}]\n${product.display_name}`;
                product.added_barcode = true;
            }

            // if (product.default_code  && product.added_default_code==undefined){
            //     product.display_name = `[${product.default_code}]${product.display_name}`;
            //     product.added_default_code =true;
            // }
            var res = this._super(product);
            return res;
        },
    })
    screens.ProductCategoriesWidget.include({
        perform_search: function (category, query, buy_result) {
            var products;
            if (query) {
                products = this.pos.db.search_product_in_category(category.id, query);
                if (buy_result && products.length === 1) {
                    if (products[0].barcode && products[0].added_barcode == undefined) {
                        products[0].display_name = `[${products[0].barcode}]\n${products[0].display_name}`;
                        products[0].added_barcode = true;
                    }
                    this.pos.get_order().add_product(products[0]);
                    this.clear_search();
                } else {
                    this.product_list_widget.set_product_list(products);
                }
            } else {
                products = this.pos.db.get_product_by_category(this.category.id);
                this.product_list_widget.set_product_list(products);
            }
        }
    })
})