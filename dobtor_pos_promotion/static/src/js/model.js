odoo.define('dobtor.pos.promotion.model', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var field_utils = require('web.field_utils');
    var round_pr = utils.round_precision;
    var _t = core._t;
    var is_debug = true;
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

    models.load_models([{
        model: 'sale.promotion.bogo_offer.item',
        domain: function (self) {
            return [
                ['pricelist_id', 'in', _.pluck(self.pricelists, 'id')]
            ];
        },
        loaded: function (self, promotion_rules) {
            self.bogo_offer_items = promotion_rules;
        },
    }], {
        'after': 'product.product'
    });

    models.load_fields('product.product', ['attribute_value_ids', 'extra_attribute_value_ids']);

    var _super_product = exports.Product;
    exports.Product = exports.Product.extend({
        inner_join_variant: function (rule) {
            // get A ∩ B 
            var self = this;
            if ((rule.variant_ids instanceof Array) && rule.variant_ids.length > 0) {
                return _.size(_.intersection(self.extra_attribute_value_ids, rule.variant_ids, rule.variant_ids)) == _.size(rule.variant_ids);
            }
            return false;
        },
        inner_join_gift_variant: function (rule) {
            // get A ∩ B 
            var self = this;
            if ((rule.bxa_gyb_free_variant_ids instanceof Array) && rule.bxa_gyb_free_variant_ids.length > 0) {
                return _.size(_.intersection(self.extra_attribute_value_ids, rule.bxa_gyb_free_variant_ids, rule.bxa_gyb_free_variant_ids)) == _.size(rule.bxa_gyb_free_variant_ids);
            } else if ((rule.bxa_gyb_discount_variant_ids instanceof Array) && rule.bxa_gyb_discount_variant_ids.length > 0) {
                return _.size(_.intersection(self.extra_attribute_value_ids, rule.bxa_gyb_discount_variant_ids, rule.bxa_gyb_discount_variant_ids)) == _.size(rule.bxa_gyb_discount_variant_ids);
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
        inner_join_combo_variant: function (rule, pos) {
            var combo_promotion = [];
            var get_combo_promotion_variant;
            if (pos) {
                get_combo_promotion_variant = _.filter(pos.combo_promotion, function (combo) {
                    if (combo.promotion_id[0] == rule.id) {
                        return combo.applied_on === 'variant';
                    }
                    return false;
                });
                if (get_combo_promotion_variant.length) {
                    combo_promotion = _.pluck(get_combo_promotion_variant, 'variant_ids');
                }
            }
            return combo_promotion;
        },
        inner_join_combo_product: function (rule, pos) {
            var combo_promotion = [];
            var get_combo_promotion_product;
            if (pos) {
                get_combo_promotion_product = _.filter(pos.combo_promotion, function (combo) {
                    if (combo.promotion_id[0] == rule.id) {
                        return combo.applied_on === 'product';
                    }
                    return false;
                });
                if (get_combo_promotion_product.length) {
                    combo_promotion = _.pluck(_.pluck(get_combo_promotion_product, 'product_id'), 0);
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
                if (is_debug) {
                    console.log('name :', item.related_discount_name);
                    // console.log('product template : ', (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id || find_gift_product || find_gift_variant));
                    // console.log('product product : ', (!item.product_id || item.product_id[0] === self.id || find_gift_product || find_gift_variant));
                    // console.log('bogo offer product: ', ((!item.bxa_gyb_free_products || find_gift_product || find_gift_variant) ||
                    //     (!item.bxa_gyb_discount_product || find_gift_product || find_gift_variant)));
                    // console.log('product vaniant : ', (!item.variant_ids.length || find_variant || find_gift_variant));
                    // console.log('bogo offer vaniant : ', ((!item.bxa_gyb_free_variant_ids.length || find_gift_product || find_gift_variant) ||
                    //     (!item.bxa_gyb_discount_variant_ids.length || find_gift_product || find_gift_variant)));
                    // console.log('category : ', (!item.categ_id || _.contains(category_ids, item.categ_id[0]) || find_gift_product || find_gift_variant));
                    // console.log('date_start :', (!item.date_start || moment(item.date_start).isSameOrBefore(date)));
                    // console.log('date_end :', (!item.date_end || moment(item.date_end).isSameOrAfter(date)));
                }

                // handle combo promotion.
                var combo_promotion = self.inner_join_combo_product(item, pos);
                var combo_variant_promotion = self.inner_join_combo_variant(item, pos);
                var find_combo_variant = false;
                if (combo_variant_promotion.length) {
                    _.find(combo_variant_promotion, function (cvp) {
                        // console.log('cvp :', cvp);
                        // console.log('self.extra_attribute_value_ids : ', self.extra_attribute_value_ids);
                        // console.log('merge : ', _.size(_.intersection(self.extra_attribute_value_ids, cvp, cvp)) == _.size(cvp));
                        if (_.size(_.intersection(self.extra_attribute_value_ids, cvp, cvp)) == _.size(cvp)) {
                            find_combo_variant = true;
                            return true;
                        }
                    });
                }
                if (is_debug) {
                    console.log('variant gift : ', (!item.variant_ids.length || find_variant || find_gift_variant || find_gift_product) &&
                        ((!item.bxa_gyb_free_variant_ids.length || find_gift_variant || find_gift_product) ||
                            (!item.bxa_gyb_discount_variant_ids.length || find_gift_variant || find_gift_product)));
                    console.log('combo_promotion #1: ', combo_promotion);
                    console.log('combo_variant_promotion #1: ', combo_variant_promotion);
                    console.log('combo promotion #3: ', combo_promotion.includes(self.id));
                    console.log('combo promotion #2: ', find_combo_variant);
                    console.log('combo promotion product : ', (!combo_promotion.length || combo_promotion.includes(self.id) || find_combo_variant));
                    console.log('combo promotion varinat : ', (!combo_variant_promotion.length || combo_promotion.includes(self.id) || find_combo_variant));
                    if (item.compute_price === 'bogo_sale') {
                        console.log('total : ', (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id || find_gift_product || find_gift_variant) &&
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
                            (!combo_promotion.length || combo_promotion.includes(self.id) || find_combo_variant) &&
                            (!combo_variant_promotion.length || combo_promotion.includes(self.id) || find_combo_variant));
                    }
                    if (item.compute_price === 'combo_sale') {
                        console.log('name :', item.related_discount_name);
                        console.log('combo_promotion :', combo_promotion);
                        console.log('combo_variant_promotion :', combo_variant_promotion);
                        console.log('c5 : ', (!combo_promotion.length || combo_promotion.includes(self.id)) &&
                            (!combo_variant_promotion.length || find_combo_variant));
                    }
                }

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
                    (!combo_promotion.length || combo_promotion.includes(self.id) || find_combo_variant) &&
                    (!combo_variant_promotion.length || combo_promotion.includes(self.id) || find_combo_variant);
            });
            return pricelist_items;
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
        },
        get_price_byitem: function (rule) {
            // price : discount price  
            // bogo : buy something, get product pirce
            // range : range
            // combo : combo

            var self = this;
            // var price = self.product.lst_price;
            var price = self.price;
            var order = self.order;
            var quantity = self.quantity;
            var new_price = 0;

            if (rule.level_on === 'order') {
                if (rule.base_on === 'range') {
                    return {
                        rule_id: rule.id,
                        rule: rule,
                        sequence: rule.sequence,
                        pricelist_sequence: rule.pricelist_sequence,
                        type: 'range',
                        price: price,
                        discount: 0,
                        quantity: quantity,
                        product_id: self.product.id,
                        product: $.extend(self.product, {
                            line_price: price
                        }),
                        round_value: round_pr(price * quantity, 1)
                    };
                } else if (rule.base_on === 'combo_sale') {
                    console.log('moving to level on is line and compute_price is combo_sale');
                }
                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'price',
                    price: price,
                    discount: 0,
                    quantity: 0,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
                };
            }
            var quant = parseFloat(quantity) || 0;
            if (rule.compute_price === 'bogo_sale') {

                var is_proudct = (!rule.product_tmpl_id || rule.product_tmpl_id[0] === self.product.product_tmpl_id) &&
                    (!rule.product_id || rule.product_id[0] === self.product.id) &&
                    (!rule.variant_ids.length || self.product.inner_join_variant(rule));
                var is_gift = self.product.inner_join_gift_variant(rule) || self.product.inner_join_gift_product(rule);
                var marge_variant_ids = [];
                if (is_gift) {

                    if (rule.bxa_gyb_discount_variant_ids.length > 0) {
                        marge_variant_ids = rule.bxa_gyb_discount_variant_ids;
                    } else if (rule.bxa_gyb_free_variant_ids.length > 0) {
                        marge_variant_ids = rule.bxa_gyb_free_variant_ids;
                    }
                }

                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'bogo',
                    price: price,
                    discount: 0,
                    quantity: quantity,
                    product_type: is_gift ? 'gift' : 'product',
                    gift_product_the_same: is_proudct == is_gift,
                    marge_variant_ids: marge_variant_ids,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price,
                        line_cid: self.cid,
                    }),
                };
            } else if (rule.compute_price === 'combo_sale') {
                var combo_variant_promotion = self.product.inner_join_combo_variant(rule, self.pos);
                var marge_tag = _.find(combo_variant_promotion, function (cvp) {
                    if (_.size(_.intersection(self.product.extra_attribute_value_ids, cvp, cvp)) == _.size(cvp)) {
                        return true;
                    }
                });
                var combo_product_promotion = self.product.inner_join_combo_product(rule, self.pos);
                var marge_product = _.find(combo_product_promotion, function (cpp) {
                    return self.product.id == cpp;
                });

                var combo_promotion_where_this_rule = _.filter(self.pos.combo_promotion, function (combo) {
                    return combo.promotion_id[0] == rule.id
                });
                var get_combo_promotion = _.find(combo_promotion_where_this_rule, function (combo) {
                    if (combo.applied_on === 'product') {
                        return combo.product_id[0] == self.product.id;
                    } else if (combo.applied_on === 'variant') {
                        var variant_ids = combo.variant_ids;
                        // console.log('variant_ids : ', variant_ids);
                        // console.log('self.product.extra_attribute_value_ids : ', self.product.extra_attribute_value_ids);
                        // console.log('merge : ', _.size(_.intersection(self.product.extra_attribute_value_ids, variant_ids, variant_ids)) == _.size(variant_ids));
                        return _.size(_.intersection(self.product.extra_attribute_value_ids, variant_ids, variant_ids)) == _.size(variant_ids);
                    }
                    return false;
                });
                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'combo',
                    price: price,
                    discount: 0,
                    quantity: quantity,
                    product_tag: self.product.extra_attribute_value_ids,
                    marge_tag: !!marge_tag ? marge_tag : [],
                    marge_product: !!marge_product ? marge_product : [],
                    combo_promotion: get_combo_promotion,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
                };
            }
            if (rule.base === 'pricelist') {
                new_price = self.get_price(rule.base_pricelist, quantity);
                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'price',
                    price: new_price,
                    discount: ((price - new_price) / price) * 100.00,
                    quantity: quantity,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
                };
            } else if (rule.base === 'standard_price') {
                new_price = self.standard_price;
                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'price',
                    price: new_price,
                    discount: ((price - new_price) / price) * 100.00,
                    quantity: quantity,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
                };
            }

            if (rule.min_quantity && quantity < rule.min_quantity) {
                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'price',
                    price: price,
                    discount: 0,
                    quantity: 0,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
                };
            }

            if (rule.compute_price === 'fixed') {
                new_price = round_pr(rule.fixed_price, 1);
                // let fixed_discount = 0;
                // if ((price - new_price) < 0) {
                //     fixed_discount = -((new_price - price) / price) * 100.00
                // } else {
                //     fixed_discount = ((price - new_price) / price) * 100.00
                // }
                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'price',
                    price: new_price,
                    discount: ((price - new_price) / price) * 100.00,
                    quantity: quantity,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
                };
            } else if (rule.compute_price === 'percentage') {
                new_price = price - (price * (rule.percent_price / 100));
                return {
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'price',
                    price: new_price,
                    discount: rule.percent_price,
                    quantity: quantity,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
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
                    rule_id: rule.id,
                    rule: rule,
                    sequence: rule.sequence,
                    pricelist_sequence: rule.pricelist_sequence,
                    type: 'price',
                    price: price,
                    discount: 0,
                    quantity: quantity,
                    product_id: self.product.id,
                    product: $.extend(self.product, {
                        line_price: price
                    }),
                };

            }
            // TODO : 
            return {
                rule_id: rule.id,
                rule: rule,
                sequence: rule.sequence,
                pricelist_sequence: rule.pricelist_sequence,
                type: 'price',
                price: price,
                discount: 0,
                product_id: this.id,
                product_id: self.product.id,
                product: $.extend(self.product, {
                    line_price: price
                }),
            };
        },
    });

})