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
    var show_flow = false;

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
                _.each(discount_line, function (d_line) {
                    self.remove_orderline(d_line);
                });
            }
        },
        add_line_description: function (item, line = undefined, discount = 0, product = undefined, description = undefined, rule_description = undefined) {
            var product_display_name;
            if (line || product) {
                product_display_name = line ? line.product.display_name : product.display_name;
            }
            if (discount && product_display_name) {
                return `${rule_description ? rule_description : item.related_discount_name} [${product_display_name}] (${discount > 0 ? '-': '+'} ${Math.abs(discount)} %)`;
            } else {
                if (description) {
                    return `${rule_description ? rule_description : item.related_discount_name} [${description}]`;
                }
                if (product_display_name) {
                    return `${rule_description ? rule_description : item.related_discount_name} [${product_display_name}]`;
                }
                return `${rule_description ? rule_description : item.related_discount_name}`;
            }
        },
        add_promotion_product: function (product, promotion_product, line, rule, price, quantity, discount, event, relation_products, description, rule_description) {
            let self = this;
            self.add_product(promotion_product, {
                price: price,
                quantity: quantity,
                merge: false
            });
            // console.log(`qty : ${quantity}, price : ${price}, discount : ${discount}`);
            // console.log('promotion_product :', promotion_product);
            self.selected_orderline.compute_name = self.add_line_description(rule, line, discount, product, description, rule_description);
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
                            relation_products,
                            description,
                            rule_description,
                        } = group_rule[key][keys];
                        relation_products = relation_products ? relation_products : product;
                        if (discount || discount == undefined) {
                            self.add_promotion_product.apply(self, [product, promotion_product, line, rule, round_pr(price, 1), quantity, discount == undefined ? undefined : round_pr(discount, 0.01), event, relation_products, description, rule_description]);
                        }
                    } else {
                        alert(_t("You should be setting pricelist of discount product !!!"));
                    }
                });
            });
        },
        compute_member_promotion: function (self, customer, member_list, get_range_promotion = undefined, rule_total = 0, discount_rate = 0) {
            // var sort = self.pos.config.member_discount_rule;
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
             * @param {object} unlink_gift_of_bogo_list array of need unlike gift set
             */

            let group_by_rule = _.chain(model).groupBy('rule_id').sortBy(item => item.sequence).sortBy(item => item.pricelist_sequence).value();
            console.log('group_by_rule :', group_by_rule);
            _.each(group_by_rule, function (group) {
                // let this_rule = _.first(group_by_rule[key]).rule;
                // handle repraet
                let after_except_data = [];
                let handle_data = [];
                // let get_relation_product = _.pluck(promotion_line, 'relation_products');
                // if (get_relation_product.length) {
                //     get_relation_product = _.uniq(get_relation_product.join().split(','));
                //     after_except_data = _.filter(group_by_rule[key], function (item) {
                //         return !get_relation_product.includes(item.product_id + '') || repeat;
                //     });
                // }

                let get_need_remove_product = _.pluck(promotion_line, 'if_need_remove_product');
                if (get_need_remove_product.length && !repeat) {
                    get_need_remove_product = get_need_remove_product.join().split(',');
                    after_except_data = _.map(group, function (item) {
                        _.each(get_need_remove_product, product_id => {
                            if (product_id == item.product_id)
                                item.quantity--;
                        });
                        return item;
                    });
                    after_except_data = _.filter(group, item => item.quantity > 0);
                }
                if (after_except_data.length || (after_except_data.length == 0 && group.length && promotion_line.length)) {
                    handle_data = [...after_except_data];
                } else {
                    handle_data = [...group];
                }
                handle_data = _.filter(group, item => item.quantity > 0);
                handle_data = _.chain(handle_data).sortBy(item => item.sequence).sortBy(item => item.pricelist_sequence).value();

                _.each(handle_data, function (item) {
                    let output = _.extend({}, item);

                    if (item.type === 'price') {
                        let promotion_pirce = round_pr((item.price - item.product.lst_price), 1);
                        if (promotion_pirce) {
                            let if_need_remove_product = [];
                            _.map(_.range(item.quantity), index => if_need_remove_product.push(item.product_id))
                            promotion_line.push(_.extend(output, {
                                price: promotion_pirce,
                                line: undefined,
                                relation_products: [item.product_id],
                                if_need_remove_product: if_need_remove_product,
                            }));
                        }
                    }
                });
                if (handle_data.length) {
                    if (handle_data[0].type === 'combo') {
                        promotion_line = promotion_line.concat(self.compute_combo_promotion(self, handle_data));
                    }
                    if (handle_data[0].type === 'bogo') {
                        let output_bogo_line = [];
                        ({
                            output_bogo_line,
                            unlink_gift_of_bogo_list
                        } = self.compute_bogo_promotion(self, handle_data, unlink_gift_of_bogo_list));
                        promotion_line = promotion_line.concat(output_bogo_line);
                    }
                }
            });
            return {
                promotion_line: promotion_line,
                unlink_gift_of_bogo_list: unlink_gift_of_bogo_list,
            };
        },
        compute_mix_promotion: (self, promotion_line) => {
            /**
             * @param {object} self class order execut context
             * @param {object} promotion_line array of need to add discount line
             */
            let except_not_mix_promotion = _.filter(promotion_line, line => !line.promotion_type || line.promotion_type != 'unmix');
            let d = [...except_not_mix_promotion];
            console.log('except_not_mix_promotion : ', d);
            let group_by_product = _.groupBy(except_not_mix_promotion, 'product_id');
            _.each(Object.keys(group_by_product), function (product_id) {
                let stort_product_by_qty = _.sortBy(group_by_product[product_id], 'quantity');
                let except_same_rule = [...stort_product_by_qty];
                _.each(stort_product_by_qty, function (line) {
                    except_same_rule = _.filter(except_same_rule, (item) => item.rule_id != line.rule_id);
                    let np = 1;
                    let last_np = (1 - line.discount / 100.0);
                    let rest_np;
                    let realtion_rule = '';
                    _.each(except_same_rule, function (oline) {
                        let output = _.extend({}, line);
                        let qty = 0;
                        np = last_np * (1 - (oline.discount / 100.0));
                        rest_np = last_np - np;
                        last_np = np;
                        if (line.quantity > oline.quantity) {
                            qty = oline.quantity;
                        } else {
                            qty = line.quantity;
                        }
                        realtion_rule += ',' + oline.rule_id;
                        let get_current_except_not_mix_promotion = _.filter(promotion_line, line => !line.promotion_type || line.promotion_type != 'unmix');
                        let promotion_for_product = _.filter(get_current_except_not_mix_promotion, pline => product_id == pline.product_id && pline.promotion_type === 'mix');

                        let G = _.groupBy(promotion_for_product, 'base_mix');
                        let outs = [];
                        _.each(Object.keys(G), k => {
                            let mrl = _.max(G[k], mix => mix.realtion_rule.split(',').length);
                            let mrl_set = _.filter(G[k], mix => mix.realtion_rule == mrl.realtion_rule);
                            outs = [...mrl_set];
                        });
                        let done = _.filter(outs, pfp => (pfp.other_mix.indexOf(',' + line.rule_id + realtion_rule) != -1 || pfp.other_mix.indexOf(',' + line.rule_id + line.other_mix) != -1) && pfp.base_mix != line.rule_id);
                        if (show_flow)
                            console.log('rule plus : ', line.rule_id + realtion_rule);
                        if (done.length) {
                            qty = qty - _.reduce(_.pluck(done, 'quantity'), (memo, num) => memo + num, 0);
                        }
                        if (qty > 0) {
                            promotion_line.push(_.extend(output, {
                                promotion_type: 'mix',
                                price: (line.product.lst_price * oline.discount / 100.0) - (line.product.lst_price * rest_np),
                                discount: -(((line.product.lst_price * oline.discount / 100.0) - (line.product.lst_price * rest_np)) / line.product.lst_price) * 100,
                                quantity: qty,
                                realtion_rule: line.rule_id + realtion_rule,
                                base_mix: line.rule_id,
                                other_mix: realtion_rule
                            }));
                        }
                    });
                });
            });
            return promotion_line
        },
        handle_order_rule: function (self, model, repeat, promotion_line) {
            /**
             * @param {object} self class order execut context
             * @param {object} model array of specific rule info 
             * @param {boolean} repeat is rule repeat ?
             * @param {object} promotion_line array of need to add discount line
             */
            // let group_by_rule = _.groupBy(model, 'rule_id');
            let group_by_rule = _.chain(model).groupBy('rule_id').sortBy(item => item.sequence).sortBy(item => item.pricelist_sequence).value();

            // let result = [];
            _.each(group_by_rule, function (group) {
                // let this_rule = _.first(group).rule;
                // handle repraet
                let after_except_data = [];
                let handle_data = [];
                let order_promotion_line = _.filter(promotion_line, item => item.type === 'range' || item.promotion_type == 'unmix');

                let get_need_remove_product = _.pluck(order_promotion_line, 'if_need_remove_product');
                console.log('handle_order_rule get_need_remove_product : ', get_need_remove_product);
                if (get_need_remove_product.length && !repeat) {
                    get_need_remove_product = get_need_remove_product.join().split(',');
                    after_except_data = _.map(group, function (item) {
                        _.each(get_need_remove_product, product_id => {
                            if (product_id == item.product_id)
                                item.quantity--;
                        });
                        return item;
                    });
                    after_except_data = _.filter(group, item => item.quantity > 0);
                }
                if (after_except_data.length || (after_except_data.length == 0 && group.length && order_promotion_line.length)) {
                    handle_data = [...after_except_data];
                } else {
                    handle_data = [...group];
                }
                handle_data = _.filter(group, item => item.quantity > 0);

                if (handle_data.length) {
                    if (handle_data[0].type === 'range') {
                        promotion_line = promotion_line.concat(self.compute_range_promotion(self, handle_data));
                    }
                }
            });
            return promotion_line;
        },
        exclude_not_repeatable: (promotion_line, ganeral_with_repeat_info) => {
            let get_need_remove_product = _.pluck(promotion_line, 'if_need_remove_product');
            get_need_remove_product = get_need_remove_product.join().split(',');
            let f = [...promotion_line];
            // let g = [...ganeral_with_repeat_info];
            console.log('promotion line f :', f);
            // console.log('ganeral_with_repeat_info g :', g);
            console.log('get_need_remove_product :', get_need_remove_product);
            let ganeral_except_without_repeat_info = _.map(ganeral_with_repeat_info, item => {
                _.each(get_need_remove_product, product_id => {
                    if (product_id == item.product_id) {
                        item.quantity--;
                    }
                });
                return item;
            });
            return ganeral_except_without_repeat_info;
        },
        check_order_discount: function () {
            // Common Declare Variables
            var self = this;
            let pricelists = self.pos.pricelists;
            let customer = this.get_client();
            self.remove_discount();

            let member_list = [];
            let rule_sum = [];

            // new multi pricelist logic
            let ganeral_with_repeat_info = [];
            let ganeral_without_repeat_info = [];
            let order_with_repeat_info = [];
            let order_without_repeat_info = [];
            let promotion_line = [];

            let order_info = [];

            // Per Line
            _.each(self.orderlines.models, function (line) {
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
                    // following priclist activity diagram :
                    // Rules are filter by non-order level &
                    // is this rule can repeat?
                    ganeral_without_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, false, 'line', ganeral_without_repeat_info);
                    ganeral_with_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, true, 'line', ganeral_with_repeat_info);
                    order_without_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, false, 'order', order_without_repeat_info);
                    order_with_repeat_info = self.get_promotion_model(self, line, product_mapping_all_rule, true, 'order', order_with_repeat_info);

                    member_list.push({
                        product_id: product.id,
                        product: product,
                        product_price: product.lst_price * line.quantity,
                        price: product.lst_price,
                        quantity: line.quantity,
                        sub_rate: 1,
                    });
                }
            });

            ganeral_without_repeat_info = _.chain(ganeral_without_repeat_info).sortBy(item => item.sequence).sortBy(item => item.pricelist_sequence).value();
            ganeral_with_repeat_info = _.chain(ganeral_with_repeat_info).sortBy(item => item.sequence).sortBy(item => item.pricelist_sequence).value();
            order_without_repeat_info = _.chain(order_without_repeat_info).sortBy(item => item.sequence).sortBy(item => item.pricelist_sequence).value();
            order_with_repeat_info = _.chain(order_with_repeat_info).sortBy(item => item.sequence).sortBy(item => item.pricelist_sequence).value();
            console.log('ganeral_without_repeat_info : ', ganeral_without_repeat_info);
            // End Per Line

            // Handle General Rule
            if (show_flow) {
                console.log('go ganeral without repeat');
                console.log('ganeral_without_repeat_info :', ganeral_without_repeat_info);
            }

            let unlink_gift_of_bogo_list = [];
            ({
                promotion_line,
                unlink_gift_of_bogo_list
            } = self.handle_ganeral_rule(self, ganeral_without_repeat_info, false, promotion_line, unlink_gift_of_bogo_list));
            _.map(promotion_line, line => {
                line.promotion_type = 'unmix'
            });


            // exclude not repeatable
            let ganeral_except_without_repeat_info = self.exclude_not_repeatable(promotion_line, ganeral_with_repeat_info);

            console.log('ganeral_except_without_repeat_info :', ganeral_except_without_repeat_info);
            ganeral_except_without_repeat_info = _.filter(ganeral_except_without_repeat_info, item => item.quantity > 0);

            if (show_flow) {
                console.log('go ganeral with repeat');
                console.log('ganeral_with_repeat_info :', ganeral_with_repeat_info);
                console.log('ganeral_except_without_repeat_info :', ganeral_except_without_repeat_info);
            }

            ({
                promotion_line,
                unlink_gift_of_bogo_list
            } = self.handle_ganeral_rule(self, ganeral_except_without_repeat_info, true, promotion_line, unlink_gift_of_bogo_list));
            promotion_line = self.compute_mix_promotion(self, promotion_line);
            // End Handle General Rule

            // Handle Order Rule
            if (show_flow) {
                console.log('go ganeral without repeat');
                console.log('order_without_repeat_info :', order_without_repeat_info);
            }
            // let promotion_order_line = _.filter(promotion_line, item => item.promotion_type == 'unmix');
            order_without_repeat_info = self.recompute_range_round_value(promotion_line, 'general', order_without_repeat_info);
            let group_product = _.groupBy(order_without_repeat_info, 'product_id');
            _.each(Object.keys(group_product), function (group_product_key) {
                _.each(group_product[group_product_key], function (product_itmes) {
                    let sum_promotion_value = self.compute_total_promotion_by_product(product_itmes.product_id, 'general', promotion_line, false);
                    _.extend(product_itmes, {
                        round_value: product_itmes.round_value + (sum_promotion_value ? sum_promotion_value : 0)
                    });
                })
            });
            promotion_line = self.handle_order_rule(self, order_without_repeat_info, false, promotion_line);
            console.log('order_without_repeat_info :', order_without_repeat_info);
            // get need want to remove product
            let promotion_order_line = _.filter(promotion_line, item => item.tpye === 'range');
            console.log('promotion_order_line :', promotion_order_line);
            let s_order_with_repeat_info = [...order_with_repeat_info];
            console.log('order_with_repeat_info : ', s_order_with_repeat_info);
            let order_except_without_repeat_info = self.exclude_not_repeatable(promotion_order_line, order_with_repeat_info);

            if (show_flow) {
                console.log('go order with repeat');
                console.log('order_with_repeat_info :', order_with_repeat_info);
                console.log('order_except_without_repeat_info :', order_except_without_repeat_info);
            }

            order_except_without_repeat_info = self.recompute_range_round_value(promotion_line, 'general', order_except_without_repeat_info);
            let group_product_repeat = _.groupBy(order_except_without_repeat_info, 'product_id');
            _.each(Object.keys(group_product_repeat), function (group_product_key) {
                _.each(group_product_repeat[group_product_key], function (product_itmes) {
                    let sum_promotion_value = self.compute_total_promotion_by_product(product_itmes.product_id, 'general', promotion_line, false);
                    console.log('sum_promotion_value :', sum_promotion_value);
                    _.extend(product_itmes, {
                        round_value: product_itmes.round_value + (sum_promotion_value ? sum_promotion_value : 0)
                    });
                })
            });
            promotion_line = self.handle_order_rule(self, order_except_without_repeat_info, true, promotion_line);
            // End Handle Order Rule

            // Handle Mix Promotion Display 
            let real_promotion_line = [];
            let get_mix_line = _.filter(promotion_line, line => line.discount < 0 && (line.promotion_type !== 'unmix'));
            let get_not_mix_line = _.filter(promotion_line, line => line.discount >= 0 || line.discount === undefined);
            let group_by_line_of_product = _.groupBy(get_mix_line, 'product_id');
            window.group_by_line_of_product = group_by_line_of_product;
            // console.log('group_by_line_of_product:', group_by_line_of_product);
            _.each(Object.keys(group_by_line_of_product), function (old_line) {
                let this_rule = _.first(group_by_line_of_product[old_line]).rule; // that have diff rule, in here just get fist rule
                let that_product = _.first(group_by_line_of_product[old_line]).product; // same product
                _.map(group_by_line_of_product[old_line], (item) => {
                    item.promotion_value = item.price * item.quantity
                });
                let get_line_promotion_value = _.pluck(group_by_line_of_product[old_line], 'promotion_value');
                let sum_line_promotion_value = _.reduce(get_line_promotion_value, (memo, num) => memo + num, 0);

                real_promotion_line.push({
                    discount: undefined,
                    line: undefined,
                    price: sum_line_promotion_value,
                    quantity: 1,
                    product: that_product,
                    product_id: that_product.id,
                    rule: this_rule,
                    rule_id: this_rule.id,
                    relation_products: [that_product.id],
                    rule_description: _t('Mix Promotion Repay'),
                });
            });
            real_promotion_line = get_not_mix_line.concat(real_promotion_line);
            console.log('real_promotion_line : ', real_promotion_line);
            // End Mix Promotion Display

            // Show all Promotion line
            console.log('promotion_line :', promotion_line);
            if (real_promotion_line.length) {
                let promotion_event = {
                    'compute_promotion_relation_product': self.compute_promotion_relation_product
                };
                self.add_promotion_products(self, real_promotion_line, promotion_event);
            }
            // End Show all Promotion line

            // Handle Member Promotion  
            // member_list = self.exclude_not_repeatable(promotion_line, member_list);
            member_list = self.exclude_member_not_repeatable(promotion_line, member_list);
            let group_member = _.groupBy(member_list, 'product_id');
            _.each(Object.keys(group_member), function (group_product_key) {
                _.each(group_member[group_product_key], function (member_itmes) {
                    // deduction promotion general rule
                    let sum_promotion_value = self.compute_total_promotion_by_product(member_itmes.product_id, 'general', promotion_line, false);
                    let sum_order_promotion_value = self.compute_total_promotion_by_product(member_itmes.product_id, 'order', promotion_line, false);
                    let total_sum = sum_promotion_value + sum_order_promotion_value;
                    // console.log(total_sum);
                    // deduction 
                    _.extend(member_itmes, {
                        sub_rate: (member_itmes.product_price + (total_sum ? total_sum : 0)) / member_itmes.product_price,
                        product_price: member_itmes.product_price + (total_sum ? total_sum : 0),
                    });
                })
            });

            self.compute_member_promotion(self, customer, member_list);
            // End Member Promotion

            // GO Back first orderline (display correct discount proudct name) 
            if (self.orderlines.models.length) {
                this.select_orderline(self.orderlines.models[0]);
            }
        },
        exclude_member_not_repeatable: (promotion_line, model) => {
            /**
             * @param {object} promotion_line array of pormotion line
             * @param {object} model array of order level product info 
             */
            let total_remove_product = [];
            _.map(model, info => {
                let that_promotion = [];
                that_promotion = _.filter(promotion_line, item => info.product_id == item.product_id && item.promotion_type != 'mix' && item.rule.is_primary_key == true);
                let get_need_remove_product = _.pluck(that_promotion, 'if_need_remove_product');
                get_need_remove_product = get_need_remove_product.join().split(',');
                total_remove_product = total_remove_product.concat(get_need_remove_product);
            });
            _.map(model, info => {
                _.map(total_remove_product, product_id => {
                    if (product_id == info.product_id)
                        info.quantity--;
                });
            });
            _.map(model, info => {
                info.product_price = info.price * (info.quantity > 0 ? info.quantity : 0);
            });
            return model;
        },
        recompute_range_round_value: (promotion_line, type, model) => {
            /**
             * @param {object} promotion_line array of pormotion line
             * @param {string} type type is "general" or "order" ?
             * @param {object} model array of order level product info 
             */
            let total_remove_product = [];
            _.map(model, info => {
                let that_promotion = [];
                if (type === 'general') {
                    that_promotion = _.filter(promotion_line, item => info.product_id == item.product_id && item.promotion_type != 'mix' && item.rule.is_primary_key == true);
                } else {
                    that_promotion = _.filter(promotion_line, item => item.type === 'range' && item.relation_products.includes(info.product_id) && item.promotion_type != 'mix' && item.rule.is_primary_key == true);
                }
                let get_need_remove_product = _.pluck(that_promotion, 'if_need_remove_product');
                get_need_remove_product = get_need_remove_product.join().split(',');
                total_remove_product = total_remove_product.concat(get_need_remove_product);
            });
            _.map(model, info => {
                _.map(total_remove_product, product_id => {
                    if (product_id == info.product_id)
                        info.quantity--;
                });
            });
            _.map(model, info => {

                info.round_value = info.price * (info.quantity > 0 ? info.quantity : 0);
            });
            return model;
        },
        compute_total_promotion_by_product: (product_id, type, promotion_line, pk = true) => {
            /**
             * @param {object} product_id id of prodcut 
             * @param {string} type type is "general" or "order" ?
             * @param {object} promotion_line array of pormotion line
             * @param {boolean} pk primary key 
             */
            let that_promotion = [];
            if (type === 'general') {
                that_promotion = _.filter(promotion_line, item => product_id == item.product_id && item.rule.is_primary_key == pk);
            } else {
                that_promotion = _.filter(promotion_line, item => item.type === 'range' && item.relation_products.includes(product_id) && item.rule.is_primary_key == pk);
            }

            _.map(that_promotion, (item) => {
                item.promotion_value = item.price * item.quantity
            });
            let get_this_promotion_value = _.pluck(that_promotion, 'promotion_value');
            return _.reduce(get_this_promotion_value, (memo, num) => memo + num, 0);
        },
        compute_promotion_relation_product: (self, relation_products) => {
            self.selected_orderline.set_relation_product(relation_products.join());
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
    });
})