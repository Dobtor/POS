odoo.define('dobtor_pos_multi_pricelist.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var _super_posmodel = models.PosModel.prototype;
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var exports = models
    var _super_posmodel = exports.PosModel;
    var field_utils = require('web.field_utils');
    var round_di = utils.round_decimals;
    var utils = require('web.utils');

    exports.PosModel = exports.PosModel.extend({
        initialize: function (session, attributes) {
            exports.load_fields('product.pricelist', ['discount_item', 'discount_product', ])
            exports.load_fields('product.product', ['discount_type'])
            _super_posmodel.prototype.initialize.apply(this, arguments);
        },
    })
    exports.Product = exports.Product.extend({
        get_discount_rate: function (item, quantity) {
            var rate = 1
            var origin_price = this.lst_price * quantity
            var discount = this.get_price_byitem(item, quantity)
            rate = discount / origin_price
            return rate
        }
    })


    exports.Order = exports.Order.extend({

        remove_discount: function () {
            var orderlines = this.orderlines;
            // find all discount product and remove all. 
            var discount_line = _.filter(orderlines, function (line) {
                var product = line.product;
                return product.discount_type;
            });
            if (discount_line) {
                $.each(discount_line, function (inedx, d_line) {
                    this.remove_orderline(d_line);
                });
            }
        },
        check_order_discount: function () {
            var self = this;
            var pricelists = this.pos.pricelists
            self.remove_discount();
            $.each(this.orderlines.models, function (i, line) {
                var product = line.product;
                var items = [];
                $.each(pricelists, function (i, pl) {
                    var pricelist_items = product.get_pricelist(pl);
                    $.each(pricelist_items, function (i, item) {
                        items.push(item)
                    })
                })
                if (items.length > 0) {
                    if (items.length == 1) {
                        var result = line.get_price_byitem(items[0])
                        if (result.quantity > 0) {
                            if (result.type == 'discount') {
                                self.add_product(items[0].related_product, {
                                    'price': round_pr((result.price - product.lst_price), 1),
                                    'quantity': result.quantity,
                                })
                            }
                            if (result.type == 'bogo') {
                                self.add_product(items[0].related_product, {
                                    'price': result.price,
                                    'quantity': result.quantity,
                                })
                            }
                        }
                    } else {
                        var pk = _.find(items, function (item) {
                            return item.is_primary_key;
                        });
                        if (pk) {
                            self.add_product(pk.related_product, {
                                'price': round_pr((line.get_price_byitem(pk).price - line.price), 1),
                                'quantity': line.get_price_byitem(pk).quantity,
                            })
                        } else {
                            var temp_price = line.price
                            $.each(items, function (i, item) {
                                var result = line.get_price_byitem(item)
                                var discount_rate = result.discount
                                if (discount_rate > 0) {
                                    var discount_price = -discount_rate * temp_price
                                    self.add_product(item.related_product, {
                                        'price': discount_price,
                                        'quantity': result.quantity
                                    })
                                    temp_price = temp_price + discount_price
                                }

                            })
                        }

                    }
                }
            })
        }
    })

    return exports;
})
