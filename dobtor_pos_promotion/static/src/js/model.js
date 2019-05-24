odoo.define('dobtor.pos.promotion.model', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var field_utils = require('web.field_utils');
    var round_pr = utils.round_precision;
    var _t = core._t;

    var exports = models

    models.load_models([{
        model: 'sale.promotion.rule.combo.sale',
        domain: function (self) {
            return [
                ['pricelist_id', 'in', _.pluck(self.pricelists, 'id')]
            ];
        },
        loaded: function (self, promotion_rules) {
            self.combo_promotion = promotion_rules;
        },
    }], {
        'after': 'product.product'
    });

    models.load_models([{
        model: 'sale.promotion.rule.range.based',
        domain: function (self) {
            return [
                ['pricelist_id', 'in', _.pluck(self.pricelists, 'id')]
            ];
        },
        loaded: function (self, promotion_rules) {
            self.range_promotion = promotion_rules;
        },
    }], {
        'after': 'product.product'
    });

    models.load_fields('product.product', ['attribute_value_ids']);

    var _super_product = exports.Product;
    exports.Product = exports.Product.extend({
        inner_join_variant: function (rule) {
            var self = this;
            var find_variant = false;
            if ((rule.variant_ids instanceof Array) && rule.variant_ids.length > 0) {
                $.each(self.attribute_value_ids, function (index, attr) {
                    if (rule.variant_ids.includes(attr)) {
                        find_variant = true;
                    }
                });
            }
            return find_variant;
        },
        inner_join_combo_product: function (rule, pos) {
            var combo_promotion = [];
            var get_combo_promotion;
            if (pos) {
                get_combo_promotion = _.filter(pos.combo_promotion, function (combo) {
                    if (combo.promotion_id[0] == rule.id) {
                        return true;
                    }
                    return false;
                });
                if (get_combo_promotion) {
                    combo_promotion = _.pluck(_.pluck(get_combo_promotion, 'product_id'), 0);
                }
            }
            return combo_promotion;
        },
        get_pricelist: function (pricelist, pos=undefined) {
            var self = this;
            var date = moment().startOf('day');
            var sortpicelist = pricelist.items;
            // var sortpicelist = _.sortBy(pricelist.items, 'sequence');
            var pricelist_items = _.filter(sortpicelist, function (item) {

                // handle variant.
                var find_variant = self.inner_join_variant(item);
                // handle combo promotion.
                var combo_promotion = self.inner_join_combo_product(item, pos);
                
                // Relationship items
                return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id) &&
                    (!item.product_id || item.product_id[0] === self.id) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
                    (!((item.variant_ids instanceof Array) && item.variant_ids.length) || find_variant) &&
                    (!combo_promotion.length || combo_promotion.includes(self.id));
            });
            return pricelist_items;
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
                } else if (rule.compute_price === 'formula') {
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
        get_price_byitem: function (rule) {
            // price : discount price  
            // bogo : buy something, get product pirce
            // range : range
            // combo : combo

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
                if (rule.base_on === 'range') {
                    return {
                        type: 'range',
                        price: price,
                        discount: 0,
                        quantity: quantity,
                    };
                } else if (rule.base_on === 'combo_sale') {
                    return {
                        type: 'combo',
                        price: price,
                        discount: 0,
                        quantity: quantity,
                        product: self.product
                    };
                }
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
                        discount: 100,
                        quantity: add_newproduct_qty,
                        gift: self.product,
                    };
                }
                if (rule.bogo_base === 'bxa_gyb_free') {
                    var can_productB_free_qty = parseInt(quant / rule.bxa_gyb_free_Aproduct_unit) * rule.bxa_gyb_free_Bproduct_unit;
                    var add_newproductB_qty = 0
                    var productB;
                    var result_quantity = 0;
                    $.each(order.orderlines.models, function (i, line) {
                        var product_id = line.product.id;
                        if (product_id == rule.bxa_gyb_free_products[0]) {
                            add_newproductB_qty = line.quantity;
                            productB = line.product;
                        }
                    });
                    if (productB && add_newproductB_qty) {
                        if (add_newproductB_qty >= can_productB_free_qty) {
                            result_quantity = can_productB_free_qty;
                        } else {
                            result_quantity = add_newproductB_qty;
                        }
                        return {
                            type: 'bogo',
                            price: productB.lst_price,
                            discount: 100,
                            quantity: result_quantity,
                            // product: self.product,
                            gift: self.pos.db.get_product_by_id(rule.bxa_gyb_free_products[0]),
                        };
                    }
                }
                if (rule.bogo_base === 'bxa_gyb_discount') {
                    var can_productC_free_qty = parseInt(quant / rule.bxa_gyb_discount_Aproduct_unit) * rule.bxa_gyb_discount_Bproduct_unit;
                    var add_newproductC_qty = 0
                    var productC;
                    var resultC_quantity = 0;
                    $.each(order.orderlines.models, function (i, line) {
                        var product_id = line.product.id;
                        if (product_id == rule.bxa_gyb_discount_product[0]) {
                            add_newproductC_qty = line.quantity;
                            productC = line.product;
                        }
                    });
                    if (productC && add_newproductC_qty) {
                        if (add_newproductC_qty >= can_productC_free_qty) {
                            resultC_quantity = can_productC_free_qty;
                        } else {
                            resultC_quantity = add_newproductC_qty;
                        }
                        var new_pirceC = productC.lst_price;
                        var discount = 0;
                        if (rule.bxa_gyb_discount_base_on === 'percentage') {
                            new_pirceC = new_pirceC - (new_pirceC * (rule.bxa_gyb_discount_percentage_price / 100));
                            discount = rule.bxa_gyb_discount_percentage_price;
                        } else if (rule.bxa_gyb_discount_base_on === 'fixed') {
                            new_pirceC = round_pr(rule.bxa_gyb_discount_fixed_price, 1);
                            discount = round_pr((((productC.lst_price - new_pirceC) / productC.lst_price) *100), 1);
                        }
                        return {
                            type: 'bogo',
                            price: new_pirceC,
                            discount: discount,
                            quantity: resultC_quantity,
                            gift: self.pos.db.get_product_by_id(rule.bxa_gyb_discount_product[0]),
                        };
                    }
                }
                return {
                    type: 'bogo',
                    price: 0,
                    discount: 0,
                    quantity: 0,
                };
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