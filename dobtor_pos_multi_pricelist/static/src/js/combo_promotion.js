odoo.define('dobtor_pos_promotion.combo_promotion', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var exports = models;
    var is_debug = false;

    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
        compute_combo_promotion: (self, combo_list) => {
            /**
             * @param {object} self pos order context
             * @param {object} combo_list array of combo info
             * @param {object} event other function
             */
            let group_combo = _.groupBy(combo_list, 'rule_id');
            let result = [];
            $.each(Object.keys(group_combo), function (i, t) {

                let this_rule = group_combo[t][0].rule;
                let group_variant = _.groupBy(_.filter(group_combo[t], (item) => !!item.marge_tag.length), 'marge_tag');
                let group_product = _.groupBy(_.filter(group_combo[t], (item) => !!item.marge_product.length), 'marge_product');
                let group_all = _.extend(group_variant, group_product);

                // check system log
                if (is_debug) {
                    console.log('group_variant: ', group_variant);
                    console.log('group_product : ', group_product);
                    console.log('group_combo: ', group_combo);
                    console.log('group_all : ', group_all);
                    console.log('this_rule : ', this_rule);
                }

                if (Object.keys(group_all).length && Object.keys(group_all).length == self.inner_join_combo_product(this_rule, self.pos).length) {

                    let group_min_qty = _.min(_.map(group_all, (value) => {
                        return _.size(value);
                    }));

                    if (group_min_qty > 0) {
                        $.each(Object.keys(group_all), function (j, product_group_name) {
                            let product_group_order_by_price = _.chain(group_all[product_group_name])
                                .sortBy('price');
                            product_group_order_by_price = this_rule.combo_order_by_pirce === 'desc' ? product_group_order_by_price.reverse().value() : product_group_order_by_price.value();
                            $.each(product_group_order_by_price, function (k, items) {
                                if (k < group_min_qty) {
                                    let price = items.product.line_price;
                                    let discount = 0;
                                    if (items.combo_promotion.based_on === 'price') {
                                        price = items.combo_promotion.based_on_price - items.product.line_price
                                        discount = round_pr((((items.product.line_price - items.combo_promotion.based_on_price) / items.product.line_price) * 100.00), 0.01);
                                    } else if (items.combo_promotion.based_on === 'percentage') {
                                        price = -round_pr(items.product.line_price * (items.combo_promotion.based_on_percentage / 100), 1)
                                        discount = items.combo_promotion.based_on_percentage;
                                    }

                                    result.push({
                                        rule: this_rule,
                                        rule_id: t,
                                        product: items.product,
                                        price: price,
                                        quantity: 1,
                                        discount: discount,
                                        line: undefined,
                                    });

                                }
                            });
                        });
                    }
                }
            });
            return result;
        },
    });
});