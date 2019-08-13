odoo.define('dobtor_pos_promotion.range_promotion', function (require) {
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
        compute_range_promotion: (self, rule_sum) => {
            /**
             * @param {object} self pos order context
             * @param {object} rule_sum array of range info
             */

            let result = [];
            let group_rule = _.groupBy(rule_sum, 'rule_id');
            _.each(Object.keys(group_rule), function (t) {
                let pluck_qty = _.pluck(group_rule[t], 'quantity');
                let pluck_val = _.pluck(group_rule[t], 'round_value');
                let this_rule = group_rule[t][0].rule;
                let rule_total = _.reduce(pluck_val, (memo, num) => memo + num, 0);
                let qty_total = _.reduce(pluck_qty, (memo, num) => memo + num, 0);

                let get_range_promotion = _.find(self.pos.range_promotion, function (range) {
                    if (range.promotion_id[0] == group_rule[t][0].rule_id) {
                        return rule_total >= range.start;
                    }
                    return false;
                });

                if (get_range_promotion && (!this_rule.min_quantity || qty_total >= this_rule.min_quantity)) {
                    let promotion_pirce = rule_total;
                    if (get_range_promotion.based_on === 'rebate') {
                        promotion_pirce = get_range_promotion.based_on_rebate;
                    } else if (get_range_promotion.based_on === 'percentage') {
                        // promotion_pirce = round_pr(rule_total * (get_range_promotion.based_on_percentage / 100), 1);
                        promotion_pirce = (rule_total * (get_range_promotion.based_on_percentage / 100));
                    }
                    let output_promtion = _.extend({}, group_rule[t][0]);
                    result.push(_.extend(output_promtion, {
                        product: undefined,
                        product_id: undefined,
                        price: -promotion_pirce,
                        quantity: 1,
                        line: undefined,
                        discount: undefined,
                        relation_products: _.pluck(group_rule[t], 'product_id'),
                        description: _t('Range based Discount'),
                        if_need_remove_product: _.pluck(group_rule[t], 'product_id'),
                    }));
                }
            });
            return result;
        },
    });
});