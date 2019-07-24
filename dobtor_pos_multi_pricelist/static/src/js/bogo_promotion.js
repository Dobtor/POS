odoo.define('dobtor_pos_promotion.bogo_promotion', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var exports = models;
    var is_debug = false;

    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
        compute_bogo_promotion: function (self, bogo_list, unlink_gift_of_bogo_list) {
            /**
             * @param {object} self class order execut context
             * @param {object} bogo_list array of bogo info
             * @param {object} unlink_gift_of_bogo_list array of need unlike gift set
             */

            let group_bogo = _.groupBy(bogo_list, 'rule_id');
            var all_gift = _.groupBy(bogo_list, 'product_type')['gift'];
            var gift_variant_group = _.groupBy(all_gift, 'marge_variant_ids');
            // var unlink_gift_of_bogo_list = [];

            // new modify 
            let output_bogo_line = [];
            let bogo_discount_line = [];
            let bogo_promotion_line = [];
            // {
            //     rule: this_rule,
            //     rule_id: key,
            //     product: item.product,
            //     price: price,
            //     quantity: 1,
            //     discount: discount,
            //     line: undefined,
            // }

            _.each(Object.keys(group_bogo), function (t) {
                // sub query (like sql with)
                var this_rule = group_bogo[t][0].rule;
                let group_where_type_product = self.prepare_group_bogo(group_bogo[t], 'product');
                let group_where_type_gift = self.prepare_group_bogo(group_bogo[t], 'gift');

                /* handle multi promotion have same gift
                /*
                /*      if this rule is Bug product A, Get product C
                /*      And anthor rule is Bug product B, Get product C
                /*      then the anthor rule should be minus this rule product C qty.
                */

                var should_remove_gift = false;
                var should_remove_qty = 0;
                if (group_where_type_gift.length && unlink_gift_of_bogo_list.length) {
                    _.find(unlink_gift_of_bogo_list, function (ugobl_variant_ids) {
                        should_remove_gift = _.pick(group_where_type_gift[0], 'marge_variant_ids').marge_variant_ids.join() === ugobl_variant_ids;
                        return should_remove_gift;
                    });
                    should_remove_qty = _.filter(unlink_gift_of_bogo_list,
                        unlink_gift_item => unlink_gift_item == _.pick(group_where_type_gift[0], 'marge_variant_ids').marge_variant_ids.join()
                    ).length
                }
                var gift_set_qty = self.get_promotion_qty(group_where_type_gift);
                gift_set_qty = should_remove_gift ? gift_set_qty - should_remove_qty : gift_set_qty;
                gift_set_qty = gift_set_qty < 0 ? 0 : gift_set_qty;
                var gift_set = self.get_bogo_product_set(group_where_type_gift, this_rule.order_by_pirce);
                // end handle multi promotion have same gift

                // get product set, and product qty
                var product_set = self.get_bogo_product_set(group_where_type_product, this_rule.order_by_pirce);
                var product_set_qty = self.get_promotion_qty(group_where_type_product);

                if (should_remove_gift && gift_set_qty < group_where_type_gift.length) {
                    for (var remove = 0; remove < should_remove_qty; remove++) {
                        gift_set.shift();
                    }
                }

                // handle the same
                var the_same = false;
                if (the_same && (parseFloat(gift_set_qty) || 0)) {
                    the_same = group_where_type_gift[0].gift_product_the_same;
                    product_set = gift_set;
                    product_set_qty = gift_set_qty;
                }

                // check system log
                if (is_debug) {
                    console.log('gift_set : ', gift_set);
                    console.log('gift_set_qty : ', gift_set_qty);
                    console.log('product_set : ', product_set);
                    console.log('product_set_qty : ', product_set_qty);
                    console.log('the_same : ', the_same);
                    console.log('this_rule : ', this_rule);
                }

                // Compute Promotion
                if (product_set.length) {
                    const quant = parseFloat(product_set_qty) || 0;
                    let discount = 0;
                    let i = 0;
                    let gift_index = 0;
                    let round = 0;
                    // let prefix = this_rule.bogo_base;
                    let Aproduct_unit = self.reflect_bogo(this_rule, '_Aproduct_unit', 0);
                    let Bproduct_unit = self.reflect_bogo(this_rule, '_Bproduct_unit', 0);


                    if ((this_rule.bogo_base === 'bxa_gya_free' && quant) || the_same) {
                        do {
                            i += Aproduct_unit;
                            if (!this_rule.min_quantity || round < this_rule.min_quantity) {
                                _.each(_.range(Bproduct_unit), function (s) {                                    
                                    i++;
                                    if (i <= quant) {
                                        let new_gift_index = gift_index;
                                        if (this_rule.order_by_pirce === 'desc') {
                                            new_gift_index = gift_index + (round+1) * Aproduct_unit;
                                        }

                                        var promotion_pirce = product_set[new_gift_index].line_price;
                                        if (the_same && this_rule.bogo_base === 'bxa_gyb_discount') {
                                            if (this_rule.bxa_gyb_discount_base_on === 'percentage') {
                                                promotion_pirce = round_pr((promotion_pirce * (this_rule.bxa_gyb_discount_percentage_price / 100)), 1);
                                                discount = round_pr(this_rule.bxa_gyb_discount_percentage_price, 0.01);
                                            } else if (this_rule.bxa_gyb_discount_base_on === 'fixed') {
                                                promotion_pirce = round_pr(promotion_pirce - this_rule.bxa_gyb_discount_fixed_price, 1);
                                                discount = round_pr((((product_set[new_gift_index].line_price - promotion_pirce) / product_set[new_gift_index].line_price) * 100.00), 0.01);
                                            }
                                        } else {
                                            discount = 100;
                                        }
                                        let relation_product = self.compute_relation_product(product_set, [], gift_index, i, Aproduct_unit, Bproduct_unit, this_rule.order_by_pirce, new_gift_index);
                                        let if_need_remove_product = (gift_index + 1) % Bproduct_unit ? [product_set[new_gift_index].id] : relation_product;

                                        bogo_promotion_line.push({
                                            rule: this_rule,
                                            rule_id: this_rule.id,
                                            product: product_set[new_gift_index],
                                            product_id: product_set[new_gift_index].id,
                                            price: -promotion_pirce,
                                            quantity: 1,
                                            discount: discount,
                                            line: undefined,
                                            relation_products: relation_product,
                                            if_need_remove_product: if_need_remove_product,
                                        });
                                        gift_index++;
                                    }
                                });
                            }
                            round++;
                        }
                        while (i <= quant);
                        output_bogo_line = output_bogo_line.concat(bogo_promotion_line);

                    } else if (this_rule.bogo_base === 'bxa_gya_discount' && quant) {
                        var get_bogo_offer_itme = undefined;
                        var filter_this_rule_bogo_items = _.filter(self.pos.bogo_offer_items, function (bogo_item) {
                            return bogo_item.promotion_id[0] == group_bogo[t][0].rule_id
                        });
                        var max_bogo_count = filter_this_rule_bogo_items.length;
                        if (max_bogo_count) {
                            do {
                                i += 1;
                                if (i <= max_bogo_count) {
                                    get_bogo_offer_itme = _.find(filter_this_rule_bogo_items, bogo_item => bogo_item.buy_x == i);
                                } else if (i > max_bogo_count && (!this_rule.min_quantity || (i - max_bogo_count) < this_rule.min_quantity)) {
                                    get_bogo_offer_itme = _.last(filter_this_rule_bogo_items);
                                }
                                if (i <= quant) {
                                    if (get_bogo_offer_itme) {
                                        let bogo_promotion_pirce = product_set[gift_index].line_price;
                                        bogo_promotion_pirce = -bogo_promotion_pirce * (get_bogo_offer_itme.based_on_percentage / 100);
                                        discount = get_bogo_offer_itme.based_on_percentage;

                                        let relation_product_lists = [];
                                        relation_product_lists.push(product_set[gift_index].id);
                                        bogo_discount_line.push({
                                            rule: this_rule,
                                            rule_id: this_rule.id,
                                            product: product_set[gift_index],
                                            product_id: product_set[gift_index].id,
                                            price: bogo_promotion_pirce,
                                            quantity: 1,
                                            discount: discount,
                                            line: undefined,
                                            origin_price: product_set[gift_index].line_price,
                                            relation_products: relation_product_lists,
                                            if_need_remove_product: relation_product_lists,
                                        });
                                    }
                                    gift_index++;
                                    get_bogo_offer_itme = undefined;
                                }
                            }
                            while (i <= quant);
                        }
                    } else if (['bxa_gyb_free', 'bxa_gyb_discount'].includes(this_rule.bogo_base) && quant && (parseFloat(gift_set_qty) || 0)) {
                        ({
                            bogo_promotion_line,
                            unlink_gift_of_bogo_list
                        } = self.bogo_promotion(self, this_rule, bogo_promotion_line, Aproduct_unit, Bproduct_unit, quant, product_set, gift_set, gift_set_qty, unlink_gift_of_bogo_list));
                        output_bogo_line = output_bogo_line.concat(bogo_promotion_line);
                    } else {
                        console.log('NO GOBO Offer');
                    }
                }
                if (bogo_discount_line.length) {
                    let last_discount = _.last(bogo_discount_line).discount;
                    if (bogo_discount_line[0].rule.bxa_gya_discount_apply_all) {
                        _.each(bogo_discount_line, function (product_itmes) {
                            _.extend(product_itmes, {
                                price: -product_itmes.origin_price * (last_discount / 100),
                                discount: last_discount
                            });
                        });
                    }
                }
                output_bogo_line = output_bogo_line.concat(bogo_discount_line);
            });

            return {
                output_bogo_line: output_bogo_line,
                unlink_gift_of_bogo_list: unlink_gift_of_bogo_list
            };
        },
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

                            let relation_product = self.compute_relation_product(product_set, gift_set, gift_index, i, Aproduct_unit, Bproduct_unit);
                            let if_need_remove_product = (gift_index + 1) % Bproduct_unit ? [gift_set[gift_index].id] :relation_product;

                            bogo_promotion_line.push({
                                rule: rule,
                                rule_id: rule.id,
                                product: gift_set[gift_index],
                                product_id: gift_set[gift_index].id,
                                price: -promotion_pirce,
                                quantity: 1,
                                discount: discount,
                                line: undefined,
                                relation_products: relation_product,
                                if_need_remove_product: if_need_remove_product,
                            });

                            gift_index++;
                            if (self.reflect_bogo(rule, '_variant_ids', []).length) {
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
        compute_relation_product: (product_set, gift_set, gift_index, i, Aproduct_unit, Bproduct_unit, order = 'acs', new_gift_index = 0) => {
            /**
             * Compute this bogo promotion relation product.
             * @param {object} product_set array of product set
             * @param {object} gift_set array of gift set
             * @param {number} gift_index current gift sequence
             * @param {number} i current product sequence
             * @param {number} Aproduct_unit A product unit
             * @param {number} Bproduct_unit B product unit
             */
            let relation_product_lists = [];
            let relation_product_set = [...product_set];
            let desc_unit = 0;
            if (order === 'desc' && !gift_set.length) {
                desc_unit = Bproduct_unit;
                relation_product_set = _.sortBy(relation_product_set, 'lst_price');
            }
            let slice_length = -(Aproduct_unit) * Math.ceil((gift_index + 1) / Bproduct_unit) - desc_unit * Math.ceil((gift_index + 1) / Bproduct_unit);
            
            let slice_all_product_set = relation_product_set.slice(slice_length);
            let slice_product_set = slice_all_product_set.slice(-slice_length > product_set.length ? 0 : desc_unit, Aproduct_unit + desc_unit);
            if (!is_debug) {
                console.log('slice_length : ', slice_length);
                // console.log('(gift_index + 1) / Bproduct_unit) :', (gift_index + 1) / Bproduct_unit);
                console.log('ceil :', Math.ceil((gift_index + 1) / Bproduct_unit));
                console.log('desc_unit:', desc_unit);
                console.log('product_set : ', product_set);
                console.log('relation_product_set : ', relation_product_set);
                console.log('slice_all_product_set :', slice_all_product_set);
                console.log('slice_product_set :', slice_product_set);
            }
            
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
            relation_product_lists.push(gift_set.length ? gift_set[gift_index].id : product_set[new_gift_index].id);
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
        prepare_group_bogo: (source, type) => {
            return _.filter(source, function (item) {
                return item.product_type === type;
            });
        },
        get_promotion_qty: (source) => {
            return _.chain(source)
                .pluck('quantity')
                .reduce((memo, num) => memo + num, 0)
                .value();
        },
        get_bogo_product_set: (source, order_by) => {
            let product_set = _.chain(source)
                .sortBy('price')
                .pluck('product');
            product_set = order_by === 'desc' ? product_set.reverse().value() : product_set.value();
            return product_set;
        },
    });
});
