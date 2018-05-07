/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.order', function (require) {

    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var _t = core._t;
    var qweb = core.qweb;
    var screens = require('point_of_sale.screens');

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            var self = this;
            _super_Order.initialize.apply(this, arguments);
            this.orderlines.bind('change add remove', function (line) {
                self.pos.trigger('update:count_item')
            });
            if (!this.plus_point) {
                this.plus_point = 0;
            }
            if (!this.redeem_point) {
                this.redeem_point = 0;
            }
            if (!this.note) {
                this.note = '';
            }
            if (!this.signature) {
                this.signature = '';
            }
            this.orderlines.bind('change add remove', function (line) {
                self.trigger('update:table-list');
            });
            if (this.pos.version.server_serie == '10.0' && this.pos.default_pricelist) { // default price list for version 10
                if (!this.pricelist) {
                    this.pricelist = this.pos.default_pricelist;
                    this.set_pricelist_to_order(this.pricelist);
                }
            }
            if (!this.lock) {
                this.lock = false;
            }
        },
        init_from_JSON: function (json) {
            var res = _super_Order.init_from_JSON.apply(this, arguments);
            if (json.expire_date) {
                this.expire_date = json.expire_date;
            }
            if (json.is_return) {
                this.is_return = json.is_return;
                this.return_order_ean13 = json.return_order_ean13;
            }
            if (json.ean13) {
                this.ean13 = json.ean13;
            }
            if (json.plus_point) {
                this.plus_point = json.plus_point;
            }
            if (json.redeem_point) {
                this.redeem_point = json.redeem_point;
            }
            if (json.signature) {
                this.signature = json.signature
            }
            if (json.note) {
                this.note = json.note
            }
            if (this.pos.version.server_serie == '10.0' && this.pos.default_pricelist) { // init price list for version 10
                if (json.pricelist_id) {
                    this.pricelist = _.find(this.pos.pricelists, function (pricelist) {
                        return pricelist.id === json.pricelist_id;
                    });
                    if (this.pricelist) {
                        this.set_pricelist_to_order(this.pricelist);
                    } else {
                        this.pricelist = this.pos.default_pricelist;
                        this.set_pricelist_to_order(this.pos.default_pricelist);
                    }
                } else {
                    this.pricelist = this.pos.default_pricelist;
                    this.set_pricelist_to_order(this.pricelist);
                }
            }
            if (json.lock) {
                this.lock = json.lock;
            } else {
                this.lock = false;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            if (this.voucher_id) {
                json.voucher_id = parseInt(this.voucher_id);
            }
            if (this.promotion_amount) {
                json.promotion_amount = this.promotion_amount;
            }
            if (this.note) {
                json.note = this.note;
            }
            if (this.signature) {
                json.signature = this.signature;
            }
            if (this.ean13) {
                json.ean13 = this.ean13;
            }
            if (this.expire_date) {
                json.expire_date = this.expire_date;
            }
            if (this.is_return) {
                json.is_return = this.is_return;
                json.return_order_ean13 = this.return_order_ean13;
            }
            var today = new Date();
            var expire_date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + this.pos.config.period_return_days, today.getHours());
            if (!this.expire_date) {
                this.expire_date = expire_date;
            }
            // init ean13 and automatic create ean13 for order
            if (!this.ean13 && this.uid) {
                var ean13 = '998';
                if (this.pos.user.id) {
                    ean13 += this.pos.user.id;
                }
                if (this.sequence_number) {
                    ean13 += this.sequence_number;
                }
                if (this.pos.config.id) {
                    ean13 += this.pos.config.id;
                }
                var format_ean13 = this.uid.split('-');
                for (var i in format_ean13) {
                    ean13 += format_ean13[i];
                }
                ean13 = ean13.split("");
                var ean13_array = []
                var ean13_str = ""
                for (var i = 0; i < ean13.length; i++) {
                    if (i < 12) {
                        ean13_str += ean13[i]
                        ean13_array.push(ean13[i])
                    }
                }
                this.ean13 = ean13_str + this.generate_unique_ean13(ean13_array).toString()
            }
            if (this.plus_point) {
                json.plus_point = this.plus_point;
            }
            if (this.redeem_point) {
                json.redeem_point = this.redeem_point;
            }
            // export price list for version 10
            if (this.pos.version.server_serie == '10.0' && this.pricelist) {
                json.pricelist_id = this.pricelist.id;
            }
            if (this.lock) {
                json.lock = this.lock;
            } else {
                json.lock = false;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt = _super_Order.export_for_printing.call(this);
            receipt.plus_point = this.plus_point || 0;
            receipt.redeem_point = this.redeem_point || 0;
            receipt['note'] = this.note;
            receipt['signature'] = this.signature;
            if (this.promotion_amount) {
                receipt.promotion_amount = this.promotion_amount;
            }
            return receipt
        },
        set_signature: function (signature) {
            this.signature = signature;
            this.trigger('change', this);
        },
        get_signature: function () {
            if (this.signature) {
                return 'data:image/png;base64, ' + this.signature
            } else {
                return null
            }
        },
        set_note: function (note) {
            this.note = note;
            this.trigger('change', this);
        },
        get_note: function (note) {
            return this.note;
        },
        active_button_add_wallet: function (active) {
            var $add_wallet = $('.add_wallet');
            if (!$add_wallet) {
                return;
            }
            if (active) {
                $add_wallet.removeClass('oe_hidden');
                $add_wallet.addClass('highlight')
            } else {
                $add_wallet.addClass('oe_hidden');
            }
        },
        get_change: function (paymentline) {
            var change = _super_Order.get_change.apply(this, arguments);
            // display wallet method when have change
            var client = this.get_client();
            var wallet_register = _.find(this.pos.cashregisters, function (register_journal) {
                return register_journal.journal['pos_method_type'] == 'wallet';
            });
            if (wallet_register) {
                var $journal_element = $("[data-id='" + wallet_register.journal['id'] + "']");
                if (change > 0 || (client && client['wallet'] > 0)) {
                    $journal_element.removeClass('oe_hidden');
                    $journal_element.addClass('highlight');
                } else {
                    $journal_element.addClass('oe_hidden');
                }
            }
            // return amount with difference currency
            var company_currency = this.pos.company.currency_id;
            if (paymentline && paymentline.cashregister && paymentline.cashregister.currency_id && paymentline.cashregister.currency_id[0] != company_currency[0]) {
                var new_change = -this.get_total_with_tax();
                var lines = this.paymentlines.models;
                var company_currency = this.pos.company.currency_id;
                var company_currency_data = this.pos.currency_by_id[company_currency[0]];
                for (var i = 0; i < lines.length; i++) {
                    var selected_currency = this.pos.currency_by_id[lines[i].cashregister.currency_id[0]];
                    var selected_rate = selected_currency['rate'];
                    var amount_of_line = lines[i].get_amount();
                    new_change += amount_of_line * selected_rate / company_currency_data['rate'];
                    if (lines[i] === paymentline) {
                        break;
                    }
                }
                var currency_change = round_pr(Math.max(0, new_change), this.pos.currency.rounding);
                if (currency_change > 0) {
                    this.active_button_add_wallet(true);
                } else {
                    this.active_button_add_wallet(false);
                }
                return currency_change
            }
            if (change > 0) {
                this.active_button_add_wallet(true);
            } else {
                this.active_button_add_wallet(false);
            }
            return change;
        },
        get_due: function (paymentline) {
            var due = _super_Order.get_due.apply(this, arguments);
            if (!paymentline) {
                return due;
            }
            var active_multi_currency = false;
            var lines = this.paymentlines.models;
            var company_currency = this.pos.company.currency_id;
            var company_currency_data = this.pos.currency_by_id[company_currency[0]];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var currency_id_of_line = line.cashregister.currency_id[0];
                var currency_of_line = this.pos.currency_by_id[currency_id_of_line];
                if (currency_of_line['id'] != company_currency_data['id']) {
                    active_multi_currency = true;
                }
            }
            var paymentline_currency_id = paymentline.cashregister.currency_id[0]
            var paymentline_currency = this.pos.currency_by_id[paymentline_currency_id];
            var payment_rate = paymentline_currency['rate'];
            if (paymentline_currency['id'] != company_currency_data['id']) {
                active_multi_currency = true
            }
            if (!active_multi_currency || active_multi_currency == false) {
                return due;
            } else {
                var total_amount_with_tax = this.get_total_with_tax();
                if (!payment_rate || payment_rate == 0) {
                    return due
                }
                var new_due = total_amount_with_tax * payment_rate / company_currency_data['rate'];
                var lines = this.paymentlines.models;
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i] === paymentline) {
                        break;
                    } else {
                        var line = lines[i];
                        var line_cashregister = line['cashregister'];
                        var line_currency_rate = this.pos.currency_by_id[line_cashregister['currency_id'][0]]['rate'];
                        var line_amount = lines[i].get_amount() * line_currency_rate;
                        new_due -= line_amount * payment_rate / company_currency_data['rate'];

                    }
                }
                var new_due = round_pr(Math.max(0, new_due), this.pos.currency.rounding);
                return new_due
            }

        },
        get_total_paid: function () {
            var total_paid = _super_Order.get_total_paid.apply(this, arguments);
            var lines = this.paymentlines.models;
            var active_multi_currency = false;
            var total_paid_multi_currency = 0;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var currency = line.cashregister.currency_id;
                var company_currency = this.pos.company.currency_id;
                var company_currency_data = this.pos.currency_by_id[company_currency[0]];
                if (currency[0] != company_currency[0]) {
                    var register_currency = this.pos.currency_by_id[currency[0]];
                    var register_rate = register_currency['rate'];
                    active_multi_currency = true;
                    total_paid_multi_currency += line.get_amount() * register_rate / company_currency_data['rate'];
                } else {
                    total_paid_multi_currency += line.get_amount()
                }
            }
            if (active_multi_currency == true) {
                return round_pr(Math.max(0, total_paid_multi_currency), this.pos.currency.rounding);
            } else {
                return total_paid;
            }
        },
        generate_unique_ean13: function (array_code) {
            if (array_code.length != 12) {
                return -1
            }
            var oddsum = evensum = total = 0
            for (var i = 0; i < array_code.length; i++) {
                if ((i % 2) == 0) {
                    evensum += parseInt(array_code[i])
                } else {
                    oddsum += parseInt(array_code[i])
                }
            }
            var total = oddsum * 3 + evensum
            return parseInt((10 - total % 10) % 10)
        },
        add_product: function (product, options) {
            var res = _super_Order.add_product.apply(this, arguments);
            var selected_orderline = this.selected_orderline;
            var combo_items = [];
            for (var i = 0; i < this.pos.combo_items.length; i++) {
                var combo_item = this.pos.combo_items[i];
                if (combo_item.product_combo_id[0] == selected_orderline.product.product_tmpl_id && combo_item.default == true) {
                    combo_items.push(combo_item);
                }
            }
            if (selected_orderline) {
                selected_orderline['combo_items'] = combo_items;
                selected_orderline.trigger('change', selected_orderline);
            }
            if (product['qty_available'] <= 0 && this.pos.config.sync_stock && this.pos.config['allow_order_out_of_stock'] == false && product['type'] != 'service') {
                return this.gui.show_popup('notify_popup', {
                    title: product['display_name'],
                    from: 'top',
                    align: 'center',
                    body: 'have out of stock, please made internal transfer or purchase order',
                    color: 'warning',
                    timer: 1000
                });
            }
            var product_tmpl_id = product['product_tmpl_id'];
            if (product_tmpl_id && product_tmpl_id.length == undefined) {
                var cross_items = _.filter(this.pos.cross_items, function (cross_item) {
                    return cross_item['product_tmpl_id'][0] == product_tmpl_id;
                });
                if (cross_items.length) {
                    this.pos.gui.show_popup('popup_cross_selling', {
                        widget: this,
                        cross_items: cross_items
                    });
                }
            }
            return res
        },
        validation_order_can_do_internal_transfer: function () {
            var can_do = true;
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var product = this.orderlines.models[i].product;
                if (product['type'] == 'service' || product['uom_po_id'] == undefined) {
                    can_do = false;
                }
            }
            if (this.orderlines.models.length == 0) {
                can_do = false;
            }
            return can_do;
        },
        reset_plus_point: function () {
            if (this) {
                var lines = this.orderlines.models;
                if (lines.length > 0) {
                    for (var i = 0; i < lines.length; i++) {
                        lines[i].plus_point = 0;
                    }
                }
            }
        },
        reset_redeem_point: function () {
            if (this) {
                var lines = this.orderlines.models;
                if (lines.length > 0) {
                    for (var i = 0; i < lines.length; i++) {
                        lines[i].redeem_point = 0;
                    }
                }
            }
        },
        give_plus_point: function () {
            var plus_point = 0;
            var lines = this.orderlines.models;
            if (lines.length == 0 || !lines) {
                console.log('lines null');
                return plus_point;
            }
            var amount_total_included_tax = this.get_total_with_tax();
            var loyalty_ids = this.pos.loyalty_ids;
            var rules = [];
            this.reset_plus_point();
            if (loyalty_ids.length > 0) {
                for (var i = 0; i < loyalty_ids.length; i++) {
                    var rules_by_loylaty_id = this.pos.rules_by_loyalty_id[loyalty_ids[i]]
                    for (var j = 0; j < rules_by_loylaty_id.length; j++) {
                        rules.push(rules_by_loylaty_id[j]);
                    }
                }
            } else {
                console.log('loyalty_ids null');
                return plus_point;
            }
            if (rules.length) {
                for (var i = 0; i < rules.length; i++) {
                    var rule = rules[i];
                    for (var j = 0; j < lines.length; j++) {
                        var line = lines[j];
                        if ((!line.redeem_point || line.redeem_point == 0) && line['quantity'] > 0) {
                            var plus = round_pr(line['price'] * line['quantity'] * rule['coefficient'], rule['rounding'])
                            if (rule['type'] == 'products' && rule['product_ids'].indexOf(line.product['id']) != -1) {
                                line.plus_point += plus;
                                plus_point += plus;
                            } else if (rule['type'] == 'categories' && rule['category_ids'].indexOf(line.product.pos_categ_id[0]) != -1) {
                                line.plus_point += plus;
                                plus_point += plus;
                            }
                            else if (rule['type'] == 'order_amount') {
                                // what we're doing now ?
                                var order_amount_by_rule_id = this.pos.order_amount_by_rule_id[rule['id']];
                                if (order_amount_by_rule_id.length > 0) {
                                    var amount_temp = 0;
                                    var order_amount_rule_apply = null;
                                    for (var z = 0; z < order_amount_by_rule_id.length; z++) {
                                        var current_order_rule = order_amount_by_rule_id[z];
                                        if (current_order_rule['amount_from'] >= amount_temp && amount_total_included_tax >= current_order_rule['amount_from']) {
                                            amount_temp = current_order_rule['amount_from'];
                                            order_amount_rule_apply = current_order_rule;
                                        }
                                    }
                                    if (order_amount_rule_apply) {
                                        var point_plus = round_pr(order_amount_rule_apply['point'] / lines.length, rule['rounding'])
                                        line.plus_point += point_plus;
                                        plus_point += point_plus;
                                    }
                                }
                            }
                        } else if (line['quantity'] <= 0) {
                            line.plus_point = 0;
                        }
                    }
                }
            } else {
                console.log('rules null');
                return plus_point;
            }
            return plus_point;
        },
        get_redeem_point: function () {
            var redeem_point = 0;
            var lines = this.orderlines.models;
            if (lines.length == 0 || !lines) {
                console.log('lines null');
                return redeem_point;
            }
            var redeem_point = 0;
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].redeem_point > 0) {
                    redeem_point += lines[i].redeem_point;
                }
            }
            return redeem_point;
        },
        get_total_without_promotion_and_tax: function () {
            var rounding = this.pos.currency.rounding;
            var orderlines = this.orderlines.models
            var sum = 0
            var i = 0
            while (i < orderlines.length) {
                var line = orderlines[i];
                if (line.promotion && line.promotion == true) {
                    i++;
                    continue
                }
                sum += round_pr(line.get_unit_price() * line.get_quantity() * (1 - line.get_discount() / 100), rounding)
                i++
            }
            return sum;
        },
        remove_promotions_applied: function () {
            var self = this;
            var lines = this.orderlines.models;
            if (lines.length) {
                var x = 0;
                while (x < lines.length) {
                    if (lines[x].promotion == true) {
                        this.remove_orderline(lines[x]);
                    }
                    x++;
                }
            }
        },
        compute_promotion: function () {
            var self = this;
            var promotions = this.pos.promotions
            if (promotions) {
                for (var i = 0; i < promotions.length; i++) {
                    var type = promotions[i].type
                    var order = this;
                    if (order.orderlines.length) {
                        // discount filter by total of current order
                        if (type == '1_discount_total_order') {
                            order.compute_discount_total_order(promotions[i]);
                        }
                        // discount by category
                        if (type == '2_discount_category') {
                            order.compute_discount_category(promotions[i]);
                        }
                        // discount by quantity of product
                        if (type == '3_discount_by_quantity_of_product') {
                            order.compute_discount_by_quantity_of_products(promotions[i]);
                        }
                        // discount by pack
                        if (type == '4_pack_discount') {
                            order.compute_pack_discount(promotions[i]);
                        }
                        // free items filter by pack
                        if (type == '5_pack_free_gift') {
                            order.compute_pack_free_gift(promotions[i]);
                        }
                        // re-build price filter by quantity of product
                        if (type == '6_price_filter_quantity') {
                            order.compute_price_filter_quantity(promotions[i]);
                        }
                    }
                }
                var applied_promotion = false;
                for (var i = 0; i < this.orderlines.models.length; i++) {
                    if (this.orderlines.models[i]['promotion'] == true) {
                        applied_promotion = true;
                        break;
                    }
                }
                if (applied_promotion == true) {
                    return this.pos.gui.show_popup('alert_result', {
                        title: 'Applied',
                        body: 'Promotions applied, please on order lines',
                    });
                } else {
                    return this.pos.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Have not any promotion applied',
                    });
                }
            }
        },
        product_quantity_by_product_id: function () {
            var lines_list = {};
            var lines = this.orderlines.models;
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion) {
                    i++;
                    continue
                }
                if (!lines_list[line.product.id]) {
                    lines_list[line.product.id] = line.quantity;
                } else {
                    lines_list[line.product.id] += line.quantity;
                }
                i++;
            }
            return lines_list
        },
        // 1
        // check current order can apply discount by total order
        checking_apply_total_order: function (promotion) {
            var discount_lines = this.pos.promotion_discount_order_by_promotion_id[promotion.id];
            var total_order = this.get_total_without_promotion_and_tax();
            var discount_line_tmp = null;
            var discount_tmp = 0;
            if (discount_lines) {
                var i = 0;
                while (i < discount_lines.length) {
                    var discount_line = discount_lines[i];
                    if (total_order >= discount_line.minimum_amount && total_order >= discount_tmp) {
                        discount_line_tmp = discount_line;
                        discount_tmp = discount_line.minimum_amount
                    }
                    i++;
                }
            }
            return discount_line_tmp;
        },
        // 2
        // check current order can apply discount by categories
        checking_can_discount_by_categories: function (promotion) {
            var can_apply = false
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            if (!product || !this.pos.promotion_by_category_id) {
                return false;
            }
            for (i in this.pos.promotion_by_category_id) {
                var promotion_line = this.pos.promotion_by_category_id[i];
                var amount_total_by_category = 0;
                var z = 0;
                var lines = this.orderlines.models;
                while (z < lines.length) {
                    if (!lines[z].product.pos_categ_id) {
                        z++;
                        continue;
                    }
                    if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                        amount_total_by_category += lines[z].get_price_without_tax();
                    }
                    z++;
                }
                if (amount_total_by_category > 0) {
                    can_apply = true
                }
            }
            return can_apply
        },
        // 3
        // check condition for apply discount by quantity product
        checking_apply_discount_filter_by_quantity_of_product: function (promotion) {
            var can_apply = false;
            var rules = this.pos.promotion_quantity_by_product_id;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (product_id in product_quantity_by_product_id) {
                var rules_by_product_id = rules[product_id];
                if (rules_by_product_id) {
                    for (var i = 0; i < rules_by_product_id.length; i++) {
                        var rule = rules_by_product_id[i];
                        if (rule && product_quantity_by_product_id[product_id] >= rule.quantity) {
                            can_apply = true;
                        }
                    }
                }
            }
            return can_apply;
        },
        // 4 & 5
        // check pack free gift and pack discount product
        checking_pack_discount_and_pack_free_gift: function (rules) {
            var can_apply = true;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (i = 0; i < rules.length; i++) {
                var rule = rules[i];
                var product_id = parseInt(rule.product_id[0]);
                var minimum_quantity = rule.minimum_quantity;
                if (!product_quantity_by_product_id[product_id] || product_quantity_by_product_id[product_id] < minimum_quantity) {
                    can_apply = false;
                }
            }
            return can_apply
        },
        // 6
        // check condition for apply price filter by quantity of product
        checking_apply_price_filter_by_quantity_of_product: function (promotion) {
            var condition = false;
            var rules = this.pos.promotion_price_by_promotion_id[promotion.id];
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (rule && product_quantity_by_product_id[rule.product_id[0]] && product_quantity_by_product_id[rule.product_id[0]] >= rule.minimum_quantity) {
                    condition = true;
                }
            }
            return condition;
        },

        // 1. compute discount filter by total order
        compute_discount_total_order: function (promotion) {
            var discount_line_tmp = this.checking_apply_total_order(promotion)
            var lines = this.orderlines.models; // remove old lines applied promotion by total order
            if (lines.length) {
                for (var j = 0; j < lines.length; j++) {
                    if (lines[j].promotion_discount_total_order) {
                        this.remove_orderline(lines[j]);
                    }
                }
            }
            if (discount_line_tmp == null) {
                return;
            }
            var total_order = this.get_total_without_promotion_and_tax();
            if (discount_line_tmp && total_order > 0) {
                var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
                var price = -total_order / 100 * discount_line_tmp.discount
                if (product && price != 0) {
                    var options = {};
                    options.promotion_discount_total_order = true;
                    options.promotion = true;
                    options.promotion_reason = 'discount ' + discount_line_tmp.discount + ' % ' + ' because total order greater or equal ' + discount_line_tmp.minimum_amount;
                    this.add_promotion(product, price, 1, options)
                }
            }
        },
        // 2. compute discount filter by product categories
        compute_discount_category: function (promotion) {
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            if (!product || !this.pos.promotion_by_category_id) {
                return;
            }
            var can_apply = this.checking_can_discount_by_categories(promotion);
            if (can_apply == false) {
                return;
            }
            var lines = this.orderlines.models;
            if (lines.length) { // remove all lines applied discount filter by category before
                var x = 0;
                while (x < lines.length) {
                    if (lines[x].promotion_discount_category) {
                        this.remove_orderline(lines[x]);
                    }
                    x++;
                }
            }
            for (i in this.pos.promotion_by_category_id) {
                var promotion_line = this.pos.promotion_by_category_id[i];
                var amount_total_by_category = 0;
                var z = 0;
                while (z < lines.length) {
                    if (!lines[z].product.pos_categ_id) {
                        z++;
                        continue;
                    }
                    if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                        amount_total_by_category += lines[z].get_price_without_tax();
                    }
                    z++;
                }
                if (amount_total_by_category > 0) {
                    var price = -amount_total_by_category / 100 * promotion_line.discount
                    var options = {};
                    options.promotion_discount_category = true;
                    options.promotion = true;
                    options.promotion_reason = ' discount ' + promotion_line.discount + ' % from ' + promotion_line.category_id[1];
                    this.add_promotion(product, price, 1, options)
                }
            }
        },
        // 3. compute discount filter by quantity of product
        compute_discount_by_quantity_of_products: function (promotion) {
            var check = this.checking_apply_discount_filter_by_quantity_of_product(promotion)
            if (check == false) {
                return;
            }
            var quantity_by_product_id = {}
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var i = 0;
            var lines = this.orderlines.models;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true) {
                    line.set_quantity('remove');
                    line.order.trigger('change', line.order);
                    i++;
                    continue
                }
                if (line.promotion) {
                    i++;
                    continue
                }
                if (!quantity_by_product_id[line.product.id]) {
                    quantity_by_product_id[line.product.id] = line.quantity;
                } else {
                    quantity_by_product_id[line.product.id] += line.quantity;
                }
                i++;
            }
            for (i in quantity_by_product_id) {
                var product_id = i;
                var promotion_lines = this.pos.promotion_quantity_by_product_id[product_id];
                if (!promotion_lines) {
                    continue;
                }
                var quantity_tmp = 0;
                var promotion_line = null;
                var j = 0
                for (j in promotion_lines) {
                    if (quantity_tmp <= promotion_lines[j].quantity && quantity_by_product_id[i] >= promotion_lines[j].quantity) {
                        promotion_line = promotion_lines[j];
                        quantity_tmp = promotion_lines[j].quantity
                    }
                }
                var lines = this.orderlines.models;
                var amount_total_by_product = 0;
                if (lines.length) {
                    var x = 0;
                    while (x < lines.length) {
                        if (lines[x].promotion) {
                            x++;
                            continue
                        }
                        if (lines[x].promotion_discount_by_quantity) {
                            this.remove_orderline(lines[x]);
                        }
                        if (lines[x].product.id == product_id && lines[x].promotion != true) {
                            amount_total_by_product += lines[x].get_price_without_tax()
                        }
                        x++;
                    }
                }
                if (amount_total_by_product > 0 && promotion_line) {
                    var price = -amount_total_by_product / 100 * promotion_line.discount
                    var options = {};
                    options.promotion_discount_by_quantity = true;
                    options.promotion = true;
                    options.promotion_reason = ' discount ' + promotion_line.discount + ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity;
                    this.add_promotion(product, price, 1, options)
                }
            }
        },

        // 4. compute discount product filter by pack items
        compute_pack_discount: function (promotion) {
            var promotion_condition_items = this.pos.promotion_discount_condition_by_promotion_id[promotion.id];
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var check = this.checking_pack_discount_and_pack_free_gift(promotion_condition_items);
            var lines = this.orderlines.models;
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion_discount && line.promotion_discount == true) {
                    line.set_quantity('remove');
                    line.order.trigger('change', line.order);
                }
                i++;
            }
            if (check == true) {
                var discount_items = this.pos.promotion_discount_apply_by_promotion_id[promotion.id]
                if (!discount_items) {
                    return;
                }
                var i = 0;
                while (i < discount_items.length) {
                    var discount_item = discount_items[i];
                    var discount = 0;
                    var lines = this.orderlines.models;
                    for (x = 0; x < lines.length; x++) {
                        if (lines[x].promotion) {
                            continue;
                        }
                        if (lines[x].product.id == discount_item.product_id[0]) {
                            discount += lines[x].get_price_without_tax()
                        }
                    }
                    if (product && discount > 0) {
                        var price = -discount / 100 * discount_item.discount
                        var options = {};
                        options.promotion_discount = true;
                        options.promotion = true;
                        options.promotion_reason = 'discount ' + discount_item.product_id[1] + ' ' + discount_item.discount + ' % of Pack name: ' + promotion.name;
                        this.add_promotion(product, price, 1, options)
                    }
                    i++;
                }
            }
        },
        // get total quantity by product on order lines
        count_quantity_by_product: function (product) {
            var qty = 0;
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                if (line.product['id'] == product['id']) {
                    qty += line['quantity'];
                }
            }
            return qty;
        },

        // 5. compute gift products filter by pack items
        compute_pack_free_gift: function (promotion) {
            var promotion_condition_items = this.pos.promotion_gift_condition_by_promotion_id[promotion.id];
            var check = this.checking_pack_discount_and_pack_free_gift(promotion_condition_items);
            var lines = this.orderlines.models;
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion_gift == true) {
                    line.set_quantity('remove');
                    line.order.trigger('change', line.order);
                }
                i++;
            }
            if (check == true) {
                var gifts = this.pos.promotion_gift_free_by_promotion_id[promotion.id]
                if (!gifts) {
                    return;
                }
                var products_condition = {};
                for (var i = 0; i < promotion_condition_items.length; i++) {
                    var condition = promotion_condition_items[i];
                    var product = this.pos.db.get_product_by_id(condition.product_id[0]);
                    products_condition[product['id']] = this.count_quantity_by_product(product)
                }
                var can_continue = true;
                var temp = 1;
                for (var i = 1; i < 100; i++) {
                    for (var j = 0; j < promotion_condition_items.length; j++) {
                        var condition = promotion_condition_items[j];
                        var condition_qty = condition.minimum_quantity;
                        var product = this.pos.db.get_product_by_id(condition.product_id[0]);
                        var total_qty = this.count_quantity_by_product(product);
                        if (i * condition_qty <= total_qty) {
                            can_continue = true;
                        } else {
                            can_continue = false
                        }
                    }
                    if (can_continue == true) {
                        temp = i;
                    } else {
                        break;
                    }
                }
                var i = 0;
                while (i < gifts.length) {
                    var product = this.pos.db.get_product_by_id(gifts[i].product_id[0]);
                    if (product) {
                        var quantity = gifts[i].quantity_free * temp;
                        var options = {};
                        options.promotion_gift = true;
                        options.promotion = true;
                        options.promotion_reason = 'Free ' + quantity + ' ' + product['display_name'] + ' because [' + promotion.name + '] active';
                        this.add_promotion(product, 0, quantity, options)
                    }
                    i++;
                }
            }
        },
        // 6. compute and reset price of line filter by rule: price filter by quantity of product
        compute_price_filter_quantity: function (promotion) {
            var promotion_prices = this.pos.promotion_price_by_promotion_id[promotion.id]
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var i = 0;
            var lines = this.orderlines.models;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true) {
                    line.set_quantity('remove');
                    line.order.trigger('change', line.order);
                }
                i++;
            }
            if (promotion_prices) {
                var prices_item_by_product_id = {};
                for (var i = 0; i < promotion_prices.length; i++) {
                    var item = promotion_prices[i];
                    if (!prices_item_by_product_id[item.product_id[0]]) {
                        prices_item_by_product_id[item.product_id[0]] = [item]
                    } else {
                        prices_item_by_product_id[item.product_id[0]].push(item)
                    }
                }
                var quantity_by_product_id = this.product_quantity_by_product_id()
                var discount = 0;
                for (i in quantity_by_product_id) {
                    if (prices_item_by_product_id[i]) {
                        var quantity_tmp = 0
                        var price_item_tmp = null
                        // root: quantity line, we'll compare this with 2 variable quantity line greater minimum quantity of item and greater quantity temp
                        for (var j = 0; j < prices_item_by_product_id[i].length; j++) {
                            var price_item = prices_item_by_product_id[i][j];
                            if (quantity_by_product_id[i] >= price_item.minimum_quantity && quantity_by_product_id[i] >= quantity_tmp) {
                                quantity_tmp = price_item.minimum_quantity;
                                price_item_tmp = price_item;
                            }
                        }
                        if (price_item_tmp) {
                            var discount = 0;
                            var z = 0;
                            while (z < lines.length) {
                                var line = lines[z];
                                if (line.product.id == price_item_tmp.product_id[0]) {
                                    discount += line.get_price_without_tax() - (line.quantity * price_item_tmp.list_price)
                                }
                                z++;
                            }
                            if (discount > 0) {
                                var price = -discount;
                                var options = {};
                                options.promotion_price_by_quantity = true;
                                options.promotion = true;
                                options.promotion_reason = ' By greater or equal ' + price_item_tmp.minimum_quantity + ' ' + price_item_tmp.product_id[1] + ' applied price ' + price_item_tmp.list_price
                                this.add_promotion(product, price, 1, options)
                            }
                        }
                    }
                }
            }
        },
        // add promotion to current order
        add_promotion: function (product, price, quantity, options) {
            var line = new models.Orderline({}, {pos: this.pos, order: this, product: product});
            if (options.promotion) {
                line.promotion = options.promotion;
            }
            if (options.promotion_reason) {
                line.promotion_reason = options.promotion_reason;
            }
            if (options.promotion_discount_total_order) {
                line.promotion_discount_total_order = options.promotion_discount_total_order;
            }
            if (options.promotion_discount_category) {
                line.promotion_discount_category = options.promotion_discount_category;
            }
            if (options.promotion_discount_by_quantity) {
                line.promotion_discount_by_quantity = options.promotion_discount_by_quantity;
            }
            if (options.promotion_discount) {
                line.promotion_discount = options.promotion_discount;
            }
            if (options.promotion_gift) {
                line.promotion_gift = options.promotion_gift;
            }
            if (options.promotion_price_by_quantity) {
                line.promotion_price_by_quantity = options.promotion_price_by_quantity;
            }
            line.set_quantity(quantity);
            line.set_unit_price(price);
            this.orderlines.add(line);
            this.trigger('change', this);
        },
        current_order_can_apply_promotion: function () {
            var can_apply = null;
            var promotions_apply = []
            for (var i = 0; i < this.pos.promotions.length; i++) {
                var promotion = this.pos.promotions[i];
                if (promotion['type'] == '1_discount_total_order' && this.checking_apply_total_order(promotion)) {
                    can_apply = true;
                    promotions_apply.push(promotion);
                }
                else if (promotion['type'] == '2_discount_category' && this.checking_can_discount_by_categories(promotion)) {
                    can_apply = true;
                    promotions_apply.push(promotion);
                }
                else if (promotion['type'] == '3_discount_by_quantity_of_product' && this.checking_apply_discount_filter_by_quantity_of_product(promotion)) {
                    can_apply = true;
                    promotions_apply.push(promotion);
                }
                else if (promotion['type'] == '4_pack_discount') {
                    var promotion_condition_items = this.pos.promotion_discount_condition_by_promotion_id[promotion.id];
                    var check = this.checking_pack_discount_and_pack_free_gift(promotion_condition_items);
                    if (check) {
                        can_apply = true;
                        promotions_apply.push(promotion);
                    }
                }
                else if (promotion['type'] == '5_pack_free_gift') {
                    var promotion_condition_items = this.pos.promotion_gift_condition_by_promotion_id[promotion.id];
                    var check = this.checking_pack_discount_and_pack_free_gift(promotion_condition_items);
                    if (check) {
                        can_apply = true;
                        promotions_apply.push(promotion);
                    }
                }
                else if (promotion['type'] == '6_price_filter_quantity' && this.checking_apply_price_filter_by_quantity_of_product(promotion)) {
                    can_apply = true;
                    promotions_apply.push(promotion);
                }
            }
            return {
                can_apply: can_apply,
                promotions_apply: promotions_apply
            };
        },
        // set prices list to order
        // this method only use for version 10
        set_pricelist_to_order: function (pricelist) {
            var self = this;
            if (!pricelist) {
                return;
            }
            this.pricelist = pricelist;
            // change price of current order lines
            _.each(this.get_orderlines(), function (line) {
                var price = self.pos.db.compute_price(line['product'], pricelist, line.quantity);
                line['product']['price'] = price;
                line.set_unit_price(price);
            });
            // after update order lines price
            // will update screen product and with new price
            this.update_product_price(pricelist);
            this.trigger('change', this);
        },
        update_product_price: function (pricelist) {
            var self = this;
            var products = this.pos.products;
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                var price = this.pos.db.compute_price(product, pricelist, 1);
                product['price'] = price;
            }
            self.pos.trigger('product:change_price_list', products)
        }
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attributes, options) {
            var res = _super_Orderline.initialize.apply(this, arguments);
            this.combo_items = this.combo_items || [];
            if (!this.plus_point) {
                this.plus_point = 0;
            }
            if (!this.redeem_point) {
                this.redeem_point = 0;
            }
            if (!this.variants) {
                this.variants = [];
            }
            if (!this.tags) {
                this.tags = [];
            }
            return res;
        },
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.tags) {
                this.tags = json.tags
            }
            if (json.is_return) {
                this.is_return = json.is_return;
            }
            if (json.plus_point) {
                this.plus_point = json.plus_point;
            }
            if (json.redeem_point) {
                this.redeem_point = json.redeem_point;
            }
            if (json.uom_id) {
                this.uom_id = json.uom_id;
                var unit = this.pos.units_by_id[json.uom_id]
                if (unit) {
                    this.product.uom_id = [unit['id'], unit['name']];
                }
            }
            if (this.note) {
                this.note = this.set_line_note(json.note);
            }
            if (json.variants) {
                this.variants = json.variants
            }
            if (json.promotion) {
                this.promotion = json.promotion;
            }
            if (json.promotion_reason) {
                this.promotion_reason = json.promotion_reason;
            }
            if (json.promotion_discount_total_order) {
                this.promotion_discount_total_order = json.promotion_discount_total_order;
            }
            if (json.promotion_discount_category) {
                this.promotion_discount_category = json.promotion_discount_category;
            }
            if (json.promotion_discount_by_quantity) {
                this.promotion_discount_by_quantity = json.promotion_discount_by_quantity;
            }
            if (json.promotion_gift) {
                this.promotion_gift = json.promotion_gift;
            }
            if (json.promotion_discount) {
                this.promotion_discount = json.promotion_discount;
            }
            if (json.promotion_price_by_quantity) {
                this.promotion_price_by_quantity = json.promotion_price_by_quantity;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.tags) {
                json.tags = this.tags;
            }
            if (this.note) {
                json.note = this.note;
            }
            if (this.is_return) {
                json.is_return = this.is_return;
            }
            if (this.combo_items) {
                json.combo_items = this.combo_items;
            }
            if (this.plus_point) {
                json.plus_point = this.plus_point;
            }
            if (this.redeem_point) {
                json.redeem_point = this.redeem_point;
            }
            if (this.uom_id) {
                json.uom_id = this.uom_id
            }
            if (this.variants) {
                json.variants = this.variants;
            }
            if (this.promotion) {
                json.promotion = this.promotion;
            }
            if (this.promotion_reason) {
                json.promotion_reason = this.promotion_reason;
            }
            if (this.promotion_discount_total_order) {
                json.promotion_discount_total_order = this.promotion_discount_total_order;
            }
            if (this.promotion_discount_category) {
                json.promotion_discount_category = this.promotion_discount_category;
            }
            if (this.promotion_discount_by_quantity) {
                json.promotion_discount_by_quantity = this.promotion_discount_by_quantity;
            }
            if (this.promotion_discount) {
                json.promotion_discount = this.promotion_discount;
            }
            if (this.promotion_gift) {
                json.promotion_gift = this.promotion_gift;
            }
            if (this.promotion_price_by_quantity) {
                json.promotion_price_by_quantity = this.promotion_price_by_quantity;
            }
            return json;
        },
        clone: function () {
            var orderline = _super_Orderline.clone.call(this);
            orderline.note = this.note;
            return orderline;
        },
        export_for_printing: function () {
            var receipt_line = _super_Orderline.export_for_printing.apply(this, arguments);
            receipt_line['combo_items'] = [];
            receipt_line['variants'] = [];
            receipt_line['tags'] = [];
            receipt_line['promotion'] = null;
            receipt_line['promotion_reason'] = null;
            if (this.combo_items) {
                receipt_line['combo_items'] = this.combo_items;
            }
            if (this.variants) {
                receipt_line['variants'] = this.variants;
            }
            if (this.promotion) {
                receipt_line.promotion = this.promotion;
                receipt_line.promotion_reason = this.promotion_reason;
            }
            if (this.tags) {
                receipt_line['tags'] = this.tags;
            }
            return receipt_line;
        },
        is_has_tags: function () {
            if (this.tags.length > 0) {
                return true
            } else {
                return false
            }
        },
        is_multi_variant: function () {
            var variants = this.pos.variant_by_product_tmpl_id[this.product.product_tmpl_id]
            if (!variants) {
                return
            }
            if (variants.length > 0) {
                return true;
            } else {
                return false;
            }
        },
        get_price_discount: function () {
            var price_unit = this.get_unit_price();
            var prices = this.get_all_prices();
            var priceWithTax = prices['priceWithTax'];
            var tax = prices['tax'];
            var discount = priceWithTax - tax - price_unit;
            return discount;
        },
        get_unit: function () {
            if (!this.uom_id) {
                return _super_Orderline.get_unit.apply(this, arguments);
            } else {
                var unit_id = this.uom_id
                return this.pos.units_by_id[unit_id];
            }
        },
        is_multi_unit_of_measure: function () {
            var uom_items = this.pos.uoms_prices_by_product_tmpl_id[this.product.product_tmpl_id]
            if (!uom_items) {
                return false;
            }
            if (uom_items.length > 0) {
                return true;
            } else {
                return false;
            }
        },
        is_combo: function () {
            var combo_items = [];
            for (var i = 0; i < this.pos.combo_items.length; i++) {
                var combo_item = this.pos.combo_items[i];
                if (combo_item.product_combo_id[0] == this.product['product_tmpl_id']) {
                    combo_items.push(combo_item);
                }
            }
            if (combo_items.length > 0) {
                return true
            } else {
                return false;
            }
        },
        has_combo_item_tracking_lot: function () {
            var tracking = false;
            for (var i = 0; i < this.pos.combo_items.length; i++) {
                var combo_item = this.pos.combo_items[i];
                if (combo_item['tracking']) {
                    tracking = true;
                }
            }
            return tracking;
        },
        set_quantity: function (quantity, keep_price) {
            if (this.uom_id) {
                keep_price = 'keep price because changed uom id'
            }
            var new_quantity = parseFloat(quantity);
            if (quantity == "remove") {
                this.plus_point = 0;
                this.redeem_point = 0;
            } else if (new_quantity > 0) {
                var new_quantity = parseFloat(quantity);
                if (this.plus_point && this.plus_point > 0) {
                    var curr_plus_point = this.plus_point;
                    var new_plus = new_quantity / this.quantity * curr_plus_point;
                    this.plus_point = new_plus;
                }
                else if (this.redeem_point && this.redeem_point > 0) {
                    var curr_redeem_point = this.redeem_point;
                    var new_redeem_point = new_quantity / this.quantity * curr_redeem_point;
                    this.redeem_point = new_redeem_point;
                }
            } else if (new_quantity <= 0) {
                this.redeem_point = 0;
                this.plus_point = 0;
            }
            if (this.pos.the_first_load == false && quantity != 'remove' && this.pos.config.sync_stock && this.pos.config['allow_order_out_of_stock'] == false && quantity && quantity != 'remove' && this.order.syncing != true && this.product['type'] != 'service') {
                var current_qty = 0
                for (var i = 0; i < this.order.orderlines.models.length; i++) {
                    var line = this.order.orderlines.models[i];
                    if (this.product.id == line.product.id && line.id != this.id) {
                        current_qty += line.quantity
                    }
                }
                current_qty += parseFloat(quantity)
                if (current_qty > this.product['qty_available']) {
                    var product = this.pos.db.get_product_by_id(this.product.id)
                    return this.gui.show_popup('notify_popup', {
                        title: product['display_name'],
                        from: 'top',
                        align: 'center',
                        body: 'You can not set quantity bigger than ' + product.qty_available + ' unit',
                        color: 'warning',
                        timer: 1000
                    });
                }
            }
            // call style change parent parameter : keep_price
            return _super_Orderline.set_quantity.call(this, quantity, keep_price);
        },
        set_unit_price: function (price) {
            if (price > 0) {
                if (this.plus_point && this.plus_point > 0) {
                    var curr_plus_point = this.plus_point;
                    var new_plus = price / this.price * curr_plus_point;
                    this.plus_point = new_plus;
                }
                else if (this.redeem_point && this.redeem_point > 0) {
                    var curr_redeem_point = this.redeem_point;
                    var new_redeem_point = price / this.price * curr_redeem_point;
                    this.redeem_point = new_redeem_point;
                }
            } else if (price <= 0) {
                if (this.plus_point && this.plus_point > 0) {
                    this.plus_point = 0;
                }
                else if (this.redeem_point && this.redeem_point > 0) {
                    this.redeem_point = 0;
                }
            }
            return _super_Orderline.set_unit_price.apply(this, arguments);
        },
        set_line_note: function (note) {
            this.note = note;
            if (this.syncing == false || !this.syncing) {
                if (this.pos.pos_bus) {
                    var order = this.order.export_as_JSON();
                    this.pos.pos_bus.push_message_to_other_sessions({
                        action: 'set_line_note',
                        data: {
                            uid: this.uid,
                            note: note,
                        },
                        bus_id: this.pos.config.bus_id[0],
                        order_uid: order.uid,
                    });
                }
            }
            this.trigger('change', this);
        },
        get_note: function (note) {
            return this.note;
        },
        can_be_merged_with: function (orderline) {
            var merge = _super_Orderline.can_be_merged_with.apply(this, arguments);
            if (orderline.get_note() !== this.get_note() || this.promotion) {
                return false;
            } else {
                return merge;
            }
        }
    });
});
