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
        add_promotion_product: function (product, promotion_product, line, rule, price, quantity, discount, event) {
            let self = this;
            self.add_product(promotion_product, {
                price: price,
                quantity: quantity,
            });
            self.selected_orderline.compute_name = self.add_line_description(rule, line, discount, product);
            self.selected_orderline.product.display_name = self.selected_orderline.compute_name;

            if (_.size(event)) {
                _.each(event, function (_fcn) {
                    _fcn(self, product);
                });
            }
        },
        add_promotion_products: function (self, promotion_line, event = {}) {
            let group_rule = _.groupBy(promotion_line, 'rule_id');
            $.each(Object.keys(group_rule), function (i, key) {
                $.each(Object.keys(group_rule[key]), function (j, keys) {
                    let discount_product = self.pos.db.get_product_by_id(group_rule[key][keys].rule.related_product[0]);
                    if (discount_product) {
                        let promotion_product = $.extend(true, {}, discount_product);
                        let {
                            product,
                            line,
                            rule,
                            price,
                            quantity,
                            discount
                        } = group_rule[key][keys];
                        self.add_promotion_product.apply(self, [product, promotion_product, line, rule, price, quantity, discount, event]);
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
        check_order_discount: function () {
            // Common Declare Variables
            var self = this;
            var pricelists = self.pos.pricelists;
            var customer = this.get_client();
            self.remove_discount();
            var member_list = [];
            var rule_sum = [];
            var combo_list = [];
            var boso_list = [];
            let discount_price_list = [];
            let relation_product_list = [];
            window.order = self;

            // Per Line
            $.each(self.orderlines.models, function (i, line) {
                var product = line.product;
                var items = [];
                $.each(pricelists, function (i, pl) {
                    var pricelist_items = product.get_pricelist(pl, self.pos);
                    $.each(pricelist_items, function (i, item) {
                        items.push(item);
                    })
                });

                // check has pricelist item 
                if (items.length > 0) {
                    // if only one pricelist item
                    var pk = _.find(items, function (item) {
                        return item.is_primary_key;
                    });

                    // let pk_list = _.filter(items, function (item) {
                    //     return item.is_primary_key;
                    // });

                    var rule = pk || items[0];
                    if (pk || items.length == 1) {
                        // Special case (BOGO offer, Combo Promotion or do not want multi discount etc ...)
                        console.log('pk or only one')
                        self.add_discount_product(self, line, rule);
                        var result = line.get_price_byitem(rule);
                        // handle Range
                        if (result.type == 'range') {
                            rule_sum.push({
                                rule_id: rule.id,
                                rule: rule,
                                product_id: product.id,
                                quantity: result.quantity,
                                round_value: round_pr(result.price * result.quantity, 1)
                            });
                        }
                        // handle Combo
                        if (result.type == 'combo') {
                            var comboqty = result.quantity;
                            if (comboqty > 0) {
                                _.each(_.range(comboqty), function (i) {
                                    _.extend(result, {
                                        quantity: 1,
                                    })
                                    combo_list.push(result);
                                });
                            }
                        }
                        // handle BOGO offer
                        if (result.type == 'bogo') {
                            var qty = result.quantity;
                            if (qty > 0) {
                                _.each(_.range(qty), function (i) {
                                    _.extend(result, {
                                        quantity: 1,
                                    })
                                    boso_list.push(result);
                                });
                            }
                        }
                    } else {
                        // multi (Do not process Combo)
                        console.log('multi')
                        var temp_price = line.price
                        var sub_rate = 1;
                        var total_promotion_value = [];

                        $.each(items, function (i, item) {
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
                                    if (result_m.type == 'range') {
                                        rule_sum.push({
                                            rule_id: item.id,
                                            rule: item,
                                            product_id: product.id,
                                            quantity: result_m.quantity,
                                            round_value: round_pr(result_m.quantity * result_m.price, 1)
                                        });
                                    }
                                    if (result_m.type == 'combo') {
                                        var comboqty_m = result_m.quantity;
                                        if (comboqty_m > 0) {
                                            _.each(_.range(comboqty_m), function (i) {
                                                _.extend(result_m, {
                                                    quantity: 1,
                                                })
                                                combo_list.push(result_m);
                                            });
                                        }
                                    }
                                    if (result_m.type == 'bogo') {
                                        var qty_m = result_m.quantity;
                                        if (qty_m > 0) {
                                            _.each(_.range(qty_m), function (i) {
                                                _.extend(result_m, {
                                                    quantity: 1,
                                                })
                                                boso_list.push(result_m);
                                            });
                                        }
                                    }
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

            // Per Order (Combo)
            window.history_combo_list = combo_list;
            let combo_event = {
                'compute_combo_relation_product': self.compute_combo_relation_product
            };
            let combo_discount_line = self.compute_combo_promotion(self, combo_list);
            self.add_promotion_products(self, combo_discount_line, combo_event);
            window.history_combo_discount_line = combo_discount_line;
            // End Combo

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

            // Per Line (BOGO)
            var group_bogo = _.groupBy(boso_list, 'rule_id');
            var all_gift = _.groupBy(boso_list, 'product_type')['gift'];
            var gift_variant_group = _.groupBy(all_gift, 'marge_variant_ids');
            var unlink_gift_of_boso_list = [];
            window.history_boso_list = boso_list;
            window.history_unlink_gift_of_boso_list = unlink_gift_of_boso_list;
            $.each(Object.keys(group_bogo), function (i, t) {
                // sub query (like sql with)
                var group_where_type_product = _.filter(group_bogo[t], function (gwtp) {
                    return gwtp.product_type === 'product';
                });
                var group_where_type_gift = _.filter(group_bogo[t], function (gwtp) {
                    return gwtp.product_type === 'gift';
                });

                /* handle multi promotion have same gift
                /*
                /*      if this rule is Bug product A, Get product C
                /*      And anthor rule is Bug product B, Get product C
                /*      then the anthor rule should be minus this rule product C qty.
                */

                var should_remove_gift = false;
                var should_remove_qty = 0;
                if (group_where_type_gift.length && unlink_gift_of_boso_list.length) {
                    _.find(unlink_gift_of_boso_list, function (ugobl_variant_ids) {
                        should_remove_gift = _.pick(group_where_type_gift[0], 'marge_variant_ids').marge_variant_ids.join() === ugobl_variant_ids;
                        return should_remove_gift;
                    });
                    should_remove_qty = _.filter(unlink_gift_of_boso_list, (items) => {
                        return items == _.pick(group_where_type_gift[0], 'marge_variant_ids').marge_variant_ids.join();
                    }).length
                }
                var gift_set_qty = _.chain(group_where_type_gift)
                    .pluck('quantity')
                    .reduce(function (memo, num) {
                        return memo + num;
                    }, 0)
                    .value();
                gift_set_qty = should_remove_gift ? gift_set_qty - should_remove_qty : gift_set_qty;
                gift_set_qty = gift_set_qty < 0 ? 0 : gift_set_qty;
                // end handle multi promotion have same gift


                // sub query rule, gift, product
                var this_rule = group_bogo[t][0].rule;
                var product_set = _.chain(group_where_type_product)
                    .sortBy('price')
                    .pluck('product');
                product_set = this_rule.order_by_pirce === 'desc' ? product_set.reverse().value() : product_set.value();
                var product_set_qty = _.chain(group_where_type_product)
                    .pluck('quantity')
                    .reduce(function (memo, num) {
                        return memo + num;
                    }, 0)
                    .value();
                var gift_set = _.chain(group_where_type_gift)
                    .sortBy('price')
                    .pluck('product');
                gift_set = this_rule.order_by_pirce === 'desc' ? gift_set.reverse().value() : gift_set.value();

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
                // console.log('gift_set : ', gift_set);
                // console.log('gift_set_qty : ', gift_set_qty);
                console.log('product_set : ', product_set);
                // console.log('product_set_qty : ', product_set_qty);
                // console.log('the_same : ', the_same);
                // console.log('this_rule : ', this_rule);

                // Compute Promotion
                if (product_set.length) {
                    const quant = parseFloat(product_set_qty) || 0;
                    let discount_product = self.pos.db.get_product_by_id(this_rule.related_product[0]);
                    let temp_product = $.extend(true, {}, discount_product);
                    let discount = 0;
                    let i = 0;
                    let gift_index = 0;
                    let round = 0;

                    // console.log('discount_product : ', discount_product);
                    if (discount_product) {
                        if ((this_rule.bogo_base === 'bxa_gya_free' && quant) || the_same) {
                            do {
                                let Aproduct_unit = parseInt(this_rule.bxa_gya_free_Aproduct_unit);
                                i += Aproduct_unit;
                                if (!this_rule.min_quantity || round < this_rule.min_quantity) {
                                    _.each(_.range(this_rule.bxa_gya_free_Bproduct_unit), function (s) {
                                        i++;
                                        if (i <= quant) {
                                            var promotion_pirce = product_set[gift_index].line_price;
                                            if (the_same && this_rule.bogo_base === 'bxa_gyb_discount') {
                                                if (this_rule.bxa_gyb_discount_base_on === 'percentage') {
                                                    promotion_pirce = round_pr(promotion_pirce - (promotion_pirce * (this_rule.bxa_gyb_discount_percentage_price / 100)), 1);
                                                    discount = round_pr(this_rule.bxa_gyb_discount_percentage_price, 0.01);
                                                } else if (this_rule.bxa_gyb_discount_base_on === 'fixed') {
                                                    promotion_pirce = round_pr(this_rule.bxa_gyb_discount_fixed_price, 1);
                                                    discount = round_pr((((product_set[gift_index].line_price - promotion_pirce) / product_set[gift_index].line_price) * 100.00), 0.01);
                                                }
                                            } else {
                                                discount = 100;
                                            }
                                            temp_product = $.extend(true, {}, discount_product);
                                            self.add_product(temp_product, {
                                                'price': -promotion_pirce,
                                                'quantity': 1,
                                            });

                                            self.selected_orderline.compute_name = self.add_line_description(this_rule, undefined, discount, product_set[gift_index]);
                                            self.selected_orderline.product.display_name = self.selected_orderline.compute_name;
                                            // relation product
                                            let Bproduct_unit = parseInt(this_rule.bxa_gya_free_Bproduct_unit);
                                            let relation_product_lists = [];
                                            relation_product_lists = self.compute_relation_product(product_set, [], gift_index, i, Aproduct_unit, Bproduct_unit);
                                            self.selected_orderline.set_relation_product(relation_product_lists.join());

                                            gift_index++;
                                        }
                                    });
                                }
                                round++;
                            }
                            while (i <= quant);
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
                                        get_bogo_offer_itme = _.find(filter_this_rule_bogo_items, function (bogo_item) {
                                            return bogo_item.buy_x == i;
                                        });
                                    } else if (i > max_bogo_count && (!this_rule.min_quantity || (i - max_bogo_count) < this_rule.min_quantity)) {
                                        get_bogo_offer_itme = _.last(filter_this_rule_bogo_items);
                                    }
                                    if (i <= quant) {
                                        if (get_bogo_offer_itme) {
                                            var bogo_promotion_pirce = product_set[gift_index].line_price;
                                            bogo_promotion_pirce = bogo_promotion_pirce - (bogo_promotion_pirce * (get_bogo_offer_itme.based_on_percentage / 100));
                                            discount = get_bogo_offer_itme.based_on_percentage;
                                            if (discount > 0) {
                                                temp_product = $.extend(true, {}, discount_product);
                                                self.add_product(temp_product, {
                                                    'price': -round_pr(bogo_promotion_pirce, 1),
                                                    'quantity': 1,
                                                });

                                                // relation product
                                                let relation_product_lists = [];
                                                relation_product_lists.push(product_set[gift_index].id);

                                                self.selected_orderline.compute_name = self.add_line_description(this_rule, undefined, discount, product_set[gift_index]);
                                                self.selected_orderline.product.display_name = self.selected_orderline.compute_name;
                                                self.selected_orderline.set_relation_product(relation_product_lists.join());
                                            }
                                        }
                                        gift_index++;
                                        get_bogo_offer_itme = undefined;
                                    }
                                }
                                while (i <= quant);
                            }
                        } else if (this_rule.bogo_base === 'bxa_gyb_free' && quant && (parseFloat(gift_set_qty) || 0)) {
                            do {
                                let Aproduct_unit = parseInt(this_rule.bxa_gyb_free_Aproduct_unit);
                                i += Aproduct_unit;
                                if (i <= quant && (!this_rule.min_quantity || round < this_rule.min_quantity)) {
                                    _.each(_.range(this_rule.bxa_gyb_free_Bproduct_unit), function (s) {
                                        if ((gift_index + 1) <= gift_set_qty) {
                                            temp_product = $.extend(true, {}, discount_product);
                                            self.add_product(temp_product, {
                                                'price': -gift_set[gift_index].line_price,
                                                'quantity': 1,
                                            });
                                            discount = 100;

                                            self.selected_orderline.compute_name = self.add_line_description(this_rule, undefined, discount, gift_set[gift_index]);
                                            self.selected_orderline.product.display_name = self.selected_orderline.compute_name;

                                            // relation product
                                            let Bproduct_unit = parseInt(this_rule.bxa_gyb_free_Bproduct_unit);
                                            let relation_product_lists = [];
                                            relation_product_lists = self.compute_relation_product(product_set, gift_set, gift_index, i, Aproduct_unit, Bproduct_unit);
                                            // console.log(relation_product_lists);
                                            self.selected_orderline.set_relation_product(relation_product_lists.join());

                                            gift_index++;
                                            // TODO Fix: 
                                            if (this_rule.bxa_gyb_free_variant_ids.length) {
                                                unlink_gift_of_boso_list.push(
                                                    this_rule.bxa_gyb_free_variant_ids.join(),
                                                );
                                            }
                                        }
                                    });
                                    round++;
                                }
                            }
                            while (i <= quant);
                        } else if (this_rule.bogo_base === 'bxa_gyb_discount' && quant && (parseFloat(gift_set_qty) || 0)) {
                            do {
                                let Aproduct_unit = parseInt(this_rule.bxa_gyb_discount_Aproduct_unit);
                                i += Aproduct_unit;
                                if (i <= quant && (!this_rule.min_quantity || round < this_rule.min_quantity)) {
                                    _.each(_.range(this_rule.bxa_gyb_discount_Bproduct_unit), function (s) {
                                        if ((gift_index + 1) <= gift_set_qty) {
                                            var promotion_pirce = gift_set[gift_index].line_price;
                                            if (this_rule.bxa_gyb_discount_base_on === 'percentage') {
                                                promotion_pirce = round_pr(promotion_pirce - (promotion_pirce * (this_rule.bxa_gyb_discount_percentage_price / 100)), 1);
                                                discount = round_pr(this_rule.bxa_gyb_discount_percentage_price, 0.01);
                                            } else if (this_rule.bxa_gyb_discount_base_on === 'fixed') {
                                                promotion_pirce = round_pr(this_rule.bxa_gyb_discount_fixed_price, 1);
                                                discount = round_pr((((gift_set[gift_index].line_price - promotion_pirce) / gift_set[gift_index].line_price) * 100.00), 0.01);
                                            }
                                            temp_product = $.extend(true, {}, discount_product);
                                            self.add_product(temp_product, {
                                                'price': -promotion_pirce,
                                                'quantity': 1,
                                            });

                                            self.selected_orderline.compute_name = self.add_line_description(this_rule, undefined, discount, gift_set[gift_index]);
                                            self.selected_orderline.product.display_name = self.selected_orderline.compute_name;

                                            // relation product
                                            let Bproduct_unit = parseInt(this_rule.bxa_gyb_discount_Bproduct_unit);
                                            let relation_product_lists = [];
                                            relation_product_lists = self.compute_relation_product(product_set, gift_set, gift_index, i, Aproduct_unit, Bproduct_unit);
                                            // console.log(relation_product_lists);
                                            self.selected_orderline.set_relation_product(relation_product_lists.join());

                                            gift_index++;
                                            // TODO Fix: 
                                            if (this_rule.bxa_gyb_discount_variant_ids.length) {
                                                unlink_gift_of_boso_list.push(
                                                    this_rule.bxa_gyb_discount_variant_ids.join(),
                                                );
                                            }
                                        }
                                    });
                                    round++;
                                }
                            }
                            while (i <= quant);
                        } else {
                            console.log('NO GOBO Offer');
                        }
                    } else {
                        alert(_t("You should be setting pricelist of discount product !!!"));
                    }
                }
            });
            // End BOGO

            // GO Back first orderline (display correct discount proudct name) 
            if (self.orderlines.models.length) {
                this.select_orderline(self.orderlines.models[0]);
            }

        },
        compute_relation_product: (product_set, gift_set, gift_index, i, Aproduct_unit, Bproduct_unit) => {
            let relation_product_lists = []
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
        compute_combo_relation_product: (self, product) => {
            let relation_product_lists = [];
            relation_product_lists.push(product.id);
            self.selected_orderline.set_relation_product(relation_product_lists.join());
        },
        compute_bogo_promotion: () => {
            // need to refactoring
            return true;
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