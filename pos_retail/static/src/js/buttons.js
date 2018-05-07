odoo.define('pos_retail.buttons', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var _t = core._t;
    var rpc = require('web.rpc');
    var qweb = core.qweb;

    var button_promotion = screens.ActionButtonWidget.extend({
        template: 'button_promotion',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order) {
                order.compute_promotion();
            }
        }
    });
    screens.define_action_button({
        'name': 'button_promotion',
        'widget': button_promotion,
        'condition': function () {
            return this.pos.config.promotion == true && this.pos.promotion_ids.length && this.pos.promotion_ids.length >= 1;
        }
    });

    var print_voucher = screens.ActionButtonWidget.extend({
        template: 'print_voucher',
        button_click: function () {
            this.gui.show_popup('popup_print_vouchers', {
                confirm: function () {
                    var self = this;
                    var period_days = parseFloat($('#period_days').val());
                    var apply_type = $('#apply_type').val();
                    var voucher_amount = parseFloat($('#voucher_amount').val());
                    var quantity_create = parseInt($('#quantity_create').val());
                    var method = $('#method').val();
                    var customer = this.pos.get_order().get_client();
                    if (method == "special_customer" && !customer) {
                        setTimeout(function () {
                            self.pos.gui.show_screen('clientlist');
                        }, 1000);
                        return this.pos.gui.show_popup('alert_result', {
                            title: 'Warning',
                            body: 'Because apply to Special customer, required select customer the first'
                        })
                    }
                    if (typeof period_days != 'number' || isNaN(period_days)) {
                        return this.pos.gui.show_popup('alert_result', {
                            title: 'Warning',
                            body: 'Wrong format, Period days is required and format is Float',
                        })
                    }
                    if (typeof voucher_amount != 'number' || isNaN(voucher_amount)) {
                        return this.pos.gui.show_popup('alert_result', {
                            title: 'Warning',
                            body: 'Amount is required and format is Float',
                        })
                    }
                    if (typeof quantity_create != 'number' || isNaN(quantity_create)) {
                        return this.pos.gui.show_popup('alert_result', {
                            title: 'Warning',
                            body: 'Quantity voucher will create is required and format is Number or float'
                        })
                    }
                    var voucher_data = {
                        apply_type: apply_type,
                        value: voucher_amount,
                        method: method,
                        period_days: period_days,
                        total_available: quantity_create
                    };
                    if (customer) {
                        voucher_data['customer_id'] = customer['id'];
                    }
                    rpc.query({
                        model: 'pos.voucher',
                        method: 'create_voucher',
                        args: [voucher_data]
                    }).then(function (vouchers) {
                        self.pos.vouchers = vouchers;
                        self.pos.gui.show_screen('vouchers_screen');
                    }).fail(function (type, error) {
                        return this.pos.gui.show_popup('alert_result', {
                            title: 'Warning',
                            body: 'Odoo connection fail'
                        });
                    });
                    return this.gui.close_popup();
                },
                cancel: function () {
                    return this.gui.close_popup();
                }
            });

        }
    });
    screens.define_action_button({
        'name': 'print_voucher',
        'widget': print_voucher,
        'condition': function () {
            return this.pos.config.print_voucher;
        }
    });

    var button_promotion = screens.ActionButtonWidget.extend({
        template: 'button_promotion',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order) {
                order.compute_promotion()
            }
        }
    });
    screens.define_action_button({
        'name': 'button_promotion',
        'widget': button_promotion,
        'condition': function () {
            return this.pos.config.promotion == true && this.pos.promotion_ids.length && this.pos.promotion_ids.length >= 1;
        }
    });

    var button_combo = screens.ActionButtonWidget.extend({
        template: 'button_combo',

        button_click: function () {
            var self = this;
            var selected_orderline = this.pos.get_order().selected_orderline;
            if (!selected_orderline) {
                return;
            }
            var combo_items = [];
            for (var i = 0; i < this.pos.combo_items.length; i++) {
                var combo_item = this.pos.combo_items[i];
                if (combo_item.product_combo_id[0] == selected_orderline.product.product_tmpl_id) {
                    combo_items.push(combo_item);
                }
            }
            if (!selected_orderline) {
                return this.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Please select line',
                    confirm: function () {
                        return self.gui.close_popup();
                    }
                });
            } else {
                if (combo_items.length) {
                    this.gui.show_popup('popup_selection_combos', {
                        title: 'Please choice items',
                        combo_items: combo_items,
                        selected_orderline: selected_orderline
                    });
                } else {
                    return this.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Line selected is not product pack/combo',
                        confirm: function () {
                            return self.gui.close_popup();
                        }
                    });
                }
            }
        }
    });

    screens.define_action_button({
        'name': 'button_combo',
        'widget': button_combo,
        'condition': function () {
            return true;
        }
    });

    var button_combo_item_add_lot = screens.ActionButtonWidget.extend({
        template: 'button_combo_item_add_lot',

        button_click: function () {
            var selected_orderline = this.pos.get_order().selected_orderline;
            if (!selected_orderline) {
                this.gui.show_popup('notify_popup', {
                    title: 'Error',
                    from: 'top',
                    align: 'center',
                    body: 'Please selected line before add lot',
                    color: 'danger',
                    timer: 1000
                });
                return;
            } else {
                this.pos.gui.show_popup('popup_add_lot_to_combo_items', {
                    'title': _t('Lot/Serial Number(s) Combo Items'),
                    'combo_items': selected_orderline['combo_items'],
                    'orderline': selected_orderline,
                    'widget': this,
                });
            }
        }
    });

    screens.define_action_button({
        'name': 'button_combo_item_add_lot',
        'widget': button_combo_item_add_lot,
        'condition': function () {
            return true;
        }
    });

    var global_discount_button = screens.ActionButtonWidget.extend({
        template: 'global_discount_button',
        button_click: function () {
            var list = [];
            var self = this;
            for (var i = 0; i < this.pos.discounts.length; i++) {
                var discount = this.pos.discounts[i];
                list.push({
                    'label': discount.name,
                    'item': discount
                });
            }

            this.gui.show_popup('selection', {
                title: _t('Select discount'),
                list: list,
                confirm: function (discount) {
                    var order = self.pos.get('selectedOrder');
                    var total_with_tax = order.get_total_with_tax();
                    var product = self.pos.db.product_by_id[discount.product_id[0]]
                    var price = total_with_tax / 100 * discount['amount']
                    order.add_product(product, {
                        price: -price
                    })
                    var selected_line = order.get_selected_orderline();
                    selected_line.trigger('update:OrderLine', selected_line);
                    selected_line.trigger('change', selected_line);
                }
            });
        }
    });
    screens.define_action_button({
        'name': 'global_discount_button',
        'widget': global_discount_button,
        'condition': function () {
            return this.pos.config.discount;
        }
    });

    var internal_transfer_button = screens.ActionButtonWidget.extend({
        template: 'internal_transfer_button',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var self = this;
            var order = this.pos.get_order();
            var length = order.orderlines.length;
            if (length == 0) {
                return this.gui.show_popup('alert_confirm', {
                    title: 'Error',
                    body: 'Your order is empty',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'Close',
                    confirm: function () {
                        return self.pos.gui.close_popup();
                    },
                    cancel: function () {
                        return self.pos.gui.close_popup();
                    }
                });
            } else {
                this.gui.show_popup('popup_internal_transfer', {})
            }
        }
    });

    screens.define_action_button({
        'name': 'internal_transfer_button',
        'widget': internal_transfer_button,
        'condition': function () {
            return this.pos.config && this.pos.config.internal_transfer;
        }
    });

    var button_go_invoice_screen = screens.ActionButtonWidget.extend({
        template: 'button_go_invoice_screen',
        button_click: function () {
            this.gui.show_screen('invoices');
        },
    });
    screens.define_action_button({
        'name': 'button_go_invoice_screen',
        'widget': button_go_invoice_screen,
        'condition': function () {
            return this.pos.config.management_invoice == true;
        }
    });
    var button_kitchen_receipt_screen = screens.ActionButtonWidget.extend({
        template: 'button_kitchen_receipt_screen',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order && order.orderlines.length) {
                this.pos.gui.show_screen('kitchen_receipt_screen');
            }
        }
    });
    screens.define_action_button({
        'name': 'button_kitchen_receipt_screen',
        'widget': button_kitchen_receipt_screen,
        'condition': function () {
            return this.pos.printers && this.pos.printers.length;
        }
    });

    var button_lock = screens.ActionButtonWidget.extend({
        template: 'button_lock',
        button_click: function () {
            this.gui.show_screen('login_page');
        }
    });
    screens.define_action_button({
        'name': 'button_lock',
        'widget': button_lock,
        'condition': function () {
            return this.pos.config.allow_lock_screen == true;
        }
    });
    var reward_button = screens.ActionButtonWidget.extend({
        template: 'reward_button',

        validate_loyalty: function (order, reward, amount_with_tax, total_redeem_point) {
            var client = order.get_client();
            if (reward['min_amount'] > amount_with_tax) {
                this.gui.show_popup('notify_popup', {
                    title: 'ERROR',
                    from: 'top',
                    align: 'center',
                    body: "Can not apply because Min Amount need to bigger than : " + reward['min_amount'],
                    color: 'danger',
                    timer: 1000
                });
                return;
            }
            if (client['pos_loyalty_point'] <= total_redeem_point) {
                this.gui.show_popup('notify_popup', {
                    title: 'ERROR',
                    from: 'top',
                    align: 'center',
                    body: client['name'] + " have : " + client['pos_loyalty_point'] + " point, can not pass condition rule of loyalty.",
                    color: 'danger',
                    timer: 1000
                });
                return;
            }
            if ((reward['type'] == 'discount_products' || reward['type'] == 'discount_categories') && reward['discount'] <= 0) {
                this.gui.show_popup('notify_popup', {
                    title: 'ERROR',
                    from: 'top',
                    align: 'center',
                    body: "You can not set discount smaller than 0. Contact your admin system and re-config this reward",
                    color: 'danger',
                    timer: 1000
                });
                return;
            }
        },
        set_redeem_point: function (line, new_price, redeem_point, rounding) {
            line.plus_point = 0;
            line.redeem_point = round_pr(redeem_point, rounding);
            if (new_price != null) {
                line.set_unit_price(new_price)
            }
            line.trigger('change', line);
        },
        button_click: function () {
            var list = [];
            var self = this;
            var order = self.pos.get('selectedOrder');
            var client = order.get_client();
            if (!client) {
                return setTimeout(function () {
                    self.pos.gui.show_screen('clientlist');
                }, 1);
            }
            for (var i = 0; i < this.pos.rewards.length; i++) {
                var item = this.pos.rewards[i];
                list.push({
                    'label': item['name'],
                    'item': item
                });
            }
            if (list.length > 0) {
                this.gui.show_popup('selection', {
                    title: _t('Select Reward program'),
                    list: list,
                    confirm: function (reward) {
                        var lines = order.orderlines.models;
                        var amount_with_tax = order.get_total_with_tax();
                        var total_redeem_point = order.get_redeem_point();
                        self.validate_loyalty(order, reward, amount_with_tax, total_redeem_point);
                        if (reward['type'] == 'discount_products') {
                            for (var i = 0; i < lines.length; i++) {
                                var curr_line = lines[i];
                                if (reward['discount_product_ids'].indexOf(curr_line['product']['id']) != -1) {
                                    var price = curr_line.get_price_with_tax();
                                    var point_will_redeem = price / 100 * reward['discount'] * reward['coefficient']
                                    point_will_redeem = round_pr(point_will_redeem, reward['rounding'])
                                    var next_redeem_point = total_redeem_point + point_will_redeem;
                                    if (client['pos_loyalty_point'] < next_redeem_point) {
                                        console.error('limit point')
                                        break; // dừng vòng lặp khi quá point
                                    } else {
                                        var new_price = price - (price / 100 * reward['discount']);
                                        self.set_redeem_point(curr_line, new_price, point_will_redeem, reward['rounding'])
                                    }
                                }
                            }
                        }
                        else if (reward['type'] == 'discount_categories') {
                            for (var i = 0; i < lines.length; i++) {
                                var curr_line = lines[i];
                                if (reward['discount_category_ids'].indexOf(curr_line['product']['pos_categ_id'][0]) != -1) {
                                    var price = curr_line.get_price_with_tax();
                                    var point_will_redeem = price / 100 * reward['discount'] * reward['coefficient']
                                    point_will_redeem = round_pr(point_will_redeem, reward['rounding'])
                                    var next_redeem_point = total_redeem_point + point_will_redeem;
                                    if (client['pos_loyalty_point'] < next_redeem_point) {
                                        console.error('limit point')
                                        break; // dừng vòng lặp khi quá point
                                    } else {
                                        var new_price = price - (price / 100 * reward['discount']);
                                        self.set_redeem_point(curr_line, new_price, point_will_redeem, reward['rounding'])
                                    }
                                }
                            }
                        }
                        else if (reward['type'] == 'gift') {
                            for (item_index in reward['gift_product_ids']) {
                                var product = self.pos.db.get_product_by_id(reward['gift_product_ids'][item_index])
                                if (product) {
                                    var point_will_redeem = product['list_price'] * reward['coefficient'];
                                    var next_redeem_point = total_redeem_point + point_will_redeem;
                                    if (client['pos_loyalty_point'] < next_redeem_point) {
                                        console.error('limit point')
                                        break; // dừng vòng lặp khi quá point
                                    } else {
                                        order.add_product(product, {
                                            quantity: reward['quantity'],
                                            price: 0,
                                            merge: true,
                                        });
                                        var selected_line = order.get_selected_orderline();
                                        self.set_redeem_point(selected_line, null, point_will_redeem, reward['rounding'])
                                    }
                                }
                            }
                        }
                        else if (reward['type'] == 'resale') {
                            for (var i = 0; i < lines.length; i++) {
                                var curr_line = lines[i];
                                if (reward['resale_product_ids'].indexOf(curr_line['product']['id']) != -1) {
                                    var product = curr_line.product
                                    var price = product['list_price']
                                    var point_will_redeem = price - reward['price_resale'] * reward['coefficient'];
                                    var next_redeem_point = total_redeem_point + point_will_redeem;
                                    if (client['pos_loyalty_point'] < next_redeem_point) {
                                        console.error('limit point')
                                        break; // dừng vòng lặp khi quá point
                                    } else {
                                        var new_price = reward['price_resale'];
                                        self.set_redeem_point(curr_line, reward['price_resale'], point_will_redeem, reward['rounding'])
                                    }
                                }
                            }
                        }
                        else if (reward['type'] == 'resale') {
                            for (var i = 0; i < lines.length; i++) {
                                var curr_line = lines[i];
                                if (reward['resale_product_ids'].indexOf(curr_line['product']['id']) != -1) {
                                    var product = curr_line.product
                                    var price = product['list_price']
                                    var point_will_redeem = price - reward['price_resale'] * reward['coefficient'];
                                    var next_redeem_point = total_redeem_point + point_will_redeem;
                                    if (client['pos_loyalty_point'] < next_redeem_point) {
                                        console.error('limit point')
                                        break; // dừng vòng lặp khi quá point
                                    } else {
                                        var new_price = reward['price_resale'];
                                        self.set_redeem_point(curr_line, reward['price_resale'], point_will_redeem, reward['rounding'])
                                    }
                                }
                            }
                        }
                        else if (reward['type'] == 'use_point_payment') {
                            self.gui.show_popup('number', {
                                'title': _t('How many point customer need use ?'),
                                'value': self.format_currency_no_symbol(0),
                                'confirm': function (point) {
                                    var total_redeem_point = order.get_redeem_point();
                                    var next_redeem_point = total_redeem_point + parseFloat(point);
                                    if (client['pos_loyalty_point'] < next_redeem_point) {
                                        return self.gui.show_popup('alert_result', {
                                            title: 'ERROR',
                                            body: 'You can not add total point bigger than: ' + (client['pos_loyalty_point'] - total_redeem_point),
                                            timer: 2000,
                                            confirm: function () {
                                                return self.gui.close_popup();
                                            }
                                        });

                                    } else {
                                        var loyalty_id = reward['loyalty_id'][0];
                                        var loyalty = self.pos.loyalty_by_id[loyalty_id];
                                        if (loyalty) {
                                            var product_id = loyalty['product_loyalty_id'][0];
                                            var product = self.pos.db.get_product_by_id(product_id);
                                            if (product) {
                                                var next_amount = amount_with_tax - point * reward['coefficient'];
                                                if (next_amount >= 0) {
                                                    order.add_product(product, {
                                                        quantity: -1,
                                                        price: point * reward['coefficient'],
                                                        merge: false,
                                                    });
                                                    var selected_line = order.get_selected_orderline();
                                                    self.set_redeem_point(selected_line, null, point, reward['rounding'])
                                                } else {
                                                    return self.gui.show_popup('alert_result', {
                                                        title: 'ERROR',
                                                        body: 'If apply reward program, amount order will smaller than 0',
                                                        timer: 2000,
                                                        confirm: function () {
                                                            return self.gui.close_popup();
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                        }
                        order.trigger('change', order);
                    }
                });
            } else {
                return this.gui.show_popup('alert_result', {
                    title: 'ERROR',
                    body: 'Have not any reward programs active',
                    timer: 2000,
                    confirm: function () {
                        return self.gui.close_popup();
                    }
                });
            }
        }
    });

    screens.define_action_button({
        'name': 'reward_button',
        'widget': reward_button,
        'condition': function () {
            return this.pos.rules && this.pos.rules.length && this.pos.rules.length > 0;
        }
    });

    var button_create_purchase_order = screens.ActionButtonWidget.extend({
        template: 'button_create_purchase_order',
        button_click: function () {
            this.gui.show_popup('popup_create_purchase_order', {
                title: 'Create Purchase Order'
            });
        }
    });

    screens.define_action_button({
        'name': 'button_create_purchase_order',
        'widget': button_create_purchase_order,
        'condition': function () {
            return this.pos.config.create_purchase_order && this.pos.config.purchase_order_state;
        }
    });
    var button_create_sale_order = screens.ActionButtonWidget.extend({
        template: 'button_create_sale_order',
        button_click: function () {
            this.gui.show_popup('popup_create_sale_order', {
                title: 'Create Sale Order'
            });
        }
    });
    screens.define_action_button({
        'name': 'button_create_sale_order',
        'widget': button_create_sale_order,
        'condition': function () {
            return this.pos.config.allow_create_sale_order;
        }
    });

    var button_choice_uom = screens.ActionButtonWidget.extend({
        template: 'button_choice_uom',
        button_click: function () {
            var self = this;
            var order = this.pos.get_order()
            if (order) {
                var selected_orderline = order.selected_orderline;
                if (selected_orderline) {
                    var product = selected_orderline.product;
                    var uom_items = this.pos.uoms_prices_by_product_tmpl_id[product.product_tmpl_id]
                    if (!uom_items) {
                        this.gui.show_popup('notify_popup', {
                            title: 'ERROR',
                            from: 'top',
                            align: 'center',
                            body: product['display_name'] + ' have ' + product['uom_id'][1] + ' only.',
                            color: 'danger',
                            timer: 1000
                        });
                        return;
                    }
                    var list = [];
                    for (var i = 0; i < uom_items.length; i++) {
                        var item = uom_items[i];
                        list.push({
                            'label': item.uom_id[1],
                            'item': item,
                        });
                    }
                    if (list.length) {
                        this.gui.show_popup('selection', {
                            title: _t('Select Unit of measure'),
                            list: list,
                            confirm: function (item) {
                                selected_orderline.set_unit_price(item['price'])
                                selected_orderline.uom_id = item['uom_id'][0];
                                selected_orderline.trigger('change', selected_orderline);
                                selected_orderline.trigger('update:OrderLine');
                            }
                        });
                    } else {
                        return this.gui.show_popup('alert_result', {
                            title: 'Warning',
                            body: product['display_name'] + ' only one ' + product['uom_id'][1],
                            timer: 2000,
                            confirm: function () {
                                return self.gui.close_popup();
                            },
                            cancel: function () {
                                return self.gui.close_popup();
                            }
                        });
                    }
                } else {
                    return this.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Please select line',
                        confirm: function () {
                            return self.gui.close_popup();
                        },
                        cancel: function () {
                            return self.gui.close_popup();
                        }
                    });
                }
            } else {
                return this.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Order Lines is empty',
                    timer: 2000,
                    confirm: function () {
                        return self.gui.close_popup();
                    },
                    cancel: function () {
                        return self.gui.close_popup();
                    }
                });
            }
        }
    });
    screens.define_action_button({
        'name': 'button_choice_uom',
        'widget': button_choice_uom,
        'condition': function () {
            return this.pos.uoms_prices.length && this.pos.uoms_prices.length > 0;
        }
    });
    var button_go_orders_screen = screens.ActionButtonWidget.extend({
        template: 'button_go_orders_screen',
        button_click: function () {
            this.gui.show_screen('orders_screen');
        }
    });
    screens.define_action_button({
        'name': 'button_go_orders_screen',
        'widget': button_go_orders_screen,
        'condition': function () {
            return this.pos.config.allow_return_order == true;
        }
    });
    var button_set_tags = screens.ActionButtonWidget.extend({
        template: 'button_set_tags',
        button_click: function () {
            if (!this.pos.tags || this.pos.tags.length == 0) {
                return this.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Empty tags, please go to Retail [menu] / Tags and create',
                    confirm: function () {
                        return this.gui.close_popup();
                    },
                    cancel: function () {
                        return this.gui.close_popup();
                    }
                });
            }
            if (this.pos.get_order().selected_orderline && this.pos.tags && this.pos.tags.length > 0) {
                return this.gui.show_popup('popup_selection_tags', {
                    selected_orderline: this.pos.get_order().selected_orderline,
                    title: 'Add tags'
                });
            } else {
                return this.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Please select linne',
                    confirm: function () {
                        return this.gui.close_popup();
                    },
                    cancel: function () {
                        return this.gui.close_popup();
                    }
                });
            }
        }
    });

    screens.define_action_button({
        'name': 'button_set_tags',
        'widget': button_set_tags,
        'condition': function () {
            return this.pos.tags.length > 0;
        }
    });
    var button_register_payment = screens.ActionButtonWidget.extend({
        template: 'button_register_payment',
        button_click: function () {
            this.chrome.do_action('account.action_account_payment_from_invoices', {
                additional_context: {
                    active_ids: [3]
                }
            });
        }
    });

    screens.define_action_button({
        'name': 'button_register_payment',
        'widget': button_register_payment,
        'condition': function () {
            return false;
        }
    });
    var product_operation_button = screens.ActionButtonWidget.extend({
        template: 'product_operation_button',
        button_click: function () {
            this.gui.show_screen('productlist');
        }
    });

    screens.define_action_button({
        'name': 'product_operation_button',
        'widget': product_operation_button,
        'condition': function () {
            return this.pos.config.product_operation;
        }
    });
    var variant_button = screens.ActionButtonWidget.extend({
        template: 'variant_button',
        init: function (parent, options) {
            this._super(parent, options);
            this.pos.get('orders').bind('add remove change', function () {
                this.renderElement();
            }, this);
            this.pos.bind('change:selectedOrder', function () {
                this.renderElement();
            }, this);
        },
        button_click: function () {
            var selected_orderline = this.pos.get_order().selected_orderline;
            if (!selected_orderline) {
                this.pos.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Please select line',
                    timer: 2000
                })
            } else {
                if (this.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id]) {
                    this.gui.show_popup('popup_selection_variants', {
                        title: 'Select variants',
                        variants: this.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id],
                        selected_orderline: selected_orderline
                    })
                } else {
                    this.pos.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Line selected have not variants, please go to Product menu, add variants values.',
                        timer: 3000

                    })
                }
            }
        }
    });

    screens.define_action_button({
        'name': 'variant_button',
        'widget': variant_button,
        'condition': function () {
            return true;
        }
    });
    var button_print_receipt = screens.ActionButtonWidget.extend({
        template: 'button_print_receipt',
        button_click: function () {
            var self = this;
            var order = this.pos.get_order();
            if (!order || order.orderlines.length == 0) {
                return this.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Your Order blank'
                });
            }
            if (this.pos.config.lock_order_printed_receipt) {
                return this.gui.show_popup('alert_confirm', {
                    title: _t('Are you want print receipt?'),
                    body: 'If POS-BOX(printer) is ready config IP, please check receipt at printer, else if POS-BOX and printer not ready will go to Receipt Screen',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No, close',
                    confirm: function () {
                        var order = self.pos.get_order();
                        if (order) {
                            order['lock'] = true;
                            this.pos.lock_order();
                            this.pos.pos_bus.push_message_to_other_sessions({
                                data: order.uid,
                                action: 'lock_order',
                                bus_id: this.pos.config.bus_id[0],
                                order_uid: order['uid']
                            });
                            return self.pos.gui.show_screen('receipt_review');
                        }
                    }
                });
            } else {
                return self.pos.gui.show_screen('receipt_review');
            }

        }
    });
    screens.define_action_button({
        'name': 'button_print_receipt',
        'widget': button_print_receipt,
        'condition': function () {
            return this.pos.config.receipt_without_payment_template != 'none'
        }
    });

    var button_order_signature = screens.ActionButtonWidget.extend({
        template: 'button_order_signature',
        button_click: function () {
            var order = this.pos.get_order();
            if (order) {
                this.gui.show_popup('popup_order_signature', {
                    order: order,
                    title: 'Signature'
                });
            }
        }
    });
    screens.define_action_button({
        'name': 'button_order_signature',
        'widget': button_order_signature,
        'condition': function () {
            return true;
        }
    });

    var button_print_test = screens.ActionButtonWidget.extend({
        template: 'button_print_test',
        button_click: function () {
            var order = this.pos.get_order();
            var env = {
                widget: this,
                pos: this.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines()
            };
            var receipt = qweb.render('XmlReceipt', env);
            this.pos.gui.show_popup('popup_print_receipt', {
                xml: receipt
            });
        }
    });
    screens.define_action_button({
        'name': 'button_print_test',
        'widget': button_print_test,
        'condition': function () {
            return true
        }
    });
    var button_order_note = screens.ActionButtonWidget.extend({
        template: 'button_order_note',
        button_click: function () {
            var order = this.pos.get_order();
            if (order) {
                this.gui.show_popup('textarea', {
                    title: _t('Add Order Note'),
                    value: order.get_note(),
                    confirm: function (note) {
                        order.set_note(note);
                        order.trigger('change', order);
                    }
                });
            }
        }
    });
    screens.define_action_button({
        'name': 'button_order_note',
        'widget': button_order_note,
        'condition': function () {
            return true;
        }
    });

    var button_note = screens.ActionButtonWidget.extend({
        template: 'button_note',
        button_click: function () {
            var line = this.pos.get_order().get_selected_orderline();
            if (line) {
                this.gui.show_popup('popup_add_order_line_note', {
                    title: _t('Add Note'),
                    value: line.get_note(),
                    confirm: function (note) {
                        line.set_line_note(note);
                    }
                });
            } else {
                this.pos.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Please select line the first'
                })
            }
        }
    });

    screens.define_action_button({
        'name': 'button_note',
        'widget': button_note,
        'condition': function () {
            return true;
        }
    });
    var button_selection_pricelist = screens.ActionButtonWidget.extend({ // version 10 only
        template: 'button_selection_pricelist',
        init: function (parent, options) {
            this._super(parent, options);
            this.pos.get('orders').bind('add remove change', function () {
                this.renderElement();
            }, this);
            this.pos.bind('change:selectedOrder', function () {
                this.renderElement();
                var order = this.pos.get_order();
                if (order && order.pricelist) {
                    order.set_pricelist_to_order(order.pricelist);
                }
            }, this);
        },
        button_click: function () {
            var self = this;
            var pricelists = _.map(self.pos.pricelists, function (pricelist) {
                return {
                    label: pricelist.name,
                    item: pricelist
                };
            });
            self.gui.show_popup('selection', {
                title: _t('Choice one pricelist'),
                list: pricelists,
                confirm: function (pricelist) {
                    self.pos.gui.close_popup();
                    var order = self.pos.get_order();
                    order.set_pricelist_to_order(pricelist);
                },
                is_selected: function (pricelist) {
                    return pricelist.id === self.pos.get_order().pricelist.id;
                }
            });
        },
        get_order_pricelist: function () {
            var name = _t('Pricelist Item');
            var order = this.pos.get_order();
            if (order) {
                var pricelist = order.pricelist;
                if (pricelist) {
                    name = pricelist.display_name;
                }
            }
            return name;
        }
    });

    screens.define_action_button({
        'name': 'button_selection_pricelist',
        'widget': button_selection_pricelist,
        'condition': function () {
            return this.pos.version['server_serie'] == "10.0" && this.pos.pricelists && this.pos.pricelists.length > 0;
        }
    });

    var button_return_products = screens.ActionButtonWidget.extend({
        template: 'button_return_products',
        button_click: function () {
            this.gui.show_screen('return_products');
        }
    });

    screens.define_action_button({
        'name': 'button_return_products',
        'widget': button_return_products,
        'condition': function () {
            return this.pos.config.return_products == true;
        }
    });

    var button_lock_unlock_order = screens.ActionButtonWidget.extend({
        template: 'button_lock_unlock_order',
        button_click: function () {
            var order = this.pos.get_order();
            order['lock'] = !order['lock'];
            order.trigger('change', order);
            if (this.pos.pos_bus) {
                var action;
                if (order['lock']) {
                    action = 'lock_order';
                } else {
                    action = 'unlock_order';
                }
                this.pos.pos_bus.push_message_to_other_sessions({
                    data: order.uid,
                    action: action,
                    bus_id: this.pos.config.bus_id[0],
                    order_uid: order['uid']
                });
            } else {
                this.pos.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Syncing between sessions not active'
                })
            }
        }
    });

    screens.define_action_button({
        'name': 'button_lock_unlock_order',
        'widget': button_lock_unlock_order,
        'condition': function () {
            return this.pos.config.lock_order_printed_receipt == false;
        }
    });

    var button_print_user_card = screens.ActionButtonWidget.extend({
        template: 'button_print_user_card',
        button_click: function () {
            var user_card_xml = qweb.render('user_card_xml', {
                user: this.pos.get_cashier()
            });
            this.pos.proxy.print_receipt(user_card_xml);
            return this.pos.gui.show_popup('alert_result', {
                title: 'Hi',
                body: 'please get user card at your printer'
            })

        }
    });

    screens.define_action_button({
        'name': 'button_print_user_card',
        'widget': button_print_user_card,
        'condition': function () {
            return this.pos.config.print_user_card == true;
        }
    });

    var button_daily_report = screens.ActionButtonWidget.extend({
        template: 'button_daily_report',
        button_click: function () {
            this.pos.gui.show_screen('daily_report')

        }
    });

    screens.define_action_button({
        'name': 'button_daily_report',
        'widget': button_daily_report,
        'condition': function () {
            return true;
        }
    });

    // var button_payment = screens.ActionButtonWidget.extend({
    //     template: 'button_payment',
    //     button_click: function () {
    //         var $rightpane = $('.rightpane');
    //         var payment_screen = qweb.render('PaymentScreenWidget', {
    //             this: this,
    //             widget: this,
    //             pos: this.pos
    //
    //         });
    //         $rightpane.append(payment_screen);
    //         // this.pos.gui.show_screen('products');
    //     }
    // });
    //
    // screens.define_action_button({
    //     'name': 'button_payment',
    //     'widget': button_payment,
    //     'condition': function () {
    //         return true;
    //     }
    // });

    // return order

});
