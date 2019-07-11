odoo.define('dobtor_pos_promotion.bogo_promotion', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var exports = models;
    var is_debug = false;

    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
        bogo_promotion: (self, rule, bogo_promotion_line, Aproduct_unit, Bproduct_unit, quant, product_set, gift_set, gift_set_qty, unlink_gift_of_bogo_list) => {
            /**
             * @param {object} self class order execut context
             * @param {object} rule current product rule (pricelist item)
             * @param {object} bogo_promotion_line array of bogo info
             * @param {number} Aproduct_unit A product unit
             * @param {number} Bproduct_unit B product unit
             * @param {number} quant number of product set
             * @param {object} product_set array of product set
             * @param {object} gift_set array of gift set
             * @param {number} gift_set_qty number of gift set
             * @param {object} unlink_gift_of_bogo_list array of need unlike gift set
             */
            let i = 0;
            let gift_index = 0;
            let round = 0;
            do {
                i += Aproduct_unit;
                if (i <= quant && (!rule.min_quantity || round < rule.min_quantity)) {
                    _.each(_.range(Bproduct_unit), function (s) {
                        if ((gift_index + 1) <= gift_set_qty) {
                            let discount = 0;
                            let promotion_pirce = gift_set[gift_index].line_price;

                            switch (self.reflect_bogo(rule, '_base_no', 'percentage')) {
                                case 'percentage':
                                    promotion_pirce = promotion_pirce * (self.reflect_bogo(rule, '_percentage_price', 100) / 100);
                                    discount = self.reflect_bogo(rule, '_percentage_price', 100);
                                    break;
                                case 'fixed':
                                    promotion_pirce = promotion_pirce - self.reflect_bogo(rule, '_fixed_price', 0);
                                    discount = ((gift_set[gift_index].line_price - promotion_pirce) / gift_set[gift_index].line_price) * 100.00;
                                    break;
                                default:
                                    break;
                            }

                            bogo_promotion_line.push({
                                rule: rule,
                                rule_id: rule.id,
                                product: gift_set[gift_index],
                                price: -promotion_pirce,
                                quantity: 1,
                                discount: discount,
                                line: undefined,
                                relation_products: self.compute_relation_product(product_set, gift_set, gift_index, i, Aproduct_unit, Bproduct_unit)
                            });

                            gift_index++;
                            if (self.reflect_bogo(rule, '_variant_ids', []).lenght) {
                                unlink_gift_of_bogo_list.push(
                                    self.reflect_bogo(rule, '_variant_ids', []).join(),
                                );
                            }
                        }
                    });
                    round++;
                }
            }
            while (i <= quant);

            return {
                bogo_promotion_line: bogo_promotion_line,
                unlink_gift_of_bogo_list: unlink_gift_of_bogo_list
            };
        },
        compute_relation_product: (product_set, gift_set, gift_index, i, Aproduct_unit, Bproduct_unit) => {
            /**
             * @param {object} product_set array of product set
             * @param {object} gift_set array of gift set
             * @param {number} gift_index current gift sequence
             * @param {number} i current product sequence
             * @param {number} Aproduct_unit A product unit
             * @param {number} Bproduct_unit B product unit
             */
            let relation_product_lists = [];
            let slice_product_set = product_set.slice(-Aproduct_unit);
            let A_puls_B_unit = Aproduct_unit + Bproduct_unit;
            let get_times = parseInt((i - 1) / A_puls_B_unit);
            if (get_times) {
                slice_product_set = product_set.slice(-Aproduct_unit * (get_times + 1), -Aproduct_unit * get_times);
            }
            _.map(slice_product_set,
                (item) => {
                    relation_product_lists.push(item.id);
                }
            );
            relation_product_lists.push(gift_set.length ? gift_set[gift_index].id : product_set[gift_index].id);
            return relation_product_lists;
        },
        reflect_bogo: (rule, keyword, _default = undefined) => {
            /**
             * @param {object} rule current product rule (pricelist item).
             * @param {string} keyword property keyword in bogo pricelist item.
             * @param {object} _default if not the target has the property, return value .
             */
            return Reflect.has(rule, rule.bogo_base.concat(keyword)) ?
                Reflect.get(rule, rule.bogo_base.concat(keyword)) :
                _default;
        },
    });
});