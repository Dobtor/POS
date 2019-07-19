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
             */
            let group_combo = _.groupBy(combo_list, 'rule_id');
            let result = [];
            _.each(Object.keys(group_combo), function (key) {

                let this_rule = group_combo[key][0].rule;
                let group_variant = _.groupBy(_.filter(group_combo[key], (item) => !!item.marge_tag.length), 'marge_tag');
                let group_product = _.groupBy(_.filter(group_combo[key], (item) => !!item.marge_product.length), 'marge_product');
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
                    let group_min_qty = _.min(_.map(group_all, (value) => _.size(value)));
                    if (group_min_qty > 0) {
                        _.each(Object.keys(group_all), function (product_group_name) {
                            let product_group_order_by_price = _.chain(group_all[product_group_name])
                                .sortBy('price');
                            product_group_order_by_price = this_rule.combo_order_by_pirce === 'desc' ? product_group_order_by_price.reverse().value() : product_group_order_by_price.value();
                            _.each(product_group_order_by_price, function (item, index) {
                                if (index < group_min_qty) {
                                    let price = item.product.line_price;
                                    let discount = 0;
                                    if (item.combo_promotion.based_on === 'price') {
                                        price = item.combo_promotion.based_on_price - item.product.line_price
                                        discount = round_pr((((item.product.line_price - item.combo_promotion.based_on_price) / item.product.line_price) * 100.00), 0.01);
                                    } else if (item.combo_promotion.based_on === 'percentage') {
                                        price = -round_pr(item.product.line_price * (item.combo_promotion.based_on_percentage / 100), 1)
                                        discount = item.combo_promotion.based_on_percentage;
                                    }

                                    result.push({
                                        rule: this_rule,
                                        rule_id: this_rule.id,
                                        product: item.product,
                                        price: price,
                                        quantity: 1,
                                        discount: discount,
                                        line: undefined,
                                        relation_products: [item.product_id],
                                        if_need_remove_product: [item.product_id]
                                    });

                                }
                            });
                        });
                    }
                }
            });
            return result;
        },
        inner_join_combo_product: (rule, pos) => {
            let combo_promotion = [];
            let get_combo_promotion;
            if (pos) {
                get_combo_promotion = _.filter(pos.combo_promotion, combo => combo.promotion_id[0] == rule.id);
                if (get_combo_promotion) {
                    combo_promotion = _.pluck(_.pluck(get_combo_promotion, 'product_id'), 0);
                }
            }
            return combo_promotion;
        },
    });
});