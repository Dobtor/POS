odoo.define('dobtor_pos_promotion.combo_promotion', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var _t = core._t;
    var round_pr = utils.round_precision;
    var exports = models;
    var is_debug = false;

    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
        compute_combo_promotion: (self, combo_list, event) => {
            /**
             * @param {object} self pos order context
             * @param {object} combo_list array of combo info
             * @param {object} event other function
             */
            let group_combo = _.groupBy(combo_list, 'rule_id');
            $.each(Object.keys(group_combo), function (i, t) {

                var this_rule = group_combo[t][0].rule;
                var group_variant = _.groupBy(_.filter(group_combo[t], (item) => !!item.marge_tag.length), 'marge_tag');
                var group_product = _.groupBy(_.filter(group_combo[t], (item) => !!item.marge_product.length), 'marge_product');
                var group_all = _.extend(group_variant, group_product);

                // check system log
                if (is_debug) {
                    console.log('group_variant: ', group_variant);
                    console.log('group_product : ', group_product);
                    console.log('group_combo: ', group_combo);
                    console.log('group_all : ', group_all);
                    console.log('this_rule : ', this_rule);
                }

                if (Object.keys(group_all).length && Object.keys(group_all).length == self.inner_join_combo_product(this_rule, self.pos).length) {

                    var group_min_qty = _.min(_.map(group_all, (value) => {
                        return _.size(value);
                    }));

                    if (group_min_qty > 0) {
                        $.each(Object.keys(group_all), function (j, product_group_name) {
                            var product_group_order_by_price = _.chain(group_all[product_group_name])
                                .sortBy('price');
                            product_group_order_by_price = this_rule.combo_order_by_pirce === 'desc' ? product_group_order_by_price.reverse().value() : product_group_order_by_price.value();
                            $.each(product_group_order_by_price, function (k, items) {
                                if (k < group_min_qty) {
                                    // TODO : Refacting "discount_product"
                                    var discount_product = self.pos.db.get_product_by_id(this_rule.related_product[0]);
                                    if (discount_product) {
                                        var temp_product = $.extend(true, {}, discount_product);
                                        var discount = 0;
                                        if (items.combo_promotion.based_on === 'price') {
                                            self.add_product(temp_product, {
                                                'price': items.combo_promotion.based_on_price - items.product.line_price,
                                                'quantity': 1,
                                            });
                                            discount = round_pr((((items.product.line_price - items.combo_promotion.based_on_price) / items.product.line_price) * 100.00), 0.01);
                                        } else if (items.combo_promotion.based_on === 'percentage') {
                                            self.add_product(temp_product, {
                                                'price': -round_pr(items.product.line_price * (items.combo_promotion.based_on_percentage / 100), 1),
                                                'quantity': 1,
                                            });
                                            discount = items.combo_promotion.based_on_percentage;
                                        }
                                        self.selected_orderline.compute_name = self.add_line_description(this_rule, undefined, discount, items.product);
                                        self.selected_orderline.product.display_name = self.selected_orderline.compute_name;

                                        _.each(event, function(_fcn) {
                                           _fcn(self, items.product);
                                        });

                                    } else {
                                        alert(_t("You should be setting pricelist of discount product !!!"));
                                    }
                                }
                            });
                        });
                    }
                }
            });
            return true;
        },
    });
});