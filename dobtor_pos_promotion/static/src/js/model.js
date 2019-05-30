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
            // get A ∩ B 
            var self = this;
            if ((rule.variant_ids instanceof Array) && rule.variant_ids.length > 0) {
                return _.size(_.intersection(self.attribute_value_ids, rule.variant_ids, rule.variant_ids)) == _.size(rule.variant_ids);
            }
            return false;
        },
        inner_join_gift_variant: function (rule) {
            // get A ∩ B 
            var self = this;
            if ((rule.bxa_gyb_free_variant_ids instanceof Array) && rule.bxa_gyb_free_variant_ids.length > 0) {
                return _.size(_.intersection(self.attribute_value_ids, rule.bxa_gyb_free_variant_ids, rule.bxa_gyb_free_variant_ids)) == _.size(rule.bxa_gyb_free_variant_ids);
            } else if ((rule.bxa_gyb_discount_variant_ids instanceof Array) && rule.bxa_gyb_discount_variant_ids.length > 0) {
                return _.size(_.intersection(self.attribute_value_ids, rule.bxa_gyb_discount_variant_ids, rule.bxa_gyb_discount_variant_ids)) == _.size(rule.bxa_gyb_discount_variant_ids);
            }
            return false;
        },
        inner_join_gift_product: function (rule) {
            // get A ∩ B 
            var self = this;
            if (rule.bxa_gyb_free_variant_ids && rule.bxa_gyb_free_products[0] === self.id) {
                return true;
            } else if (rule.bxa_gyb_free_variant_ids && rule.bxa_gyb_discount_product[0] === self.id) {
                return true;
            }
            return false;
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
        get_pricelist: function (pricelist, pos = undefined) {
            var self = this;
            var date = moment().startOf('day');
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

            var sortpicelist = pricelist.items;
            // var sortpicelist = _.sortBy(pricelist.items, 'sequence');
            var pricelist_items = _.filter(sortpicelist, function (item) {

                // handle variant or product.
                var find_variant = self.inner_join_variant(item);
                var find_gift_variant = self.inner_join_gift_variant(item);
                var find_gift_product = self.inner_join_gift_product(item);
                // console.log('name :', item.related_discount_name);
                // console.log('c0 : ', (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id));
                // console.log('c1 : ', (!item.product_id || item.product_id[0] === self.id || find_gift_product));
                // console.log('c2 : ', ((!item.bxa_gyb_free_products || find_gift_product) ||
                //     (!item.bxa_gyb_discount_product || find_gift_product)));
                // console.log('c3 : ', (!item.variant_ids.length || find_variant || find_gift_variant));
                // console.log('c4 : ', ((!item.bxa_gyb_free_variant_ids.length || find_gift_variant) ||
                //     (!item.bxa_gyb_discount_variant_ids.length || find_gift_variant)));
                // handle combo promotion.
                var combo_promotion = self.inner_join_combo_product(item, pos);
                // console.log('total : ', (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id || find_gift_product) &&
                //     (!item.product_id || item.product_id[0] === self.id || find_gift_product) &&
                //     ((!item.bxa_gyb_free_products || find_gift_product) ||
                //         (!item.bxa_gyb_discount_product || find_gift_product)) &&
                //     (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                //     (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                //     (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
                //     // variant_ids & bxa_gyb_free_variant_ids & bxa_gyb_discount_variant_ids just can one
                //     (!item.variant_ids.length || find_variant || find_gift_variant) &&
                //     ((!item.bxa_gyb_free_variant_ids.length || find_gift_variant) ||
                //         (!item.bxa_gyb_discount_variant_ids.length || find_gift_variant)) &&
                //     (!combo_promotion.length || combo_promotion.includes(self.id)));
                // console.log('c5 : ', (!combo_promotion.length || combo_promotion.includes(self.id)));
                // Relationship items
                return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id || find_gift_product || find_gift_variant) &&
                    (!item.product_id || item.product_id[0] === self.id || find_gift_product || find_gift_variant) &&
                    ((!item.bxa_gyb_free_products || find_gift_product || find_gift_variant) ||
                        (!item.bxa_gyb_discount_product || find_gift_product || find_gift_variant)) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0]) || find_gift_product || find_gift_variant) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
                    // variant_ids & bxa_gyb_free_variant_ids & bxa_gyb_discount_variant_ids just can one
                    (!item.variant_ids.length || find_variant || find_gift_variant || find_gift_product) &&
                    ((!item.bxa_gyb_free_variant_ids.length || find_gift_variant || find_gift_product) ||
                        (!item.bxa_gyb_discount_variant_ids.length || find_gift_variant || find_gift_product)) &&
                    (!combo_promotion.length || combo_promotion.includes(self.id));
            });
            return pricelist_items;
        },
        // get_rule_price: function (pricelist_items, quantity, price) {
        //     _.find(pricelist_items, function (rule) {
        //         if (rule.min_quantity && quantity < rule.min_quantity) {
        //             return false;
        //         }

        //         if (rule.level_on === 'order') {
        //             return false;
        //         }

        //         if (rule.base === 'pricelist') {
        //             price = self.get_price(rule.base_pricelist, quantity);
        //         } else if (rule.base === 'standard_price') {
        //             price = self.standard_price;
        //         }

        //         if (rule.compute_price === 'fixed') {
        //             price = rule.fixed_price;
        //             return true;
        //         } else if (rule.compute_price === 'percentage') {
        //             price = price - (price * (rule.percent_price / 100));
        //             price = round_pr(price, 1);
        //             return true;
        //         } else if (rule.compute_price === 'formula') {
        //             var price_limit = price;
        //             price = price - (price * (rule.price_discount / 100));
        //             if (rule.price_round) {
        //                 price = round_pr(price, rule.price_round);
        //             }
        //             if (rule.price_surcharge) {
        //                 price += rule.price_surcharge;
        //             }
        //             if (rule.price_min_margin) {
        //                 price = Math.max(price, price_limit + rule.price_min_margin);
        //             }
        //             if (rule.price_max_margin) {
        //                 price = Math.min(price, price_limit + rule.price_max_margin);
        //             }
        //             return true;
        //         }
        //         return false;
        //     });
        //     return price;
        // },
        // get_price: function (pricelist, quantity) {
        //     var self = this;
        //     if (pricelist === undefined) {
        //         alert(_t(
        //             'An error occurred when loading product prices. ' +
        //             'Make sure all pricelists are available in the POS.'
        //         ));
        //     }

        //     var category_ids = [];
        //     var category = this.categ;
        //     while (category) {
        //         category_ids.push(category.id);
        //         category = category.parent;
        //     }
        //     var pricelist_items = this.get_pricelist(pricelist);

        //     var price = self.lst_price;
        //     price = this.get_rule_price(pricelist_items, quantity, price);
        //     return price;
        // },
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
        set_discount_price: function (discount_price) {
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
                return {
                    rule_id: rule.id,
                    rule: rule,
                    type: 'bogo',
                    price: price,
                    discount: 0,
                    quantity: quantity,
                    product_type: self.product.inner_join_gift_variant(rule) || self.product.inner_join_gift_product(rule) ? 'gift' : 'product',
                    product: self.product
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