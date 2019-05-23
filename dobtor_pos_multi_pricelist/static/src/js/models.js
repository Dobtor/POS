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
        var multi_pricelist_ids = self.config.multi_pricelist_ids;
        if (!multi_pricelist_ids.includes(self.config.pricelist_id[0])) {
            multi_pricelist_ids.push(self.config.pricelist_id[0]);
        }
        return [
            ['id', 'in', multi_pricelist_ids]
        ];
    });

    var _super_orderline = exports.Orderline;
    exports.Orderline = exports.Orderline.extend({
        initialize: function (attr, options) {
            var self = this;
            _super_orderline.prototype.initialize.apply(self, arguments);
            self.compute_name = self.get_product().display_name;
        },
        // can_be_merged_with: function (orderline) {
        //     var self = this;
        //     if (self.get_product().id == self.pos.db.get_discount_product().id) { //only orderline of the same product can be merged
        //         return false;
        //     }
        //     if (_super_orderline.prototype.can_be_merged_with.apply(this, arguments))
        //         return true;
        // },
    });
    exports.load_fields('product.pricelist', ['discount_item', 'discount_product']);
    exports.load_fields('product.product', ['discount_type'])
    exports.load_fields('res.partner', ['birthday', 'member_id']);
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
        add_discount_product: function(self, line, rule) {
            var result = line.get_price_byitem(rule);
            var product = line.product;
            if (result.quantity > 0) {
                if (result.type == 'bogo') {
                    self.add_product(self.pos.db.get_product_by_id(rule.related_product[0]), {
                        'price': -result.price,
                        'quantity': result.quantity,
                        // 'discription': 'somgthing'
                    });
                } else if (result.type == 'price') {
                    if (round_pr((result.price - product.lst_price), 1)) {
                        self.add_product(self.pos.db.get_product_by_id(rule.related_product[0]), {
                            'price': round_pr((result.price - product.lst_price), 1),
                            'quantity': result.quantity,
                        });
                    }
                }
                // if (result.type == '')
            }
        },
        check_order_discount: function () {
            var self = this;
            var pricelists = self.pos.pricelists;
            var customer = this.get_client();
            self.remove_discount();
            var sum = 0;
            // Per Line
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
                        self.add_discount_product(self, line, items[0])
                    } else {
                        var pk = _.find(items, function (item) {
                            return item.is_primary_key;
                        });
                        if (pk) {
                            console.log('pk')
                            self.add_discount_product(self, line, pk)
                        } else {
                            // multi 
                            console.log('multi')
                            var temp_price = line.price
                            $.each(items, function (i, item) {
                                if (line.quantity > 0) {
                                    var result_m = line.get_price_byitem(item)
                                    var discount_rate = result_m.discount / 100
                                    if (result_m.discount > 0 && item.related_product) {
                                        var discount_price = round_pr(-discount_rate * temp_price,1)
                                        self.add_product(self.pos.db.get_product_by_id(item.related_product[0]), {
                                            'price': discount_price,
                                            'quantity': result_m.quantity
                                        })
                                        temp_price = temp_price + discount_price
                                    }
                                }
                            });
                        }
                    }
                }
            });
            // Per Order
        }
    });
})