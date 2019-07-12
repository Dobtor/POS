odoo.define('dobtor_pos_multi_pricelist.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var time = require('web.time');
    var _t = core._t;
    var round_pr = utils.round_precision;
    var exports = models;
    var is_debug = true;
    var is_dev_mode = true;

    exports.load_domain = function (model_name, domain) {
        var models = exports.PosModel.prototype.models;
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            if (model.model === model_name) {
                model.domain = domain;
            }
        }
    }
    exports.load_domain('product.pricelist', function (self) {
        var multi_pricelist_ids = self.config.multi_pricelist_ids;
        if (!multi_pricelist_ids.includes(self.config.pricelist_id[0])) {
            multi_pricelist_ids.push(self.config.pricelist_id[0]);
        }
        return [
            ['id', 'in', multi_pricelist_ids]
        ];
    });
    // export.load_fields()
    exports.load_fields('product.pricelist', ['discount_item', 'discount_product']);
    exports.load_fields('product.product', ['discount_type'])
    exports.load_fields('res.partner', ['birthday', 'member_id', 'used_birthday_times', 'can_discount_times', 'related_discount_product', 'birthday_discount', 'related_discount']);
    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
        initialize: function () {
            var self = this;
            _super_order.prototype.initialize.apply(self, arguments);
            // self.leave_qty = undefined;
        },
        // set_leave_qty: function (qty) {
        //     this.leave_qty = qty;
        // },
        export_as_JSON: function () {
            var res = _super_order.prototype.export_as_JSON.apply(this, arguments);
            return res
        },
        remove_discount: function () {
            var self = this;
            var orderlines = self.orderlines;
            // find all discount product and remove all. 
            var discount_line = _.filter(orderlines.models, function (line) {
                var product = line.product;
                return product.discount_type;
            });
            if (discount_line) {
                $.each(discount_line, function (inedx, d_line) {
                    self.remove_orderline(d_line);
                });
            }
        },
        add_discount_product: function (self, line, rule) {
            var result = line.get_price_byitem(rule);
            var product = line.product;
            if (result.quantity > 0) {
                var discount_product = self.pos.db.get_product_by_id(rule.related_product[0]);
                if (discount_product) {
                    var temp_product = $.extend(true, {}, discount_product);
                    if (result.type == 'price') {
                        if (round_pr((result.price - product.lst_price), 1)) {

                            self.add_product(temp_product, {
                                'price': round_pr((result.price - product.lst_price), 1),
                                'quantity': result.quantity,
                            });

                            self.selected_orderline.compute_name = self.add_line_description(rule, line);
                            self.selected_orderline.product.display_name = self.selected_orderline.compute_name;
                            // handle relation product 
                            let relation_product = [];
                            relation_product.push(product.id);
                            self.selected_orderline.set_relation_product(relation_product.join());
                        }
                    }
                } else {
                    alert(_t("You should be setting pricelist of discount product !!!"));
                }
            }
        },
        add_line_description: function (item, line = undefined, discount = 0, product = undefined, description = undefined) {
            var product_display_name;
            if (line || product) {
                product_display_name = line ? line.product.display_name : product.display_name;
            }
            if (discount && product_display_name) {
                return `${item.related_discount_name} [${product_display_name}] (- ${discount} %)`;
            } else {
                if (description) {
                    return `${item.related_discount_name} [${description}]`;
                }
                if (product_display_name) {
                    return `${item.related_discount_name} [${product_display_name}]`;
                }
                return `${item.related_discount_name}`;
            }
        },
        add_promotion_product: function (product, promotion_product, line, rule, price, quantity, discount, event, relation_products) {
            let self = this;
            self.add_product(promotion_product, {
                price: price,
                quantity: quantity,
            });
            self.selected_orderline.compute_name = self.add_line_description(rule, line, discount, product);
            self.selected_orderline.product.display_name = self.selected_orderline.compute_name;

            if (_.size(event)) {
                _.each(event, function (_fcn) {
                    _fcn(self, relation_products);
                });
            }
        },
        add_promotion_products: function (self, promotion_line, event = {}) {
            let group_rule = _.groupBy(promotion_line, 'rule_id');
            _.each(Object.keys(group_rule), function (key) {
                _.each(Object.keys(group_rule[key]), function (keys) {
                    let discount_product = self.pos.db.get_product_by_id(group_rule[key][keys].rule.related_product[0]);
                    if (discount_product) {
                        let promotion_product = $.extend(true, {}, discount_product);
                        let {
                            product,
                            line,
                            rule,
                            price,
                            quantity,
                            discount,
                            relation_products
                        } = group_rule[key][keys];
                        relation_products = relation_products ? relation_products : product;
                        if (discount) {
                            self.add_promotion_product.apply(self, [product, promotion_product, line, rule, round_pr(price, 1), quantity, round_pr(discount, 0.01), event, relation_products]);
                        }
                    } else {
                        alert(_t("You should be setting pricelist of discount product !!!"));
                    }
                });
            });
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
        compute_member_promotion: function (self, customer, member_list, get_range_promotion = undefined, rule_total = 0, discount_rate = 0) {
            // var sort = self.pos.config.member_discount_rule;
            window.history_member_list = member_list;

            console.log('member_discount_rule', self.pos.config.member_discount_rule)
            var group_member = _.groupBy(member_list, 'product_id');
            group_member = _.chain(group_member)
                .sortBy('price');
            group_member = self.pos.config.member_discount_rule == 'desc' ? group_member.reverse().value() : group_member.value();
            console.log('group_member', group_member)
            var today_date = new moment().format('MM');
            var leave_qty = 0;
            if (customer && customer.birthday) {
                leave_qty = customer ? customer.birthday.split('-').slice(1)[0] == today_date ? customer.can_discount_times : 0 : 0;
            }
            var temp_qty = 0;
            _.each(Object.keys(group_member), function (_key) {
                _.each(group_member[_key], function (_proudct) {
                    var sub_rate = _proudct.sub_rate;
                    if (get_range_promotion) {
                        if (get_range_promotion.based_on === 'rebate') {
                            discount_rate = rule_total == 0 ? 0 : (get_range_promotion.based_on_rebate) / rule_total;
                        }
                        // console.log('get_range_promotion.based_on_rebate : ', get_range_promotion.based_on_rebate);
                        // console.log('rule_total :', rule_total);
                        // console.log('discount_rate : ', discount_rate);
                        $.extend(_proudct, {
                            sub_rate: _proudct.sub_rate * (1 - discount_rate)
                        });
                    }
                    var line = _proudct;
                    var current_qty = line.quantity;
                    sub_rate = line.sub_rate;
                    console.log('member discount');
                    if (self.pos.config.available_member_discount) {
                        if (sub_rate >= self.pos.config.member_discount_limit && customer && customer.member_id[0]) {

                            window.birthday = customer.birthday;

                            temp_qty = _.min([line.quantity, leave_qty]);
                            current_qty -= (temp_qty < 0 ? 0 : temp_qty);

                            if ((customer.birthday && customer.birthday.split('-').slice(1)[0]) == today_date && leave_qty) {
                                var member_product = self.pos.db.get_product_by_id(customer.related_discount_product[0])
                                var temp_product = $.extend(true, {}, member_product);
                                self.add_product(temp_product, {
                                    'price': -round_pr(line.price * sub_rate * customer.birthday_discount, 1),
                                    'quantity': _.min([line.quantity, customer.can_discount_times])
                                });

                                self.selected_orderline.compute_name = _t(`Birthday [${line.product.display_name}] (- ${(customer.birthday_discount) * 100} %)`);
                                self.selected_orderline.product.display_name = self.selected_orderline.compute_name;
                                // relation product 
                                self.selected_orderline.set_relation_product(line.product_id);
                            }


                            if (customer.related_discount && (!((customer.birthday && customer.birthday.split('-').slice(1)[0]) == today_date) || current_qty)) {
                                var member_product = self.pos.db.get_product_by_id(customer.related_discount_product[0]);
                                var temp_product = $.extend(true, {}, member_product);

                                self.add_product(temp_product, {
                                    'price': -round_pr(line.price * sub_rate * customer.related_discount, 1),
                                    'quantity': current_qty
                                });
                                self.selected_orderline.compute_name = _t(`${customer.member_id[1]} [${line.product.display_name}] ( - ${customer.related_discount * 100} %)`);
                                self.selected_orderline.product.display_name = self.selected_orderline.compute_name;
                                // relation product 
                                self.selected_orderline.set_relation_product(line.product_id);
                            }
                            leave_qty -= (temp_qty < 0 ? 0 : temp_qty);
                        }
                    }
                });
            });
        },
        strategy_promotion_list: function (result, combo_list, bogo_list, rule_sum) {
            /**
             * this is old multi promotion flow, should be delete after new flow on production hosts.
             * @param {object} result get promotion rule info of the product
             * @param {object} combo_list array of combo list
             * @param {object} bogo_list array of bogo list
             * @param {object} rule_sum array of range list
             */
            let qty = result.quantity;
            if (qty > 0) {
                let strategy = result.type;
                let copy_result = _.extend({}, result);
                if (strategy === 'bogo') {
                    copy_result.quantity = 1;
                    _.map(_.range(qty), () => {
                        bogo_list.push(copy_result);
                    });
                }
                if (strategy === 'combo') {
                    copy_result.quantity = 1;
                    _.map(_.range(qty), () => {
                        combo_list.push(copy_result);
                    });
                }
                // if (strategy === 'price') {
                //     model.push(result);
                // }
                if (strategy === 'range') {
                    rule_sum.push(copy_result);
                }
            }
            return {
                combo_list,
                bogo_list,
                rule_sum
            };
        },
        strategy_promotion_model: function (result, model) {
            /**
             * @param {object} result get promotion rule info of the product
             * @param {object} model array of rule info
             */

            let qty = result.quantity;
            if (qty > 0) {
                let strategy = result.type;
                let copy_result = _.extend({}, result);
                if (['bogo', 'combo'].includes(strategy)) {
                    copy_result.quantity = 1;
                    _.map(_.range(qty), () => {
                        model.push(copy_result);
                    });
                }
                if (strategy === 'price') {
                    model.push(result);
                }
                if (strategy === 'range') {
                    model.push(copy_result);
                }
            }
            return model;
        },
        get_promotion_model: function (self, line, all_rule, repeat, rule_apply_on, model) {
            /**
             * @param {object} self class order execut context
             * @param {object} line current order line
             * @param {object} all_rule Get all promotion rule of the product
             * @param {boolean} repeat is rule repeat ?
             * @param {string} rule_apply_on rule is 'line' (ganeral rule) or 'order'
             * @param {object} model array of rule info
             */

            let mapping_condition_rule = _.filter(all_rule,
                item => (repeat ? !item.not_repeat_ok : item.not_repeat_ok) && item.level_on === rule_apply_on
            );
            _.each(mapping_condition_rule, function (rule) {
                let result = line.get_price_byitem(rule);
                model = self.strategy_promotion_model(result, model);
            });

            return model;
        },
        handle_ganeral_rule: function (self, model, repeat, promotion_line, unlink_gift_of_bogo_list) {
            /**
             * @param {object} self class order execut context
             * @param {object} model array of specific rule info 
             * @param {boolean} repeat is rule repeat ?
             * @param {object} promotion_line array of need to add discount line
             */
            let group_by_rule = _.groupBy(model, 'rule_id');
            
            // let result = [];
            _.each(Object.keys(group_by_rule), function (key) {
                let this_rule = _.first(group_by_rule[key]).rule;
                // console.log('can repeat ?', repeat);
                // console.log('promotion_line length', promotion_line.length);
                // console.log('condiser :', (!promotion_line.length || !!promotion_line.length == repeat));
                if (!promotion_line.length || !!promotion_line.length == repeat) {
                    _.each(group_by_rule[key], function (item) {
                        let output = _.extend({}, item);
                        if (item.type === 'price') {
                            let promotion_pirce = round_pr((item.price - item.product.lst_price), 1);
                            if (promotion_pirce) {
                                promotion_line.push(_.extend(output, {
                                    price: promotion_pirce,
                                    line: undefined,
                                    relation_products: [item.product_id],
                                }));
                            }
                            console.log('after price promotion_line :', promotion_line);
                        }
                    });
                    if (group_by_rule[key][0].type === 'combo') {
                        promotion_line = promotion_line.concat(self.compute_combo_promotion(self, group_by_rule[key]));
                        console.log('after combo promotion_line :', promotion_line);
                    }
                    if (group_by_rule[key][0].type === 'bogo') {
                        let output_bogo_line =[];
                        ({
                            output_bogo_line,
                            unlink_gift_of_bogo_list
                        } = self.compute_bogo_promotion(self, group_by_rule[key], unlink_gift_of_bogo_list));
                        console.log('new bogo output_bogo_line :', output_bogo_line);

                        promotion_line = promotion_line.concat(output_bogo_line);
                        console.log('after bogo :', promotion_line);
                    }
                }
            });
            return promotion_line;
        },
        check_order_discount: function () {
            // Common Declare Variables
            var self = this;
            let pricelists = self.pos.pricelists;
            var customer = this.get_client();
            self.remove_discount();
            var member_list = [];
            var rule_sum = [];
            var combo_list = [];
            var bogo_list = [];
            window.order = self;

            // new multi pricelist logic
            let ganeral_with_repeat_info = [];
            let ganeral_without_repeat_info = [];
            let order_with_repeat_info = [];
            let order_without_repeat_info = [];
            let promotion_line = [];

            // Per Line
            $.each(self.orderlines.models, function (i, line) {
                var product = line.product;

                // following priclist activity diagram :
                // Get all promotion rule of the product & 
                // Rules are sorted by sequence
                // ------------------------------------------------------------
                let product_mapping_all_rule = [];
                _.each(pricelists, function (pl) {
                    let pricelist_items = product.get_pricelist(pl, self.pos);
                    _.map(pricelist_items, item => {
                        product_mapping_all_rule.push(item);
                    });
                });
                // ------------------------------------------------------------

                // check has pricelist item 
                if (product_mapping_all_rule.length > 0) {
                    // 2019/7/11 : new multi promotion flow
                    // -----------------------------------------------------------
                    // following priclist activity diagram :
                    // Rules are filter by non-order level &
                    // is this rule can repeat?
                    if (is_dev_mode) {
                        ganeral_without_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, false, 'line', ganeral_without_repeat_info);
                        ganeral_with_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, true, 'line', ganeral_with_repeat_info);
                        order_without_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, false, 'order', order_without_repeat_info);
                        order_with_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, true, 'order', order_with_repeat_info);
                    }
                    // ------------------------------------------------------------
                    // if only one pricelist item (old multi promotion flow)
                    // -----------------------------------------------------
                    var ganeral_without_repeat = _.find(product_mapping_all_rule, function (item) {
                        return item.not_repeat_ok;
                    });
                    var rule = ganeral_without_repeat || product_mapping_all_rule[0];
                    if (ganeral_without_repeat || product_mapping_all_rule.length == 1) {
                        // Special case (find the no repeat rule)
                        console.log('ganeral without repeat or only one');
                        // self.add_discount_product(self, line, rule);
                        // handle Combo ,Bogo offer and Range
                        var result = line.get_price_byitem(rule);
                        ({
                            combo_list,
                            bogo_list,
                            rule_sum
                        } = self.strategy_promotion_list(result, combo_list, bogo_list, rule_sum));
                        // ------------------------------------------------------
                    } else {
                        // multi (Do not process Combo)
                        console.log('multi')
                        var temp_price = line.price
                        var sub_rate = 1;
                        var total_promotion_value = [];

                        $.each(product_mapping_all_rule, function (i, item) {
                            if (line.quantity > 0) {
                                var result_m = line.get_price_byitem(item);
                                var discount_product = self.pos.db.get_product_by_id(item.related_product[0]);

                                if (discount_product) {

                                    var temp_product = $.extend(true, {}, discount_product);

                                    if (result_m.type == 'price' && temp_product) {
                                        var discount_rate = round_pr(result_m.discount, 0.01) / 100.00;
                                        var discount_price = round_pr(-discount_rate * temp_price, 1);
                                        if (round_pr(result_m.discount, 0.01) > 0 && discount_price) {
                                            self.add_product(temp_product, {
                                                'price': discount_price,
                                                'quantity': result_m.quantity
                                            });
                                            sub_rate = sub_rate * (1 - discount_rate);
                                            self.selected_orderline.compute_name = self.add_line_description(item, line, round_pr(result_m.discount, 0.01));
                                            self.selected_orderline.product.display_name = self.selected_orderline.compute_name;
                                            // handle relation product
                                            let relation_product = [];
                                            relation_product.push(line.product.id);
                                            self.selected_orderline.set_relation_product(relation_product.join());

                                            temp_price = temp_price + discount_price;

                                            total_promotion_value.push({
                                                product_id: product.id,
                                                promotion_value: round_pr(result_m.quantity * discount_price, 1)
                                            })
                                        }
                                        // total_promotion_value += round_pr(result_m.quantity * discount_price, 1);
                                    }
                                    // handle Combo ,Bogo offer and Range
                                    ({
                                        combo_list,
                                        bogo_list,
                                        rule_sum
                                    } = self.strategy_promotion_list(result_m, combo_list, bogo_list, rule_sum));
                                } else {
                                    alert(_t("You should be setting pricelist of discount product !!!"));
                                }
                            }
                        });
                        member_list.push({
                            product_id: product.id,
                            product: product,
                            product_price: product.lst_price * line.quantity,
                            price: product.lst_price,
                            quantity: line.quantity,
                            // total_discount_price: total_promotion_value,
                            sub_rate: sub_rate,
                        });

                        let group_product = _.groupBy(rule_sum, 'product_id');
                        window.group_product = group_product;
                        _.each(Object.keys(group_product), function (group_product_key) {
                            _.each(group_product[group_product_key], function (product_itmes) {
                                let this_promtion_value = _.filter(total_promotion_value, item => product_itmes.product_id == item.product_id);
                                let get_this_promtion_value = _.pluck(this_promtion_value, 'promotion_value');
                                let sum_promtion_value = _.reduce(get_this_promtion_value, (memo, num) => memo + num, 0);
                                $.extend(product_itmes, {
                                    round_value: product_itmes.round_value + sum_promtion_value
                                });
                            })
                        });
                    }
                }
            });
            // End Per Line

            // handle not repeat rule & repeat rule

            console.log('ganeral_without_repeat_info :', ganeral_without_repeat_info);
            console.log('ganeral_with_repeat_info :', ganeral_with_repeat_info);
            console.log('order_without_repeat_info :', order_without_repeat_info);
            console.log('order_with_repeat_info :', order_with_repeat_info);

            let internal_combo_list = [];
            promotion_line = self.handle_ganeral_rule(self, ganeral_without_repeat_info, false, promotion_line, internal_combo_list);
            window.history_promotion_line = promotion_line;
            console.log('promotion_line 0:', promotion_line);
            if (promotion_line.length) {
                console.log('go without repeat');
                let promotion_event = {
                    'compute_promotion_relation_product': (self, relation_products) => {
                        self.selected_orderline.set_relation_product(relation_products.join());
                    }
                };
                self.add_promotion_products(self, promotion_line, promotion_event);
                console.log('promotion_line 1:', promotion_line);
            } else {
                console.log('go with repeat');
                promotion_line = self.handle_ganeral_rule(self, ganeral_with_repeat_info, true, promotion_line, internal_combo_list);
                if (promotion_line.length) {
                    let promotion_event2 = {
                        'compute_promotion_relation_product': (self, relation_products) => {
                            self.selected_orderline.set_relation_product(relation_products.join());
                        }
                    };
                    self.add_promotion_products(self, promotion_line, promotion_event2);
                }
                console.log('promotion_line 2:', promotion_line);
            }
            // End not repeat rule & repeat rule


            // Per Order (Combo)
            // window.history_combo_list = combo_list;
            // let combo_event = {
            //     'compute_combo_relation_product': self.compute_combo_relation_product
            // };
            // let combo_discount_line = self.compute_combo_promotion(self, combo_list);
            // self.add_promotion_products(self, combo_discount_line, combo_event);
            // window.history_combo_discount_line = combo_discount_line;
            // End Combo

            // per Line(BOGO)
            // console.log('bogo_list :', bogo_list);
            // let output_bogo_line = [];
            // let unlink_gift_of_bogo_list = [];
            // ({
            //     output_bogo_line,
            //     unlink_gift_of_bogo_list
            // } = self.compute_bogo_promotion(self, bogo_list, unlink_gift_of_bogo_list));
            // console.log('output_bogo_line :', output_bogo_line);
            // if (output_bogo_line.length) {
            //     let bogo_event = {
            //         'compute_bogo_relation_product': (self, relation_products) => {
            //             self.selected_orderline.set_relation_product(relation_products.join());
            //         }
            //     };
            //     window.history_bogo_promotion_line = output_bogo_line;
            //     self.add_promotion_products(self, output_bogo_line, bogo_event);
            // }
            // End BOGO

            // Per Order (Range)
            window.history_rule_sum = rule_sum;
            var group_rule = _.groupBy(rule_sum, 'rule_id');
            $.each(Object.keys(group_rule), function (i, t) {
                var pluck_qty = _.pluck(group_rule[t], 'quantity');
                var pluck_val = _.pluck(group_rule[t], 'round_value');
                var this_rule = group_rule[t][0].rule;
                var rule_total = _.reduce(pluck_val, (memo, num) => memo + num, 0);
                var qty_total = _.reduce(pluck_qty, (memo, num) => memo + num, 0);

                var get_range_promotion = _.find(self.pos.range_promotion, function (range) {
                    if (range.promotion_id[0] == group_rule[t][0].rule_id) {
                        return rule_total >= range.start;
                    }
                    return false;
                });

                if (get_range_promotion && (!this_rule.min_quantity || qty_total >= this_rule.min_quantity)) {
                    var discount_product = self.pos.db.get_product_by_id(this_rule.related_product[0]);
                    var discount_rate = 0;
                    if (discount_product) {
                        var temp_product = $.extend(true, {}, discount_product);
                        if (get_range_promotion.based_on === 'rebate') {
                            self.add_product(temp_product, {
                                'price': -get_range_promotion.based_on_rebate,
                            });
                        } else if (get_range_promotion.based_on === 'percentage') {
                            self.add_product(temp_product, {
                                'price': -round_pr(rule_total * (get_range_promotion.based_on_percentage / 100), 1),
                            });
                            discount_rate = get_range_promotion.based_on_percentage;
                        }
                        self.selected_orderline.compute_name = self.add_line_description(this_rule, undefined, 0, undefined, _('Range based Discount'));
                        self.selected_orderline.product.display_name = self.selected_orderline.compute_name;
                        let relation_product = _.pluck(group_rule[t], 'product_id');
                        self.selected_orderline.set_relation_product(relation_product.join());
                    } else {
                        alert(_t("You should be setting pricelist of discount product !!!"));
                    }

                    // Compute Sub Rate - member_list
                    self.compute_member_promotion(self, customer, member_list, get_range_promotion, rule_total, discount_rate / 100);
                } else {
                    self.compute_member_promotion(self, customer, member_list);
                }
            });
            if (!rule_sum.length) {
                self.compute_member_promotion(self, customer, member_list);
            }
            // End Range

            // GO Back first orderline (display correct discount proudct name) 
            if (self.orderlines.models.length) {
                this.select_orderline(self.orderlines.models[0]);
            }

        },
        compute_combo_relation_product: (self, product) => {
            let relation_product_lists = [];
            relation_product_lists.push(product.id);
            self.selected_orderline.set_relation_product(relation_product_lists.join());
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
        prepare_group_bogo: (source, type) => {
            return _.filter(source, function (item) {
                return item.product_type === type;
            });
        },
        compute_range_promotion: () => {
            return true;
        },
        warning_no_config_discount_product: () => {
            return true;
        },
    });

    var _super_orderline = exports.Orderline;
    exports.Orderline = exports.Orderline.extend({
        initialize: function (attr, options) {
            var self = this;
            _super_orderline.prototype.initialize.apply(self, arguments);
            self.compute_name = '';
            self.relation_product = '';
        },
        set_relation_product: function (_relation_product) {
            this.relation_product = _relation_product;
        },
        get_relation_product: function () {
            return this.relation_product;
        },
        export_as_JSON: function () {
            var self = this;
            var res = _super_orderline.prototype.export_as_JSON.apply(self, arguments);
            // res.discount_price = self.get_discount_price();
            res.compute_name = self.compute_name;
            res.relation_product = self.get_relation_product();
            return res;
        }
    })
})
