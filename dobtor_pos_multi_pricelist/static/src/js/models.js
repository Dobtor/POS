odoo.define('dobtor_pos_multi_pricelist.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var exports = models;
    var time = require('web.time');

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
    exports.load_fields('product.pricelist', ['discount_item', 'discount_product']);
    exports.load_fields('product.product', ['discount_type'])
    exports.load_fields('res.partner', ['birthday', 'member_id', 'used_birthday_times', 'can_discount_times', 'related_discount_product', 'birthday_discount', 'related_discount']);
    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
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
                if (result.type == 'bogo') {
                    self.add_product(self.pos.db.get_product_by_id(rule.related_product[0]), {
                        'price': -result.price,
                        'quantity': result.quantity,
                    });
                    self.selected_orderline.compute_name = self.add_line_description(rule, line)

                } else if (result.type == 'price') {
                    if (round_pr((result.price - product.lst_price), 1)) {
                        self.add_product(self.pos.db.get_product_by_id(rule.related_product[0]), {
                            'price': round_pr((result.price - product.lst_price), 1),
                            'quantity': result.quantity,
                        });
                        self.selected_orderline.compute_name = self.add_line_description(rule, line)
                        self.selected_orderline.product.display_name = self.selected_orderline.compute_name
                    }
                }
            }
        },
        add_line_description: function (item, line, discount = 0) {
            if (discount) {
                return item.related_discount_name + ' [' + line.product.display_name + '] ( -' + discount + ' %)'
            } else {
                return item.related_discount_name + ' [' + line.product.display_name + ']'
            }
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
        check_order_discount: function () {
            // Common Declare Variables
            var self = this;
            var pricelists = self.pos.pricelists;
            var customer = this.get_client();
            self.remove_discount();
            var rule_sum = [];
            var combo_list = [];

            // Per Line
            $.each(self.orderlines.models, function (i, line) {
                var product = line.product;
                var items = [];
                $.each(pricelists, function (i, pl) {
                    var pricelist_items = product.get_pricelist(pl, self.pos);
                    $.each(pricelist_items, function (i, item) {
                        items.push(item)
                    })
                });
                // check has pricelist item 
                if (items.length > 0) {
                    // if only one pricelist item
                    if (items.length == 1) {
                        console.log('only one')
                        self.add_discount_product(self, line, items[0]);
                        var result_only = line.get_price_byitem(items[0]);
                        // handle Range
                        if (result_only.type == 'range') {
                            rule_sum.push({
                                rule_id: items[0].id,
                                rule: items[0],
                                round_value: round_pr(result_only.price * result_only.quantity, 0)
                            });
                        }
                        // handle Combo
                        if (result_only.type == 'combo') {
                            combo_list.push({
                                rule_id: items[0].id,
                                rule: items[0],
                                combo_product: result_only,
                            });
                        }
                    } else {
                        var pk = _.find(items, function (item) {
                            return item.is_primary_key;
                        });
                        if (pk) {
                            // Special case (BOGO offer, Combo Promotion or do not want multi discount etc ...)
                            console.log('pk')
                            self.add_discount_product(self, line, pk);
                            var result_pk = line.get_price_byitem(pk);
                            // handle Range
                            if (result_pk.type == 'range') {
                                rule_sum.push({
                                    rule_id: pk.id,
                                    rule: pk,
                                    round_value: round_pr(result_pk.price * result_pk.quantity, 0)
                                });
                            }
                            // handle Combo
                            if (result_pk.type == 'combo') {
                                combo_list.push({
                                    rule_id: pk.id,
                                    rule: pk,
                                    combo_product: result_pk,
                                });
                            }

                        } else {
                            // multi (Do not process Combo)
                            console.log('multi')
                            var temp_price = line.price
                            var sub_rate = 1;
                            $.each(items, function (i, item) {
                                if (line.quantity > 0) {
                                    var result_m = line.get_price_byitem(item)
                                    var discount_rate = result_m.discount / 100
                                    var discount_product = self.pos.db.get_product_by_id(item.related_product[0]);
                                    var temp_product = $.extend(true, {}, discount_product);
                                    var discount_price = round_pr(-discount_rate * temp_price, 1)
                                    if (result_m.type == 'price' && result_m.discount > 0 && temp_product && discount_price) {
                                        self.add_product(temp_product, {
                                            'price': discount_price,
                                            'quantity': result_m.quantity
                                        })
                                        sub_rate = sub_rate * (1 - discount_rate)
                                        self.selected_orderline.compute_name = self.add_line_description(item, line, result_m.discount)
                                        self.selected_orderline.product.display_name = self.selected_orderline.compute_name
                                        temp_price = temp_price + discount_price
                                    }
                                    if (result_m.type == 'range') {
                                        rule_sum.push({
                                            rule_id: item.id,
                                            rule: item,
                                            round_value: round_pr(result_m.quantity * result_m.price, 0)
                                        });
                                    }
                                }
                            });
                            if (sub_rate >= 0.6 && customer) {
                                if (customer.member_id[0]) {
                                    var today_date = new moment().format('YYYY-MM-DD');
                                    if (customer.birthday == today_date && customer.used_birthday_times <= customer.can_discount_times) {
                                        var member_product = self.pos.db.get_product_by_id(customer.related_discount_product[0])
                                        var temp_product = $.extend(true, {}, member_product);
                                        self.add_product(temp_product, {
                                            'price': -line.price * sub_rate * customer.birthday_discount,
                                            'quantity': line.quantity
                                        })
                                        self.selected_orderline.compute_name = customer.member_id[1] + '[' + line.product.display_name + '] ( -' + (customer.birthday_discount) * 100 + ' %)'
                                        self.selected_orderline.product.display_name = self.selected_orderline.compute_name
                                    } else if (customer.related_discount) {
                                        var member_product = self.pos.db.get_product_by_id(customer.related_discount_product[0])
                                        var temp_product = $.extend(true, {}, member_product);

                                        self.add_product(temp_product, {
                                            'price': -line.price * sub_rate * customer.related_discount,
                                            'quantity': line.quantity
                                        })
                                        self.selected_orderline.compute_name = customer.member_id[1] + '[' + line.product.display_name + '] ( -' + (customer.related_discount) * 100 + ' %)'
                                        self.selected_orderline.product.display_name = self.selected_orderline.compute_name
                                    }
                                }
                            }

                        }
                    }
                }
            });
            // End Per Line

            // Per Order (Range)
            var group_rule = _.groupBy(rule_sum, 'rule_id');
            $.each(Object.keys(group_rule), function (i, t) {
                var pluck_val = _.pluck(group_rule[t], 'round_value');
                var this_rule = group_rule[t][0].rule;
                var rule_total = _.reduce(pluck_val, function (memo, num) {
                    return memo + num;
                }, 0);

                var get_range_promotion = _.find(self.pos.range_promotion, function (range) {
                    if (range.promotion_id[0] == group_rule[t][0].rule_id) {
                        return rule_total >= range.start;
                    }
                    return false;
                });

                if (get_range_promotion) {
                    if (get_range_promotion.based_on === 'rebate') {
                        self.add_product(self.pos.db.get_product_by_id(this_rule.related_product[0]), {
                            'price': -get_range_promotion.based_on_rebate,
                        });
                    } else if (get_range_promotion.based_on === 'percentage') {
                        self.add_product(self.pos.db.get_product_by_id(this_rule.related_product[0]), {
                            'price': -round_pr(rule_total * (get_range_promotion.based_on_percentage / 100), 0),
                        });
                    }
                }
            });
            // End Range

            // Per Order (Combo)
            var group_combo = _.groupBy(combo_list, 'rule_id');
            $.each(Object.keys(group_combo), function (i, t) {
                var pluck_product = _.pluck(group_combo[t], 'combo_product');
                var this_rule = group_combo[t][0].rule;
                if (pluck_product.length && pluck_product.length == self.inner_join_combo_product(this_rule, self.pos).length) {
                    var sort_min_qty_product = _.sortBy(pluck_product, 'quantity');
                    var min_combo_qty = sort_min_qty_product[0].quantity;
                    if (min_combo_qty > 0) {
                        
                        $.each(sort_min_qty_product, function (i, item) {
                            var get_combo_promotion = _.find(self.pos.combo_promotion, function (combo) {
                                if (combo.promotion_id[0] == group_combo[t][0].rule_id) {
                                    return combo.product_id[0] == item.product.id;
                                }
                                return false;
                            });
                            if (get_combo_promotion.based_on === 'price') {
                                self.add_product(self.pos.db.get_product_by_id(this_rule.related_product[0]), {
                                    'price': get_combo_promotion.based_on_price - item.product.lst_price,
                                    'quantity': min_combo_qty,
                                });
                            } else if (get_combo_promotion.based_on === 'percentage') {
                                self.add_product(self.pos.db.get_product_by_id(this_rule.related_product[0]), {
                                    'price': -round_pr(item.product.lst_price * (get_combo_promotion.based_on_percentage / 100), 0),
                                    'quantity': min_combo_qty,
                                });
                            }
                        });
                    }
                }
            });
            // End Combo
        }
    });

    var _super_orderline = exports.Orderline;
    exports.Orderline = exports.Orderline.extend({
        initialize: function (attr, options) {
            var self = this;
            _super_orderline.prototype.initialize.apply(self, arguments);
            self.compute_name = '';
        },
        export_as_JSON: function () {
            var self = this;
            var res = _super_orderline.prototype.export_as_JSON.apply(self, arguments)
            res.compute_name = self.compute_name
            return res
        }
    })
})