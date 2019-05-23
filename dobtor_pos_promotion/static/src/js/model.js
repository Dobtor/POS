odoo.define('dobtor.pos.promotion.model', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var field_utils = require('web.field_utils');
    var round_pr = utils.round_precision;
    var _t = core._t;

    var exports = models

    models.load_fields('product.product', ['attribute_value_ids']);

    var _super_product = exports.Product;
    exports.Product = exports.Product.extend({
        get_pricelist: function (pricelist) {
            // console.log(this.pos.currency.rounding);
            var self = this;
            var date = moment().startOf('day');
            var sortpicelist = pricelist.items;
            // var sortpicelist = _.sortBy(pricelist.items, 'sequence');
            var pricelist_items = _.filter(sortpicelist, function (item) {
                var merge_variant = false;
                if ((item.variant_ids instanceof Array) && item.variant_ids.length > 0) {
                    $.each(self.attribute_value_ids, function (index, attr) {
                        if (item.variant_ids.includes(attr)) {
                            merge_variant = true;
                        }
                    });
                }

                return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id) &&
                    (!item.product_id || item.product_id[0] === self.id) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
                    (!((item.variant_ids instanceof Array) && item.variant_ids.length) || merge_variant);
            });
            return pricelist_items
        },
        get_rule_price: function (pricelist_items, quantity, price) {
            _.find(pricelist_items, function (rule) {
                if (rule.min_quantity && quantity < rule.min_quantity) {
                    return false;
                }

                if (rule.level_on === 'order') {
                    return false;
                }

                if (rule.base === 'pricelist') {
                    price = self.get_price(rule.base_pricelist, quantity);
                } else if (rule.base === 'standard_price') {
                    price = self.standard_price;
                }

                if (rule.compute_price === 'fixed') {
                    price = rule.fixed_price;
                    return true;
                } else if (rule.compute_price === 'percentage') {
                    price = price - (price * (rule.percent_price / 100));
                    price = round_pr(price, 1);
                    return true;
                } else {
                    var price_limit = price;
                    price = price - (price * (rule.price_discount / 100));
                    if (rule.price_round) {
                        price = round_pr(price, rule.price_round);
                    }
                    if (rule.price_surcharge) {
                        price += rule.price_surcharge;
                    }
                    if (rule.price_min_margin) {
                        price = Math.max(price, price_limit + rule.price_min_margin);
                    }
                    if (rule.price_max_margin) {
                        price = Math.min(price, price_limit + rule.price_max_margin);
                    }
                    return true;
                }
                return false;
            });
            return price;
        },
        get_price: function (pricelist, quantity) {
            var self = this;
            if (pricelist === undefined) {
                alert(_t(
                    'An error occurred when loading product prices. ' +
                    'Make sure all pricelists are available in the POS.'
                ));
            }

            var category_ids = [];
            var category = this.categ;
            while (category) {
                category_ids.push(category.id);
                category = category.parent;
            }
            var pricelist_items = this.get_pricelist(pricelist);

            var price = self.lst_price;
            price = this.get_rule_price(pricelist_items, quantity, price);
            return price;
        },
    });

    var OrderlineCollection = Backbone.Collection.extend({
        model: exports.Orderline,
    });

    var _super_orderline = exports.Orderline;
    exports.Orderline = exports.Orderline.extend({
        initialize: function (attr, options) {
            var self = this;
            _super_orderline.prototype.initialize.apply(self, arguments);
            self.discount_price = 0;
            self.lock = false;
            self.referce_ids = new OrderlineCollection();
            self.res_id = undefined;
        },
        set_res_id: function (line) {
            this.res_id = line;
        },
        get_res_id: function () {
            return this.res_id;
        },
        set_discount: function (discount_price) {
            var disc = Math.max(parseFloat(discount_price) || 0, 0);
            this.discount_price = disc;
        },
        get_discount_price: function () {
            return this.discount_price;
        },
        export_as_JSON: function () {
            var res = _super_orderline.prototype.export_as_JSON.apply(this, arguments);
            return res
        },
        get_price_byitem: function (rule) {
            var self = this;
            var price = self.product.lst_price;
            var order = self.order;
            var quantity = self.quantity;
            var new_price = 0;

            
            if (rule.min_quantity && quantity < rule.min_quantity) {
                return {
                    type: 'price',
                    price: price,
                    discount: 0,
                    quantity: 0,
                };
            }

            if (rule.level_on === 'order') {
                return {
                    type: 'price',
                    price: price,
                    discount: 0,
                    quantity: 0,
                };
            }
            var quant = parseFloat(quantity) || 0;
            if (rule.compute_price === 'bogo_sale') {
                if (rule.bogo_base === 'bxa_gya_free') {
                    var add_newproduct_qty = parseInt(quant / (rule.bxa_gya_free_Aproduct_unit + rule.bxa_gya_free_Bproduct_unit));
                    return {
                        type: 'bogo',
                        price: price,
                        discount: 0,
                        quantity: add_newproduct_qty,
                    };
                }
                if (rule.bogo_base === 'bxa_gyx_free') {
                    var can_productB_free_qty = parseInt(quant / rule.bxa_gyb_free_Aproduct_unit) * rule.bxa_gyb_free_Bproduct_unit;
                    var add_newproductB_qty = 0
                    var productB;
                    var result_quantity = 0;
                    $.each(order.orderlines.models, function(i, line) {
                        var product_id = line.product.id;
                        if (product_id == rule.bxa_gyb_free_products) {
                            add_newproductB_qty = line.quantity;
                            productB = line.product;
                        }
                    });
                    if (add_newproductB_qty >= can_productB_free_qty) {
                        result_quantity = can_productB_free_qty;
                    } else {
                        result_quantity = add_newproductB_qty;
                    }
                    return {
                        type: 'bogo',
                        price: productB.lst_price,
                        discount: 0,
                        quantity: result_quantity,
                    };
                }
                if (rule.bogo_base === 'bxa_gyb_discount') {
                    var can_productC_free_qty = parseInt(quant / rule.bxa_gyb_discount_Aproduct_unit) * rule.bxa_gyb_discount_Bproduct_unit;
                    var add_newproductC_qty = 0
                    var productC;
                    var resultC_quantity = 0;
                    $.each(order.orderlines.models, function (i, line) {
                        var product_id = line.product.id;
                        if (product_id == rule.bxa_gyb_discount_product) {
                            add_newproductC_qty = line.quantity;
                            productC = line.product;
                        }
                    });
                    if (add_newproductC_qty >= can_productC_free_qty) {
                        resultC_quantity = can_productC_free_qty;
                    } else {
                        resultC_quantity = add_newproductC_qty;
                    }
                    var new_pirceC = productC.lst_price;
                    if (rule.bxa_gyb_discount_percentage_price === 'percentage') {
                        new_pirceC = new_pirceC - (new_pirceC * (rule.bxa_gyb_discount_percentage_price / 100));
                    } else if (rule.bxa_gyb_discount_fixed_price === 'fixed') {
                        new_pirceC = round_pr(rule.bxa_gyb_discount_fixed_price, 1);
                    }
                    return {
                        type: 'bogo',
                        price: new_pirceC,
                        discount: 0,
                        quantity: resultC_quantity,
                    };
                }
            }
            if (rule.base === 'pricelist') {
                new_price = self.get_price(rule.base_pricelist, quantity);
                return {
                    type: 'price',
                    price: new_price,
                    discount: (price - new_price) / price,
                    quantity: quantity,
                };
            } else if (rule.base === 'standard_price') {
                new_price = self.standard_price;
                return {
                    type: 'price',
                    price: new_price,
                    discount: (price - new_price) / price,
                    quantity: quantity,
                };
            }

            if (rule.compute_price === 'fixed') {
                new_price = round_pr(rule.fixed_price, 1);
                return {
                    type: 'price',
                    price: new_price,
                    discount: (price - new_price) / price,
                    quantity: quantity,
                };
            } else if (rule.compute_price === 'percentage') {
                new_price = price - (price * (rule.percent_price / 100));
                return {
                    type: 'price',
                    price: new_price,
                    discount: rule.percent_price,
                    quantity: quantity,
                };
            } else {
                var price_limit = price;
                price = price - (price * (rule.price_discount / 100));
                if (rule.price_round) {
                    price = round_pr(price, rule.price_round);
                }
                if (rule.price_surcharge) {
                    price += rule.price_surcharge;
                }
                if (rule.price_min_margin) {
                    price = Math.max(price, price_limit + rule.price_min_margin);
                }
                if (rule.price_max_margin) {
                    price = Math.min(price, price_limit + rule.price_max_margin);
                }
                return {
                    type: 'price',
                    price: price,
                    discount: 0,
                    quantity: quantity,
                };

            }
            // TODO : 
            return {
                type: 'price',
                price: price,
                discount: 0,
                product_id: this.id
            };
        },
    });

})