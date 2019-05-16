odoo.define('dobtor_pos_multi_pricelist.models', function (require) {
    "use strict";
    var rpc = require('web.rpc');
    var models = require('point_of_sale.models');
    var _super_order = models.Order.prototype;
    var _super_posmodel = models.PosModel.prototype;
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var exports = models
    var _super_posmodel = exports.PosModel;

    exports.PosModel = exports.PosModel.extend({
        initialize: function (session, attributes) {
            _super_posmodel.prototype.initialize.apply(this, arguments);
            // exports.load_models('product.product.discount', ['before'])
            exports.load_fields('pos.order.line', ['line_name'])
            exports.load_fields('product.pricelist', ['discount_item', 'discount_product'])
        },
    })
    var _super_orderline = exports.Orderline;
    exports.Orderline = exports.Orderline.extend({
        get_pricelist_discount_product: function (pricelist) {
            if (pricelist) {
                return this.pos.db.get_product_by_id(pricelist.discount_product[0])
            }
        },
        get_discount_product_price: function (product, pricelist, quantity) {
            var new_price = product.get_price(pricelist, quantity)
            var origin_price = product.lst_price
            var rate = round_pr(((origin_price-new_price)/origin_price), self.pos.currency.rounding)
            return new_price - origin_price
        },
        add_discount_product: function (quantity, pricelist) {
            var self = this;
            var price = round_pr(self.get_discount_product_price(self.product, pricelist, quantity), self.pos.currency.rounding)
            var product = self.get_pricelist_discount_product(pricelist)
            if ((product) && (price != 0)) {
                // self.order.add_product(product, {
                //     'price': price,
                //     'quantity': {
                //         'quantity': quantity,
                //         'is_discount': true
                //     },
                // })
            }
            this.order.select_orderline(self);

        },
        set_quantity: function (quantity) {
            var objectConstructor = {}.constructor;
            var is_discount = null;
            if (quantity.constructor === objectConstructor) {
                is_discount = quantity.is_discount;
                quantity = quantity.quantity;
            }
            if (is_discount != true) {
                _super_orderline.prototype.set_quantity.apply(this, [quantity])
                var self = this
                var product = this.product
                var pricelists = this.pos.pricelists;
                $.each(pricelists, function (index, pricelist) {
                    self.add_discount_product(quantity, pricelist)

                })
            }
        },
    })

    return exports;
})