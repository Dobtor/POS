odoo.define('pos_retail.popups', function (require) {

    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var qweb = core.qweb;

    // print vouchers
    var popup_print_vouchers = PopupWidget.extend({
        template: 'popup_print_vouchers',
        show: function (options) {
            var self = this;
            this._super(options);
            $('.print-voucher').click(function () {
                self.click_confirm();
            });
            $('.cancel').click(function () {
                self.click_cancel();
            });
        }
    });
    gui.define_popup({
        name: 'popup_print_vouchers',
        widget: popup_print_vouchers
    });

    // select combo
    var popup_selection_combos = PopupWidget.extend({
        template: 'popup_selection_combos',
        show: function (options) {
            var self = this;
            this._super(options);
            var combo_items = options.combo_items;
            var selected_orderline = options.selected_orderline;
            var combo_items_selected = selected_orderline['combo_items'];
            if (combo_items_selected.length != 0) {
                for (var i = 0; i < combo_items.length; i++) {
                    var combo_item = _.findWhere(combo_items_selected, {id: combo_items[i].id});
                    if (combo_item) {
                        combo_items[i]['selected'] = true
                    } else {
                        combo_items[i]['selected'] = false
                    }
                }
            }
            self.combo_item_of_line = selected_orderline['combo_items'];
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_medium&id=';
            self.$el.find('div.body').html(qweb.render('combo_items', {
                combo_items: combo_items,
                image_url: image_url,
                widget: self
            }));

            $('.combo-item').click(function () {
                var combo_item_id = parseInt($(this).data('id'));
                var combo_item = self.pos.combo_item_by_id[combo_item_id];
                if (!self.pos.get_order().selected_orderline) {
                    return;
                }
                if (combo_item) {
                    if ($(this).closest('.product').hasClass("item-selected") == true) {
                        $(this).closest('.product').toggleClass("item-selected");
                        for (var i = 0; i < self.combo_item_of_line.length; ++i) {
                            if (self.combo_item_of_line[i].id == combo_item.id) {
                                self.combo_item_of_line.splice(i, 1);
                                selected_orderline.trigger('change', selected_orderline)
                                selected_orderline.trigger('update:OrderLine');
                            }
                        }
                    } else {
                        if (self.pos.get_order().selected_orderline['combo_items'].length >= self.pos.get_order().selected_orderline.product.combo_limit) {
                            return self.gui.show_popup('alert_result', {
                                title: 'Warning',
                                body: 'You can not add bigger than ' + selected_orderline.product.combo_limit + ' items'
                            });
                        } else {
                            $(this).closest('.product').toggleClass("item-selected");
                            self.combo_item_of_line.push(combo_item);
                            selected_orderline.trigger('change', selected_orderline)
                            selected_orderline.trigger('update:OrderLine');
                        }
                    }

                }
                var order = self.pos.get('selectedOrder');
                order.trigger('change', order)
            });
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_selection_combos', widget: popup_selection_combos});

    // add lot to combo items
    var popup_add_lot_to_combo_items = PopupWidget.extend({
        template: 'popup_add_lot_to_combo_items',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .remove-lot': 'remove_lot',
            'blur .packlot-line-input': 'lose_input_focus'
        }),

        show: function (options) {
            this.orderline = options.orderline;
            this.combo_items = options.combo_items;
            this._super(options);
            this.focus();
        },
        lose_input_focus: function (ev) {
            var $input = $(ev.target),
                id = $input.attr('id');
            var combo_item = this.pos.combo_item_by_id[id];
            var lot = this.pos.lot_by_name[$input.val()];
            if (lot) {
                combo_item['use_date'] = lot['use_date']
            } else {
                combo_item['lot_number'] = 'Wrong lot, input again.';
            }
            for (var i = 0; i < this.orderline.combo_items.length; i++) {
                if (this.orderline.combo_items[i]['id'] == id) {
                    this.orderline.combo_items[i] = combo_item;
                }
            }
            this.orderline.trigger('change', this.orderline);
        },
        remove_lot: function (ev) {
            $input = $(ev.target).prev(),
                id = $input.attr('id');
            var combo_item = this.pos.combo_item_by_id[id];
            combo_item['lot_number'] = '';
            combo_item['use_date'] = '';
            for (var i = 0; i < this.orderline.combo_items.length; i++) {
                if (this.orderline.combo_items[i]['id'] == id) {
                    this.orderline.combo_items[i] = combo_item;
                }
            }
            this.orderline.trigger('change', this.orderline);
            this.renderElement();
        },

        focus: function () {
            this.$("input[autofocus]").focus();
            this.focus_model = false;   // after focus clear focus_model on widget
        }
    });
    gui.define_popup({name: 'popup_add_lot_to_combo_items', widget: popup_add_lot_to_combo_items});

    // popup cross selling
    var popup_cross_selling = PopupWidget.extend({
        template: 'popup_cross_selling',
        show: function (options) {
            var self = this;
            this._super(options);
            var cross_items = options.cross_items;
            this.cross_items_selected = [];
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_medium&id=';
            self.$el.find('div.body').html(qweb.render('cross_item', {
                cross_items: cross_items,
                image_url: image_url,
                widget: this
            }));
            $('.combo-item').click(function () {
                var cross_item_id = parseInt($(this).data('id'));
                var cross_item = self.pos.cross_item_by_id[cross_item_id];
                if (cross_item) {
                    if ($(this).closest('.product').hasClass("item-selected") == true) {
                        $(this).closest('.product').toggleClass("item-selected");
                        self.cross_items_selected = _.filter(self.cross_items_selected, function (cross_item_selected) {
                            return cross_item_selected['id'] != cross_item['id']
                        })
                    } else {
                        $(this).closest('.product').toggleClass("item-selected");
                        self.cross_items_selected.push(cross_item)
                    }

                }
            });
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
            $('.add_cross_selling').click(function () {
                var order = self.pos.get_order();
                if (self.cross_items_selected.length == 0) {
                    return self.pos.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Please click and choice product item'
                    });
                }
                if (order) {
                    for (var i = 0; i < self.cross_items_selected.length; i++) {
                        var cross_item = self.cross_items_selected[i];
                        var product = self.pos.db.get_product_by_id(cross_item['product_id'][0]);
                        if (product) {
                            if (!product) {
                                continue
                            }
                            var price = cross_item['list_price'];
                            if (cross_item['discount_type'] == 'percent') {
                                price = price - price / 100 * cross_item['discount']
                            }
                            order.add_product(product, {
                                quantity: cross_item['quantity'],
                                price: price,
                                merge: false,
                            });
                        }
                    }
                    return self.pos.gui.show_popup('alert_result', {
                        title: 'Done',
                        body: 'Cross items added.'
                    });
                }
            });
        }
    });
    gui.define_popup({name: 'popup_cross_selling', widget: popup_cross_selling});


    var popup_internal_transfer = PopupWidget.extend({
        template: 'popup_internal_transfer',
        show: function (options) {
            var self = this;
            this._super(options);
            $('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            $('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
            $('.request-transfer').click(function () {
                var scheduled_date = $('#scheduled_date').val();
                var fields = {};
                self.$('.product-list-scroller .detail').each(function (idx, el) {
                    fields[el.name] = el.value || false;
                });
                if (!scheduled_date) {
                    return this.gui.show_popup('alert_result', {
                        title: 'Error',
                        body: 'Please input scheduled date'
                    });
                }
                var order = self.pos.get_order();
                var length = order.orderlines.length;
                var picking_vals = {
                    origin: order['name'],
                    picking_type_id: parseInt(fields['picking_type_id']),
                    location_id: parseInt(fields['location_id']),
                    location_dest_id: parseInt(fields['location_dest_id']),
                    move_type: fields['move_type'],
                    note: fields['note'],
                    move_lines: [],
                    scheduled_date: scheduled_date,
                };
                for (var i = 0; i < length; i++) {
                    var line = order.orderlines.models[i];
                    var product = self.pos.db.get_product_by_id(line.product.id);
                    if (product['uom_po_id'] == undefined) {
                        return self.gui.show_popup('alert_confirm', {
                            title: 'Error',
                            body: product['display_name'] + ' have not set purchase unit',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'Close',
                            confirm: function () {
                                return self.pos.gui.close_popup();
                            },
                            cancel: function () {
                                return self.pos.gui.close_popup();
                            }
                        });
                    }
                    if (product['type'] == 'service') {
                        return self.gui.show_popup('alert_confirm', {
                            title: 'Error',
                            body: product['display_name'] + ' have type service, please remove out of order before made internal transfer. Could not made internal transfer',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'Close',
                            confirm: function () {
                                self.pos.gui.close_popup();
                            },
                            cancel: function () {
                                self.pos.gui.close_popup();
                            }
                        });
                    }
                    if (product['type'] != 'service' && product['uom_po_id'] != undefined) {
                        picking_vals['move_lines'].push([0, 0, {
                            name: order.name,
                            product_uom: product['uom_po_id'][0],
                            picking_type_id: parseInt(fields['picking_type_id']),
                            product_id: line.product.id,
                            product_uom_qty: line.quantity,
                            location_id: parseInt(fields['location_id']),
                            location_dest_id: parseInt(fields['location_dest_id']),
                        }])
                    }
                }
                if (picking_vals['move_lines'].length > 0) {
                    return self.gui.show_popup('alert_confirm', {
                        title: _t('Create Internal Transfer?'),
                        body: 'Are you sure?',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'No, close',
                        confirm: function () {
                            return rpc.query({
                                model: 'stock.picking',
                                method: 'create',
                                args: [picking_vals],
                                context: {}
                            }).then(function (picking_id) {
                                if (picking_id) {
                                    self.pos.get_order().destroy();
                                    var message = "<a class='so_link' target='_blank' href=" + window.location.origin + "/web#id=" + picking_id + "&view_type=form&model=stock.picking +>" + '(Click here)' + "</a>";
                                    self.gui.show_popup('alert_confirm', {
                                        title: message,
                                        body: 'Click review internal transfer or close popup',
                                        confirmButtonText: 'Yes',
                                        cancelButtonText: 'Close',
                                        confirm: function () {
                                            return self.pos.gui.close_popup();
                                        },
                                        cancel: function () {
                                            return self.pos.gui.close_popup();
                                        }
                                    });
                                    self.picking_id = picking_id;
                                    return rpc.query({
                                        model: 'stock.picking',
                                        method: 'action_assign',
                                        args: [picking_id],
                                        context: {}
                                    }).then(function (result) {
                                        return rpc.query({
                                            model: 'stock.picking',
                                            method: 'button_validate',
                                            args: [self.picking_id],
                                            context: {}
                                        }).then(function (result) {
                                        }).fail(function (type, error) {
                                        });
                                    }).fail(function (type, error) {
                                    });
                                }

                            }).fail(function (type, error) {
                                return self.gui.show_popup('notify_popup', {
                                    title: 'Error',
                                    from: 'top',
                                    align: 'center',
                                    body: 'Have problem odoo server config, please manual',
                                    color: 'danger',
                                    timer: 1000
                                });
                            });
                        }
                    });
                } else {
                    return self.gui.show_popup('alert_confirm', {
                        title: 'Error',
                        body: 'Could not create internal transfer, please check your odoo server',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'Close',
                        confirm: function () {
                            self.pos.gui.close_popup();
                        },
                        cancel: function () {
                            self.pos.gui.close_popup();
                        }
                    });
                }
            });
        }
    });

    gui.define_popup({name: 'popup_internal_transfer', widget: popup_internal_transfer});

    var popup_account_invoice_refund = PopupWidget.extend({
        template: 'popup_account_invoice_refund',
        show: function (options) {
            var self = this;
            options = options || {};
            options.title = options.invoice.number;
            options.invoice = options.invoice;
            this.options = options;
            this._super(options);
            $('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }

            });
            $('.datepicker').datetimepicker({
                format: 'YYYY-MM-DD',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });

            $('.timepicker').datetimepicker({
                //          format: 'H:mm',    // use this format if you want the 24hours timepicker
                format: 'H:mm:00', //use this format if you want the 12hours timpiecker with AM/PM toggle
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            $('.confirm').click(function () {
                self.click_confirm();
            });
            $('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
        },
        click_confirm: function () {
            var self = this;
            var filter_refund = this.$('#filter_refund').val();
            var description = this.$('#description').val();
            var date_invoice = this.$('#date_invoice').val();
            var date = this.$('#date').val();
            if (!filter_refund || !description || !date_invoice) {
                return this.gui.show_popup('notify_popup', {
                    title: 'Error',
                    from: 'top',
                    align: 'center',
                    body: 'Refund method, Reason and Credit note date is require, please check again',
                    color: 'danger',
                    timer: 1000
                });
            } else {
                var params = {
                    filter_refund: filter_refund,
                    description: description,
                    date_invoice: date_invoice,
                    date: date
                };
                var refund = rpc.query({
                    model: 'account.invoice.refund',
                    method: 'create',
                    args: [params],
                    context: {
                        active_ids: [self.options.invoice['id']]
                    }
                });
                refund.then(function (refund_id) {
                    var refund = rpc.query({
                        model: 'account.invoice.refund',
                        method: 'compute_refund',
                        args: [refund_id, filter_refund],
                        context: {
                            active_ids: [self.options.invoice['id']]
                        }
                    }).then(function (result) {
                        self.gui.show_popup('notify_popup', {
                            title: self.options.invoice['number'],
                            from: 'top',
                            align: 'center',
                            body: 'success refund',
                            color: 'success',
                            timer: 1000,
                        });
                        var refund_invoice = rpc.query({
                            model: 'account.invoice',
                            method: 'search_read',
                            args: [[['refund_invoice_id', '=', self.options.invoice['id']]]],
                        });
                        refund_invoice.then(function (refund_invoices) {
                            if (refund_invoices.length) {
                                for (var i = 0; i < refund_invoices.length; i++) {
                                    var refund_invoice = refund_invoices[i];
                                    var open_inv = rpc.query({
                                        model: 'account.invoice',
                                        method: 'action_invoice_open',
                                        args: [refund_invoice['id']],
                                    });
                                    open_inv.then(function (result) {
                                        self.gui.show_popup('notify_popup', {
                                            title: 'Good Job',
                                            from: 'top',
                                            align: 'center',
                                            body: 'refund of ' + self.options.invoice['number'] + ' auto validated.',
                                            color: 'success',
                                            timer: 1000,
                                        })
                                    }).fail(function (type, error) {
                                        if (error.code === 200) {
                                            event.preventDefault();
                                            self.gui.show_popup('notify_popup', {
                                                title: 'Error',
                                                from: 'top',
                                                align: 'center',
                                                body: 'Refund method, Reason and Credit note date is require, please check again',
                                                color: 'danger',
                                                timer: 1000
                                            });
                                            return;
                                        }
                                    });
                                }
                            }

                        })
                    }).fail(function (type, error) {
                        if (error.code === 200) {
                            event.preventDefault();
                            self.gui.show_popup('notify_popup', {
                                title: 'Error',
                                from: 'top',
                                align: 'center',
                                body: error.data.message,
                                color: 'danger',
                                timer: 1000
                            });
                            return;
                        }
                    });
                }).fail(function (type, error) {
                    if (error.code === 200) {
                        event.preventDefault();
                        self.gui.show_popup('notify_popup', {
                            title: 'Error',
                            from: 'top',
                            align: 'center',
                            body: error.data.message,
                            color: 'danger',
                            timer: 1000
                        });
                        return;
                    }
                });
            }

        }
    });

    gui.define_popup({name: 'popup_account_invoice_refund', widget: popup_account_invoice_refund});

    var popup_invoice_register_payment = PopupWidget.extend({
        template: 'popup_invoice_register_payment',
        show: function (options) {
            var self = this;
            options = options || {};
            options.cashregisters = this.pos.cashregisters;
            options.payment_methods = this.pos.payment_methods;
            options.title = options.invoice.number;
            options.invoice = options.invoice;
            this.options = options;
            this._super(options);
            $('.confirm').click(function () {
                self.click_confirm();
            });
            $('.cancel').click(function () {
                self.pos.gui.close_popup();
            });

        },
        click_confirm: function () {
            var self = this;
            var amount = parseFloat(this.$('#residual').val());
            self.amount = amount;
            var journal_id = parseInt(this.$('#journal_id').val());
            var payment_method_id = parseInt(this.$('#payment_method_id').val());
            var invoice = this.options.invoice;
            var payment_type;
            var partner_type;
            if (invoice.type == 'out_invoice' || invoice.type == 'in_refund') {
                payment_type = 'inbound'
            } else {
                payment_type = 'outbound'
            }
            if (invoice.type == 'out_invoice' || invoice.type == 'out_refund') {
                partner_type = 'customer'
            } else {
                partner_type = 'supplier'
            }
            if (typeof amount != 'number' || isNaN(amount)) {
                this.gui.show_popup('notify_popup', {
                    title: 'Wrong format',
                    from: 'top',
                    align: 'center',
                    body: 'Amount is require and format is Float',
                    color: 'danger',
                    timer: 1000
                });
                return;
            }
            if (typeof journal_id != 'number' || isNaN(journal_id)) {
                this.gui.show_popup('notify_popup', {
                    title: 'Missing input',
                    from: 'top',
                    align: 'center',
                    body: 'Journal is require select',
                    color: 'danger',
                    timer: 1000
                });
                return;
            }
            if (typeof payment_method_id != 'number' || isNaN(payment_method_id)) {
                this.gui.show_popup('notify_popup', {
                    title: 'Missing input',
                    from: 'top',
                    align: 'center',
                    body: 'Payment method is require select',
                    color: 'danger',
                    timer: 1000
                });
                return;
            }
            var params = {
                payment_type: payment_type,
                partner_type: partner_type,
                partner_id: invoice.partner_id[0],
                amount: parseFloat(amount),
                currency_id: self.pos.currency['id'],
                payment_date: new Date(),
                journal_id: journal_id,
                payment_method_id: payment_method_id
            };
            return rpc.query({
                model: 'account.payment',
                method: 'create',
                args:
                    [params]
            }).then(function (payment_id) {
                return rpc.query({
                    model: 'account.payment',
                    method: 'post',
                    args: [payment_id],
                    context: {
                        payment_id: payment_id,
                    }
                }).then(function (result) {
                    self.gui.close_popup();
                    self.gui.show_popup('notify_popup', {
                        title: self.options.invoice['number'],
                        from: 'top',
                        align: 'center',
                        body: ' registered amount success!'
                    });
                }).fail(function (type, error) {
                    if (error.code === 200) {
                        event.preventDefault();
                        self.gui.show_popup('notify_popup', {
                            title: 'ERROR',
                            from: 'top',
                            align: 'center',
                            body: error.data.message,
                            color: 'danger',
                            timer: 1000
                        });
                        return;
                    }
                });
            }).fail(function (type, error) {
                if (error.code === 200) {
                    event.preventDefault();
                    self.gui.show_popup('notify_popup', {
                        title: 'ERROR',
                        from: 'top',
                        align: 'center',
                        body: error.data.message,
                        color: 'danger',
                        timer: 1000
                    });
                    return;
                }
            });
        }
    });
    gui.define_popup({name: 'popup_invoice_register_payment', widget: popup_invoice_register_payment});

    // create sale order
    var popup_create_sale_order = PopupWidget.extend({
        template: 'popup_create_sale_order',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            var order = self.pos.get_order();
            var length = order.orderlines.length;
            if (!order.get_client()) {
                return setTimeout(function () {
                    self.pos.gui.show_screen('clientlist');
                }, 300);
            }
            if (length == 0) {
                this.gui.show_popup('notify_popup', {
                    title: 'ERROR',
                    from: 'top',
                    align: 'center',
                    body: "Current order have empty lines, please add products before create the sale order",
                    color: 'danger',
                    timer: 1000
                });
                return;
            }
            this._super(options);
            $('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            this.$(".pos_signature").jSignature();
            this.signed = false;
            $(".pos_signature").bind('change', function (e) {
                self.signed = true;
            });
            $(".cancel").click(function (e) {
                self.pos.gui.close_popup();
            });
        },
        renderElement: function () {
            var self = this;
            this._super();
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
            $('.create-order').click(function () {
                var $pricelist_id = $('#pricelist_id').val();
                var pricelist_id = parseInt($pricelist_id);
                if (typeof pricelist_id != 'number' || isNaN(pricelist_id)) {
                    return self.gui.show_popup('alert_result', {
                        title: 'Missing input',
                        body: 'Please select pricelist',
                        timer: 2000
                    });
                }
                var order = self.pos.get_order();
                if (self.signed == false && self.pos.config.required_cashier_signature == true) {
                    return self.gui.show_popup('alert_result', {
                        title: 'Missing input',
                        body: 'Please signature, that is require',
                        timer: 2000
                    });
                }
                var so_val = order.export_as_JSON();
                var value = {
                    creation_date: so_val['creation_date'],
                    partner_id: so_val.partner_id,
                    pricelist_id: pricelist_id,
                    origin: so_val.name,
                    lines: [],
                    note: $('#sale_order_note').val(),
                    status: self.pos.config.state_of_sale_order,
                    signature: null,
                    signature_on_report: self.pos.config.required_cashier_signature,
                    auto_invoice: self.pos.config.auto_invoice,
                    auto_delivered: self.pos.config.auto_delivered,
                    invoice_state: self.pos.config.invoice_state,
                };
                var sign_datas = self.$(".pos_signature").jSignature("getData", "image");
                if (sign_datas && sign_datas[1]) {
                    value['signature'] = sign_datas[1]
                }
                for (var i = 0; i < so_val.lines.length; i++) {
                    var line = so_val.lines[i][2];
                    value.lines.push({
                        product_id: line.product_id,
                        price_unit: line.price_unit,
                        quantity: line.qty,
                        discount: line.discount
                    })
                }
                var so = rpc.query({
                    model: 'sale.order',
                    method: 'create_sale_order_from_pos',
                    args: [value]
                });
                self.gui.show_popup('alert_result', {
                    title: 'SO submitted backend',
                    body: 'Please waiting few seconds',
                    timer: 2000
                });
                so.then(function (result) {
                    self.pos.get_order().destroy();
                    var body = "<a class='so_link' target='_blank' href=" + window.location.origin + "/web#id=" + result.id + "&view_type=form&model=sale.order +>" + result.name + ' (Click here)' + "</a>";
                    return self.gui.show_popup('alert_confirm', {
                        title: body,
                        body: 'If need to review, click to Order name',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'Close',
                        confirm: function () {
                            self.pos.gui.close_popup();
                        },
                        cancel: function () {
                            self.pos.gui.close_popup();
                        }
                    })
                }).fail(function (type, error) {
                    return self.gui.show_popup('alert_result', {
                        title: 'Error',
                        body: 'Odoo server conntection fail'
                    })
                });

            })
        }
    });
    gui.define_popup({
        name: 'popup_create_sale_order',
        widget: popup_create_sale_order
    });

    // create purchase order (PO)
    var popup_create_purchase_order = PopupWidget.extend({
        template: 'popup_create_purchase_order',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            options = options || {};
            this._super(options);
            $('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            var self = this
            if (lines.length == 0) {
                return this.gui.show_popup('alert_result', {
                    title: 'ERROR',
                    body: 'Current order have empty lines, please add products before create the purchase order',
                    timer: 2000
                });
            }
            if (!order.get_client()) {
                return setTimeout(function () {
                    self.pos.gui.show_screen('clientlist');
                }, 30);
            }
            this.$(".pos_signature").jSignature();
        },
        renderElement: function () {
            var self = this;
            this._super();
            $('.create-purchase-order').click(function () {
                self.create_po();
            });
            $('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
        },
        create_po: function () {
            var date_planned = $('#date_planned').val();
            var po_currency_id = $('#po_currency_id').val();

            if (!date_planned || !po_currency_id) {
                return this.gui.show_popup('alert_result', {
                    title: 'Error',
                    body: 'Please input scheduled date and currency',
                    timer: 3000
                });
            }
            var self = this
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            var client = this.pos.get_client();
            var values = {
                partner_id: this.pos.get_client().id,
                order_line: [],
                payment_term_id: client['property_payment_term_id'] && client['property_payment_term_id'][0],
                date_planned: date_planned,
                note: $('#purchase_order_note').val(),
                currency_id: parseInt(po_currency_id)
            };
            var sign_datas = self.$(".pos_signature").jSignature("getData", "image");
            if (sign_datas && sign_datas[1]) {
                values['signature'] = sign_datas[1]
            }
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].export_as_JSON();
                var product = this.pos.db.product_by_id[line.product_id];
                var uom_id;
                if (line['uom_id']) {
                    uom_id = lines[i]['uom_id']
                } else {
                    uom_id = lines[i].get_product().uom_id[0]
                }
                var taxes_id = [[6, false, product['supplier_taxes_id']]];
                values['order_line'].push([0, 0, {
                    product_id: lines[i].get_product().id,
                    name: lines[i].get_product().display_name,
                    product_qty: lines[i].get_quantity(),
                    product_uom: uom_id,
                    price_unit: lines[i].price,
                    date_planned: new Date(),
                    taxes_id: taxes_id
                }])
            }
            this.gui.show_popup('alert_result', {
                title: 'Waiting',
                body: 'Purchase Order just submitted to backend, waiting few seconds',
                timer: 2000
            });
            rpc.query({
                model: 'purchase.order',
                method: 'create',
                args:
                    [values]
            }).then(function (po_id) {
                return rpc.query({
                    model: 'purchase.order',
                    method: 'button_confirm',
                    args:
                        [po_id]
                })
                    .then(function () {
                        return rpc.query({
                            model: 'purchase.order',
                            method: 'read',
                            args:
                                [po_id]
                        })
                    })
                    .then(function (po_datas) {
                        order.destroy();
                        self.po_data = po_datas[0];
                        var body = "<a class='so_link' target='_blank' href='" + window.location.origin + "/web#id=" + self.po_data['id'] + "&view_type=form&model=purchase.order'" + ">";
                        body += "(Click here)</a>"
                        self.gui.show_popup('alert_confirm', {
                            title: body,
                            body: 'If need to review, click to Order name',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'Close',
                            confirm: function () {
                                self.pos.gui.close_popup();
                            },
                            cancel: function () {
                                self.pos.gui.close_popup();
                            }
                        });
                        var picking_id = self.po_data['picking_ids'][0]
                        if (self.pos.config.purchase_order_state != 'confirm_order' || self.pos.config.purchase_order_state == 'confirm_invoice') {
                            var temp = {};
                            if (self.pos.version.server_serie == "10.0") {
                                temp = {pick_id: picking_id}
                            }
                            if (self.pos.version.server_serie == "11.0") {
                                temp = {pick_ids: [(4, picking_id)]}
                            }
                            var immediate = rpc.query({
                                model: 'stock.immediate.transfer',
                                method: 'create',
                                args: [temp]
                            });
                            immediate.then(function (immediate_id) {
                                console.log('{immediate_id} ' + immediate_id)
                                rpc.query({
                                    model: 'stock.immediate.transfer',
                                    method: 'process',
                                    args: [immediate_id]
                                });
                            }).fail(function (type, error) {
                                console.log(error)
                            })
                        }
                        if (self.pos.config.purchase_order_state == 'confirm_invoice') {
                            var invoice_val = {
                                purchase_id: self.po_data['id'],
                                partner_id: self.po_data['partner_id'][0],
                                date_invoice: new Date(),
                                currency_id: self.pos.currency['id'],
                                type: 'in_invoice'
                            };
                            var made_invoice = rpc.query({
                                model: 'stock.immediate.transfer',
                                method: 'pos_made_invoice',
                                args: [invoice_val],
                                context: {
                                    purchase_id: self.po_data['id'],
                                    type: 'in_invoice'
                                }
                            });
                            made_invoice.then(function (invoice_vals) {
                                console.log('{invoice_vals} ' + invoice_vals)
                            }).fail(function (type, error) {
                                console.log(error)
                            })
                        }
                    }).fail(function (type, error) {
                        self.gui.show_popup('alert_result', {
                            title: 'Error',
                            body: 'Odoo connection fail',
                        });
                    });
            }).fail(function (type, error) {
                self.gui.show_popup('alert_result', {
                    title: 'Error',
                    body: 'Odoo connection fail',
                });
            });
        }
    });
    gui.define_popup({
        name: 'popup_create_purchase_order',
        widget: popup_create_purchase_order
    });
    // register payment pos orders
    var popup_register_payment = PopupWidget.extend({
        template: 'popup_register_payment',
        show: function (options) {
            var self = this;
            options = options || {};
            options.cashregisters = this.pos.cashregisters;
            options.amount_debit = options.pos_order.amount_total - options.pos_order.amount_paid;
            options.order = options.pos_order;
            this.options = options;
            if (options.amount_debit <= 0) {
                return this.gui.show_popup('alert_confirm', {
                    title: _t('Warning'),
                    body: 'Order have paid full',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No',
                    confirm: function () {
                    }
                });
            } else {
                this._super(options);
                this.renderElement();
                $('.payment-full').click(function () {
                    return self.gui.show_popup('alert_confirm', {
                        title: _t('Alert'),
                        body: 'Are you sure payment order full debit amount',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'No',
                        confirm: function () {
                            self.payment_full();
                        }
                    });
                });
                $('.confirm').click(function () {
                    return self.gui.show_popup('alert_confirm', {
                        title: _t('Alert'),
                        body: 'Are you sure payment order with current amount',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'No',
                        confirm: function () {
                            self.click_confirm();
                        }
                    });
                });
                $('.cancel').click(function () {
                    self.pos.gui.close_popup();
                });
            }
        },
        click_confirm: function () {
            var self = this;
            var amount = this.$('#amount').val();
            self.amount = amount;
            var journal_id = this.$('#journal_id').val();
            var payment_reference = this.$('#payment_reference').val();
            var params = {
                session_id: self.pos.pos_session.id,
                journal_id: parseInt(journal_id),
                amount: parseFloat(amount),
                payment_name: payment_reference,
                payment_date: new Date()
            };
            var balance = this.options.pos_order['amount_total'] - this.options.pos_order['amount_paid'];
            if (parseFloat(amount) > balance) {
                return self.gui.show_popup('alert_result', {
                    title: self.options.pos_order['name'],
                    body: 'You can not register amount bigger than ' + this.format_currency(balance),
                    confirm: function () {
                        return this.gui.close_popup();
                    }
                });
            }
            return rpc.query({
                model: 'pos.make.payment',
                method: 'create',
                args:
                    [params],
                context: {
                    active_id: this.options.pos_order['id']
                }
            }).then(function (payment_id) {
                return rpc.query({
                    model: 'pos.make.payment',
                    method: 'check',
                    args: [payment_id],
                    context: {
                        active_id: self.options.pos_order['id']
                    }
                }).then(function (result) {
                    self.gui.close_popup();
                    return self.gui.show_popup('alert_result', {
                        title: self.options.pos_order['name'],
                        body: 'Register payment ' + self.format_currency(parseFloat(self.amount)) + ' done.',
                        confirm: function () {
                            return self.gui.close_popup();
                        }
                    });
                })
            }).fail(function (type, error) {
                return self.gui.show_popup('alert_confirm', {
                    title: 'Error',
                    body: 'Your odoo server have problems, could not send amount register to backend',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No',
                    confirm: function () {
                        return self.pos.gui.close_popup();
                    },
                    cancel: function () {
                        return self.pos.gui.close_popup();
                    }
                });
            });
        },
        payment_full: function () {
            this.gui.close_popup();
            var self = this;
            var amount = this.$('#amount').val();
            self.amount = amount;
            var journal_id = this.$('#journal_id').val();
            var payment_reference = this.$('#payment_reference').val();
            var params = {
                session_id: self.pos.pos_session.id,
                journal_id: parseInt(journal_id),
                amount: this.options.pos_order.amount_total - this.options.pos_order.amount_paid,
                payment_name: payment_reference,
                payment_date: new Date()
            };
            return rpc.query({
                model: 'pos.make.payment',
                method: 'create',
                args:
                    [params],
                context: {
                    active_id: this.options.pos_order['id']
                }
            }).then(function (payment_id) {
                return rpc.query({
                    model: 'pos.make.payment',
                    method: 'check',
                    args: [payment_id],
                    context: {
                        active_id: self.options.pos_order['id']
                    }
                }).then(function (result) {
                    return self.gui.show_popup('alert_confirm', {
                        title: self.options.pos_order['name'],
                        body: 'Full paid success',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'No',
                        confirm: function () {
                        }
                    });
                })
            }).fail(function (type, error) {
                return self.gui.show_popup('alert_confirm', {
                    title: 'Error',
                    body: 'Your odoo server have problems, could not send amount register to backend',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No',
                    confirm: function () {
                    }
                });
            });
        }
    });
    gui.define_popup({name: 'popup_register_payment', widget: popup_register_payment});

    var popup_return_pos_order_lines = PopupWidget.extend({
        template: 'popup_return_pos_order_lines',
        show: function (options) {
            var self = this;
            this.line_selected = options.order_lines;
            this.order = options.order;
            this._super(options);
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_medium&id=';
            if (self.line_selected) {
                self.$el.find('tbody').html(qweb.render('order_line', {
                    order_lines: self.line_selected,
                    image_url: image_url,
                    widget: self
                }));
                $('.line-select').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.order_line_by_id[line_id];
                    var checked = this.checked;
                    if (checked == false) {
                        for (var i = 0; i < self.line_selected.length; ++i) {
                            if (self.line_selected[i].id == line.id) {
                                self.line_selected.splice(i, 1);
                            }
                        }
                    } else {
                        self.line_selected.push(line);
                    }
                });
                $('.confirm-return-order').click(function () {
                    if (self.line_selected == [] || !self.order) {
                        self.gui.show_popup('alert_confirm', {
                            title: _t('Error'),
                            body: 'Empty lines select for return order',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'No',
                            confirm: function () {
                            }
                        });
                    } else {
                        return self.gui.show_popup('alert_confirm', {
                            title: _t('Create Return Order?'),
                            body: 'Are you sure, Click Yes for made new pos order, will return products selected',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'No',
                            confirm: function () {
                                return self.pos.add_return_order(self.order, self.line_selected);
                            }
                        });
                    }
                });
                $('.cancel').click(function () {
                    self.pos.gui.close_popup();
                });
                $('.fa-minus-square-o').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.order_line_by_id[line_id];
                    var quantity = parseFloat($(this).parent().parent().find('.qty').text())
                    if (quantity > 1) {
                        var new_quantity = quantity - 1;
                        $(this).parent().parent().find('.qty').text(new_quantity)
                        line['new_quantity'] = new_quantity;
                    }
                });
                $('.fa-plus-square-o').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.order_line_by_id[line_id];
                    var quantity = parseFloat($(this).parent().parent().find('.qty').text())
                    if (line['qty'] >= (quantity + 1)) {
                        var new_quantity = quantity + 1;
                        $(this).parent().parent().find('.qty').text(new_quantity)
                        line['new_quantity'] = new_quantity;
                    }
                })
            }
        }
    });
    gui.define_popup({
        name: 'popup_return_pos_order_lines',
        widget: popup_return_pos_order_lines
    });

    var popup_selection_tags = PopupWidget.extend({
        template: 'popup_selection_tags',
        show: function (options) {
            var self = this;
            this._super(options);
            var tags = this.pos.tags;
            this.tags_selected = {};
            var selected_orderline = options.selected_orderline;
            var tag_selected = selected_orderline['tags'];
            for (var i = 0; i < tags.length; i++) {
                var tag = _.findWhere(tag_selected, {id: tags[i].id});
                if (tag) {
                    self.tags_selected[tag.id] = tags[i];
                    tags[i]['selected'] = true
                } else {
                    tags[i]['selected'] = false
                }
            }
            self.$el.find('.body').html(qweb.render('tags_list', {
                tags: tags,
                widget: self
            }));

            $('.tag').click(function () {
                var tag_id = parseInt($(this).data('id'));
                var tag = self.pos.tag_by_id[tag_id];
                if (tag) {
                    if ($(this).closest('.tag').hasClass("item-selected") == true) {
                        $(this).closest('.tag').toggleClass("item-selected");
                        delete self.tags_selected[tag.id];
                        self.remove_tag_out_of_line(selected_orderline, tag)
                    } else {
                        $(this).closest('.tag').toggleClass("item-selected");
                        self.tags_selected[tag.id] = tag;
                        self.add_tag_to_line(selected_orderline, tag)
                    }
                }
            });
            $('.close').click(function () {
                self.pos.gui.close_popup();
            });
        },
        add_tag_to_line: function (line, tag_new) {
            line.tags.push(tag_new);
            line.trigger('change', line);
            line.trigger_update_line();
        },
        remove_tag_out_of_line: function (line, tag_new) {
            var tag_exist = _.filter(line.tags, function (tag) {
                return tag['id'] !== tag_new['id'];
            });
            line.tags = tag_exist;
            line.trigger('change', line);
            line.trigger_update_line();
        }
    });
    gui.define_popup({name: 'popup_selection_tags', widget: popup_selection_tags});

    var popup_selection_variants = PopupWidget.extend({
        template: 'popup_selection_variants',
        show: function (options) {
            var self = this;
            this._super(options);
            this.variants_selected = {};
            var variants = options.variants;
            var selected_orderline = options.selected_orderline;
            var variants_selected = selected_orderline['variants'];
            if (variants_selected.length != 0) {
                for (var i = 0; i < variants.length; i++) {
                    var variant = _.findWhere(variants_selected, {id: variants[i].id});
                    if (variant) {
                        self.variants_selected[variant.id] = variant;
                        variants[i]['selected'] = true
                    } else {
                        variants[i]['selected'] = false
                    }
                }
            }

            var image_url = window.location.origin + '/web/image?model=product.template&field=image_medium&id=';
            self.$el.find('div.body').html(qweb.render('variant_items', {
                variants: variants,
                image_url: image_url,
                widget: self
            }));
            $('.variant').click(function () {
                var variant_id = parseInt($(this).data('id'));
                var variant = self.pos.variant_by_id[variant_id];
                if (variant) {
                    if ($(this).closest('.product').hasClass("item-selected") == true) {
                        $(this).closest('.product').toggleClass("item-selected");
                        delete self.variants_selected[variant.id];
                    } else {
                        $(this).closest('.product').toggleClass("item-selected");
                        self.variants_selected[variant.id] = variant;

                    }
                }
            });
            $('.confirm-variant').click(function () {
                var variants_selected = self.variants_selected;
                var variants = _.map(variants_selected, function (variant) {
                    return variant;
                });
                selected_orderline['variants'] = variants;
                if (variants.length == 0) {
                    return selected_orderline.set_unit_price(selected_orderline.product.list_price);
                } else {
                    var price_extra_total = selected_orderline.product.list_price;
                    for (var i = 0; i < variants.length; i++) {
                        price_extra_total += variants[i].price_extra;
                    }
                    selected_orderline.set_unit_price(price_extra_total);
                    selected_orderline.trigger_update_line();
                    self.pos.get_order().trigger('change');
                }
            });
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_selection_variants', widget: popup_selection_variants});

    var popup_order_signature = PopupWidget.extend({
        template: 'popup_order_signature',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            this.order = options.order;
            this._super(options);
            this.$(".pos_signature").jSignature();
        },
        renderElement: function () {
            var self = this;
            this._super();
            $('.signature-order').click(function () {
                var order = self.pos.get_order();
                var sign_datas = self.$(".pos_signature").jSignature("getData", "image");
                if (sign_datas.length > 1) {
                    order.set_signature(sign_datas[1])
                }
                self.gui.close_popup();
            })
            $('.cancel').click(function () {
                self.gui.close_popup();
            })
        }
    });
    gui.define_popup({
        name: 'popup_order_signature',
        widget: popup_order_signature
    });

    var popup_print_receipt = PopupWidget.extend({
        template: 'popup_print_receipt',
        show: function (options) {
            options = options || {};
            this.options = options;
            this._super(options);
            var contents = this.$el[0].querySelector('.xml');
            var tbody = document.createElement('tbody');
            tbody.innerHTML = options.xml;
            tbody = tbody.childNodes[1];
            contents.appendChild(tbody);
            var self = this;
            setTimeout(function () {
                self.pos.gui.close_popup();
            }, 5000);
        }
    });
    gui.define_popup({name: 'popup_print_receipt', widget: popup_print_receipt});

    var popup_add_order_line_note = PopupWidget.extend({
        template: 'popup_add_order_line_note',
        show: function (options) {
            var self = this;
            options = options || {};
            options.notes = this.pos.notes;
            this._super(options);
            this.renderElement();
            this.notes_selected = {};
            this.$('input,textarea').focus();
            $('.note').click(function () {
                var note_id = parseInt($(this).data('id'));
                var note = self.pos.note_by_id[note_id];
                self.pos.get_order().get_selected_orderline().set_line_note(note['name']);
                self.pos.gui.close_popup();
            });
            $('.confirm').click(function () {
                self.click_confirm();
            });
            $('.cancel').click(function () {
                self.gui.close_popup();
            });
        },
        click_confirm: function () {
            var value = this.$('input,textarea').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        }
    });
    gui.define_popup({name: 'popup_add_order_line_note', widget: popup_add_order_line_note});

    var notify_popup = PopupWidget.extend({
        template: 'notify_popup',
        show: function (options) {
            if (this.pos.config.notify_alert == true) {
                this.show_notification(options.from, options.align, options.title, options.body, options.timer, options.color)
            }
        },
        show_notification: function (from, align, title, body, timer, color) {
            if (!color) {
                var type = ['info', 'success', 'warning', 'danger', 'rose', 'primary'];
                var random = Math.floor((Math.random() * 6) + 1);
                color = type[random];
            }
            if (!timer) {
                timer = 3000;
            }
            $.notify({
                icon: "notifications",
                message: "<b>" + title + "</b> - " + body

            }, {
                type: color,
                timer: timer,
                placement: {
                    from: from,
                    align: align
                }
            });
        }
    });
    gui.define_popup({name: 'notify_popup', widget: notify_popup});

    var alert_confirm = PopupWidget.extend({
        template: 'alert_confirm',
        show: function (options) {
            var self = this;
            if (options) {
                swal({
                    title: options.title,
                    text: options.body || '',
                    type: options.type || 'warning',
                    showCancelButton: true,
                    confirmButtonText: options.confirmButtonText || '',
                    cancelButtonText: options.cancelButtonText || '',
                    confirmButtonClass: "btn btn-success",
                    cancelButtonClass: "btn btn-danger",
                    buttonsStyling: false
                });
            }
            this._super(options);
            $('.swal2-confirm').click(function () {
                self.click_confirm();
            });
            $('.swal2-cancel').click(function () {
                self.click_cancel();
            })

        }
    });
    gui.define_popup({name: 'alert_confirm', widget: alert_confirm});

    var alert_input = PopupWidget.extend({
        template: 'alert_input',
        show: function (options) {
            var self = this;
            if (options) {
                swal({
                    title: options.title || '',
                    html: options.html || '',
                    showCancelButton: true,
                    confirmButtonClass: 'btn btn-success',
                    cancelButtonClass: 'btn btn-danger',
                    buttonsStyling: false
                }).catch(swal.noop);
            }
            this._super(options);
            $('.swal2-confirm').click(function () {
                self.click_confirm();
            });
            $('.swal2-cancel').click(function () {
                self.click_cancel();
            })
        }
    });
    gui.define_popup({name: 'alert_input', widget: alert_input});

    var alert_result = PopupWidget.extend({
        template: 'alert_result',
        show: function (options) {
            var self = this;
            if (options) {
                swal({
                    title: options.title,
                    text: options.body,
                    buttonsStyling: false,
                    confirmButtonClass: "btn btn-info",
                    timer: options.timer || 1500
                }).catch(swal.noop)
            }
            this._super(options);
            $('.swal2-confirm').click(function () {
                self.click_confirm();
            });
            $('.swal2-cancel').click(function () {
                self.click_cancel();
            })
        }
    });
    gui.define_popup({name: 'alert_result', widget: alert_result});
});
