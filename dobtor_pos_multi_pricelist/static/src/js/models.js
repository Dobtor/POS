odoo.define('dobtor_pos_multi_pricelist.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var exports = models;

    exports.load_domain = function (model_name, domain) {
        var models = exports.PosModel.prototype.models;
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            if (model.model === model_name) {
                model.domain = domain;
            }
        }
    }

    exports.load_domain('product.pricelist', function (self) {
        return [
            ['id', 'in', self.config.multi_pricelist_ids]
        ];
    });

    // exports.load_models({
    //     model: 'product.pricelist',
    //     fields: ['name', 'display_name', 'discount_item', 'discount_product'],
    //     domain: function (self) {
    //         return [
    //             ['id', 'in', self.config.multi_pricelist_ids]
    //         ];
    //     },
    //     loaded: function (self, pricelists) {
    //         _.map(pricelists, function (pricelist) {
    //             pricelist.items = [];
    //         });
    //         self.default_pricelist = _.findWhere(pricelists, {
    //             id: self.config.pricelist_id[0]
    //         });
    //         self.pricelists = pricelists;
    //     },
    // }, {
    //     'after': 'product.pricelist'
    // })
    exports.load_fields('product.product', ['discount_type']);

    var _super_orderline = exports.Orderline;
    exports.Orderline = exports.Orderline.extend({
        can_be_merged_with: function (orderline) {
            var self = this;
            if (self.get_product().id == self.pos.db.get_discount_product().id) { //only orderline of the same product can be merged
                return false;
            }
            if (_super_orderline.prototype.can_be_merged_with.apply(this, arguments))
                return true;
        },
    });

    exports.Order = exports.Order.extend({
        remove_discount: function () {
            var self = this;
            var orderlines = self.orderlines;
            // find all discount product and remove all. 
            var discount_line = _.filter(orderlines.models, function (line) {
                var product = line.product;
                return product.discount_type;
            });
            if (discount_line) {
                $.each(discount_line, function (inedx, d_line) {
                    self.remove_orderline(d_line);
                });
            }
        },
        check_order_discount: function () {
            var self = this;
            var pricelists = self.pos.pricelists;
            var discount_product = self.pos.db.get_discount_product();
            self.remove_discount();
            $.each(self.orderlines.models, function (i, line) {
                var product = line.product;
                var items = [];
                $.each(pricelists, function (i, pl) {
                    var pricelist_items = product.get_pricelist(pl);
                    $.each(pricelist_items, function (i, item) {
                        items.push(item)
                    })
                });
                // check has pricelist item 
                if (items.length > 0) {
                    // if only one pricelist item
                    if (items.length == 1) {
                        console.log('only one')
                        var result = line.get_price_byitem(items[0]);
                        if (result.quantity > 0) {
                            if (result.type == 'bogo') {
                                self.add_product(discount_product, {
                                    'price': result.price,
                                    'quantity': result.quantity,
                                });
                            } else if (result.type == 'price' && round_pr((result.price - product.lst_price), 1)) {
                                self.add_product(discount_product, {
                                    'price': round_pr((result.price - product.lst_price), 1),
                                    'quantity': result.quantity,
                                });
                            }   
                        }
                    } else {
                        var pk = _.find(items, function (item) {
                            return item.is_primary_key;
                        });
                        if (pk) {
                            console.log('pk')
                            var result_pk = line.get_price_byitem(pk);
                            if (result_pk.quantity > 0) {
                                if (result_pk.type == 'bogo') {
                                    self.add_product(discount_product, {
                                        'price': result_pk.price,
                                        'quantity': result_pk.quantity,
                                    });
                                }
                                else if (result_pk.type == 'price' && round_pr((result.price - product.lst_price), 1)) {
                                    self.add_product(discount_product, {
                                        'price': round_pr((result_pk.price - product.lst_price), 1),
                                        'quantity': result_pk.quantity,
                                    });
                                }
                                
                            }
                        } else {
                            // multi 
                            console.log('multi')
                            var temp_price = line.price
                            $.each(items, function (i, item) {
                                var result_m = line.get_price_byitem(item)
                                var discount_rate = result_m.discount / 100
                                if (result_m.discount > 0) {
                                    var discount_price = -discount_rate * temp_price
                                    self.add_product(discount_product, {
                                        'price': round_pr(discount_price,1),
                                        'quantity': result_m.quantity
                                    })
                                    temp_price = temp_price + discount_price
                                }

                            });
                        }

                    }
                }
            })
        }
    });
})