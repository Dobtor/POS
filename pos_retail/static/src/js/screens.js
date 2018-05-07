odoo.define('pos_retail.screens', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var rpc = require('web.rpc');
    var qweb = core.qweb;

    var TablesScreenWidget = screens.ScreenWidget.extend({
        template: 'TableScreenWidget',
        init: function (parent, options) {
            this._super(parent, options);
        },
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:table-list', function () {
                self.renderElement();
            })
        },
        renderElement: function () {
            var self = this;
            this._super();
            var orders = this.pos.get('orders').models;
            var current_order = this.pos.get('selectedOrder');
            for (var i = 0; i < orders.length; i++) {
                var table = orders[i].table;
                if (table) {
                    var tablewidget = $(qweb.render('Table', {
                        widget: this,
                        table: table,
                    }));
                    tablewidget.data('id', table.id);
                    this.$('.table-items').append(tablewidget);
                    if (current_order) {
                        if (current_order.uid == orders[i].uid) {
                            tablewidget.css('background', 'rgb(110,200,155)');
                        }
                    }
                }
            }
            this.$('.table-item').on('click', function () {
                var table_id = parseInt($(this).data()['id']);
                self.clickTable(table_id);
                $(this).css('background', 'rgb(110,200,155)');
            });
        },
        get_order_by_table: function (table) {
            var orders = this.pos.get('orders').models;
            var order = orders.find(function (order) {
                if (order.table) {
                    return order.table.id == table.id;
                }
            })
            return order;
        },
        clickTable: function (table_id) {
            var self = this;
            var tables = self.pos.tables_by_id;
            var table = tables[table_id];
            if (table) {
                var order_click = this.get_order_by_table(table)
                if (order_click) {
                    this.pos.set('selectedOrder', order_click);
                    order_click.trigger('change', order_click);
                }
            }
            var items = this.$('.table-item');
            for (var i = 0; i < items.length; i++) {
                if (parseInt($(items[i]).data()['id']) != table_id) {
                    $(items[i]).css('background', '#fff');

                }
            }
        }
    });

    screens.ClientListScreenWidget.include({
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:point-client', function () {
                var partners = self.pos.db.get_partners_sorted(1000);
                self.re_render_list(partners);
            });
            this.pos.bind('update:customer_screen', function (customer_data) {
                if (customer_data) {
                    var partner_exist = false;
                    for (var i = 0; i < self.pos.partners.length; i++) {
                        var partner = self.pos.partners[i];
                        if (partner['id'] == customer_data['id']) {
                            partner = customer_data;
                            self.pos.db.partner_by_id[customer_data['id']] = null; // set null because odoo cache by id, if have data partner_by_id, odoo will continue loop
                            self.pos.db.add_partners([customer_data]);
                            partner_exist = true;
                        }
                    }
                    if (partner_exist == false) {
                        self.pos.partners.push(customer_data);
                        self.pos.db.add_partners([customer_data]);
                    }
                    var partners = self.pos.db.get_partners_sorted();
                    var orders = self.pos.get('orders').models;
                    for (var i = 0; i < orders.length; i++) {
                        var order = orders[i].export_as_JSON();
                        if (order['partner_id'] && order['partner_id'] == customer_data['id']) {
                            var client = self.pos.db.get_partner_by_id(customer_data['id']);
                            try {
                                orders[i].set_client(client);
                            } catch (ex) {
                                console.log('order just created at backend, no need set client()')
                            }
                        }
                    }
                    self.partner_cache = new screens.DomCache();
                    self.render_list(partners);
                }
            })
        },
        re_render_list: function (partners) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(partners.length, 1000); i < len; i++) {
                var partner = partners[i];
                var clientline_html = qweb.render('ClientLine', {widget: this, partner: partners[i]});
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                this.partner_cache.cache_node(partner.id, clientline);
                if (partner === this.old_client) {
                    clientline.classList.add('highlight');
                } else {
                    clientline.classList.remove('highlight');
                }
                contents.appendChild(clientline);
            }
        },
        show: function () {
            var self = this;
            this._super();
            var $search_box = $('.clientlist-screen .searchbox >input');
            var partners = [];
            for (var i = 0; i < this.pos.partners.length; i++) {
                var partner = this.pos.partners[i];
                var label = "";
                if (partner['barcode']) {
                    label += '[' + partner['barcode'] + ']';
                }
                if (label) {
                    label += ', ' + partner['name'];
                } else {
                    label += partner['name'];
                }
                if (partner['street']) {
                    label += ', ' + partner['street'];
                }
                if (partner['mobile']) {
                    label += ', ' + partner['mobile'];
                }
                if (partner['phone']) {
                    label += ', ' + partner['phone'];
                }
                if (partner['email']) {
                    label += ', ' + partner['email'];
                }
                partners.push({
                    value: partner['id'],
                    label: label
                })
            }
            $search_box.autocomplete({
                source: partners,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var partner = self.pos.db.partner_by_id[parseInt(ui['item']['value'])];
                        if (partner) {
                            self.pos.get_order().set_client(partner);
                            self.pos.gui.show_screen('products');
                        }
                        setTimeout(function () {
                            self.clear_search();
                        }, 10);
                    }
                }
            });
        }
    });

    screens.ProductScreenWidget.include({
        init: function () {
            var self = this;
            this._super.apply(this, arguments);
        },
        start: function () {
            this._super();
            var action_buttons = this.action_buttons;
            for (var key in action_buttons) {
                action_buttons[key].appendTo(this.$('.button-list'));
            }
            $('.control-buttons').addClass('oe_hidden');
            this.hide_numpad = false;


        },
        hide_numpad_buttons: function () {
            $('.actionpad').addClass('oe_hidden');
            $('.numpad').addClass('oe_hidden');
            $('.buttons_pane').addClass('oe_hidden');
            $('.timeline').addClass('oe_hidden');
            $button = $('.hide_numpad .fa-arrow-left');
            $button.removeClass('fa-arrow-left');
            $button.addClass('fa-arrow-right');
            $('.leftpane').css({'left': '0px'});
            $('.rightpane').css({'left': '440px'});
        },
        show_numpad_buttons: function () {
            $('.actionpad').removeClass('oe_hidden');
            $('.numpad').removeClass('oe_hidden');
            $('.buttons_pane').removeClass('oe_hidden');
            $('.timeline').removeClass('oe_hidden');
            $button = $('.hide_numpad .fa-arrow-right');
            $button.removeClass('fa-arrow-right');
            $button.addClass('fa-arrow-left');
            $('.leftpane').css({'left': '220px'});
            $('.rightpane').css({'left': '660px'});
        },
        show: function () {
            var self = this;
            this._super();
            var $search_box = $('.product-screen .searchbox >input');
            var products = [];
            for (var i = 0; i < this.pos.products.length; i++) {
                var product = this.pos.products[i];
                var label = "";
                if (product['default_code']) {
                    label = '[' + product['default_code'] + ']'
                }
                if (product['barcode']) {
                    label = '[' + product['barcode'] + ']'
                }
                if (product['display_name']) {
                    label = '[' + product['display_name'] + ']'
                }
                if (product['description']) {
                    label = '[' + product['description'] + ']'
                }
                products.push({
                    value: product['id'],
                    label: label
                })
            }
            $search_box.autocomplete({
                source: products,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value'])
                        var product = self.pos.db.get_product_by_id(ui['item']['value']);
                    setTimeout(function () {
                        this.$('.searchbox input')[0].value = '';
                    }, 10);
                    if (product) {
                        return self.pos.get_order().add_product(product);
                    }

                }
            });
            $('.hide_numpad').click(function () {
                if (self.pos.get_order().get_screen_data('screen') == 'products') {
                    if (self.hide_numpad == false) {
                        self.hide_numpad_buttons();
                    } else {
                        self.show_numpad_buttons();
                    }
                    self.hide_numpad = !self.hide_numpad;
                }
            });
            // partner find
            var partners = [];
            for (var i = 0; i < this.pos.partners.length; i++) {
                var partner = this.pos.partners[i];
                var label = "";
                if (partner['barcode']) {
                    label += '[' + partner['barcode'] + ']';
                }
                if (label) {
                    label += ', ' + partner['name'];
                } else {
                    label += partner['name'];
                }
                if (partner['street']) {
                    label += ', ' + partner['street'];
                }
                if (partner['mobile']) {
                    label += ', ' + partner['mobile'];
                }
                if (partner['phone']) {
                    label += ', ' + partner['phone'];
                }
                if (partner['email']) {
                    label += ', ' + partner['email'];
                }
                partners.push({
                    value: partner['id'],
                    label: label
                })
            }
            var $search_box = $('.find_customer >input');
            $search_box.autocomplete({
                source: partners,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var partner = self.pos.db.partner_by_id[parseInt(ui['item']['value'])];
                        if (partner) {
                            self.pos.get_order().set_client(partner);
                            self.show_numpad_buttons();
                            setTimeout(function () {
                                var input = self.el.querySelector('.find_customer input');
                                input.value = '';
                                input.focus();
                            }, 10);

                        }
                    }
                }
            });

        }
    });

    screens.ProductCategoriesWidget.include({
        show: function () {
            var self = this;
            this._super();
            var $search_box = $('.product-screen .searchbox >input');
            var products = [];
            for (var i = 0; i < this.pos.products.length; i++) {
                if (this.pos.products[i]['default_code']) {
                    products.push({
                        value: this.pos.products[i]['id'],
                        label: "[" + this.pos.products[i]['default_code'] + "] " + this.pos.products[i]['display_name']
                    })
                } else {
                    products.push({
                        value: this.pos.products[i]['id'],
                        label: this.pos.products[i]['display_name']
                    })
                }

            }
            $search_box.autocomplete({
                source: products,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value'])
                        var product = self.pos.db.get_product_by_id(ui['item']['value']);
                    setTimeout(function () {
                        self.clear_search();
                    }, 10);
                    if (product) {
                        return self.pos.get_order().add_product(product);
                    }

                }
            });
        }
    });

    screens.ActionButtonWidget.include({
        highlight: function (highlight) {
            this.$el.toggleClass('btn-success', !!highlight);
        }
    });

    screens.ProductListWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('product:change_price_list', function (products) {
                for (var i = 0; i < products.length; i++) {
                    var product = products[i];
                    var $product_el = $("[data-product-id='" + product['id'] + "'] .price-tag");
                    $product_el.html(self.format_currency(product['price']) + '/' + product['uom_id'][1]);
                }
                return true;
            });
            this.pos.bind('product:updated', function (product_data) {
                // when product update data
                // when stock on hand product change
                // odoo version 11
                if (self.pos.version['server_serie'] == "11.0") {
                    self.product_cache = new screens.DomCache();
                    self.pos.db.product_by_category_id = {};
                    self.pos.db.category_search_string = {};
                    self.pos.db.product_by_barcode = {};
                    var products = [];
                    for (var product_id in self.pos.db.product_by_id) {
                        var product = self.pos.db.product_by_id[product_id];
                        product['product_tmpl_id'] = [product['product_tmpl_id'], product['display_name']]
                        if (product['id'] != product_data['id']) {
                            products.push(product);
                        } else {
                            products.push(product_data)
                        }
                    }
                    // check new product add from backend
                    var product_exist = _.filter(products, function (product) {
                        return product['id'] == product_data['id'];
                    });
                    if (product_exist.length == 0) {
                        products.push(product_data)
                    }
                    self.pos.db.add_products(_.map(products, function (product) {
                        product.categ = _.findWhere(self.pos.product_categories, {'id': product.categ_id[0]});
                        return new models.Product({}, product);
                    }));
                    self.product_list = self.pos.db.get_product_by_category(0);
                    self.renderElement();
                }
                // odoo version 10
                if (self.pos.version['server_serie'] == "10.0") {
                    var product_list = self.pos.products;
                    self.pos.db.category_search_string = {};
                    if (!product_data['price']) {
                        product_data['price'] = product_data['list_price'];
                    }
                    // if this method called from sync stock product_tmpl_id is INT and made bug
                    // else if called created/updated from backend product_tmpl_id is array
                    if (product_data['product_tmpl_id'].length == undefined) {
                        product_data['product_tmpl_id'] = [product_data['product_tmpl_id'], product_data['display_name']];
                    }
                    var product_is_exsit = false;
                    for (var i = 0; i < product_list.length; i++) {
                        var product = product_list[i];
                        if (product['id'] == product_data['id']) {
                            product_list[i] = product_data;
                            product_is_exsit = true;
                        } else {
                            product['product_tmpl_id'] = [product['product_tmpl_id'], product['display_name']];
                        }
                    }
                    if (product_is_exsit == false) {
                        product_list.push(product_data);
                    }
                    self.pos.db.add_products(product_list);
                    // change old cache
                    // fix big bugs cache big images
                    var image_url = self.get_product_image_url(product_data);
                    var product_html = qweb.render('Product', {
                        widget: self,
                        product: product_data,
                        image_url: image_url
                    });
                    var product_node = document.createElement('div');
                    product_node.innerHTML = product_html;
                    product_node = product_node.childNodes[1];
                    self.product_cache.cache_node(product_data['id'], product_node);
                    var $product_el = $(".product-list " + "[data-product-id='" + product_data['id'] + "']");
                    if ($product_el) {
                        $product_el.replaceWith(product_html);
                    }
                }

            });
            this.mouse_down = false;
            this.moved = false;
            this.auto_tooltip;
            this.product_mouse_down = function (e) {
                if (e.which == 1) {
                    console.log('mouse down');
                    $('#info_tooltip').remove();
                    self.right_arrangement = false;
                    self.moved = false;
                    self.mouse_down = true;
                    self.touch_start(this.dataset.productId, e.pageX, e.pageY);
                }
            };
            this.product_mouse_move = function (e) {
                console.log('mouse move');
                if (self.mouse_down) {
                    self.moved = true;
                }
            };
        },
        touch_start: function (product_id, x, y) {
            var self = this;
            console.log(self.moved)
            this.auto_tooltip = setTimeout(function () {
                if (self.moved == false) {
                    this.right_arrangement = false;
                    var product = self.pos.db.get_product_by_id(parseInt(product_id));
                    var inner_html = self.generate_html(product);
                    $('.product-list-container').prepend(inner_html);
                    $(".close_button").on("click", function () {
                        $('#info_tooltip').remove();
                    });
                }
            }, 30);
        },
        generate_html: function (product) {
            var self = this;
            var product_tooltip_html = qweb.render('product_tooltip', {
                widget: self,
                product: product,
                field_load_check: self.pos.db.field_load_check
            });
            return product_tooltip_html;
        },
        touch_end: function () {
            if (this.auto_tooltip) {
                clearTimeout(this.auto_tooltip);
            }
        },
        renderElement: function () {
            var self = this;
            this._super();
            if (this.pos.config.tooltip) {
                var caches = this.product_cache;
                for (var cache_key in caches.cache) {
                    var product_node = this.product_cache.get_node(cache_key);
                    product_node.addEventListener('click', this.click_product_handler);
                    product_node.addEventListener('mousedown', this.product_mouse_down);
                    product_node.addEventListener('mousemove', this.product_mouse_move);
                }
                $(".product-list-scroller").scroll(function (event) {
                    $('#info_tooltip').remove();
                });
            }
            var products = [];
            for (var i = 0; i < this.pos.products.length; i++) {
                var product = this.pos.products[i];
                var label = "";
                if (product['default_code']) {
                    label = '[' + product['default_code'] + ']'
                }
                if (product['barcode']) {
                    label = '[' + product['barcode'] + ']'
                }
                if (product['display_name']) {
                    label = '[' + product['display_name'] + ']'
                }
                if (product['description']) {
                    label = '[' + product['description'] + ']'
                }
                products.push({
                    value: product['id'],
                    label: label
                })
            }
            var $search_box = $('.product-screen .searchbox >input');
            $search_box.autocomplete({
                source: products,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value'])
                        var product = self.pos.db.get_product_by_id(ui['item']['value']);
                    setTimeout(function () {
                        this.$('.searchbox input')[0].value = '';
                    }, 10);
                    if (product) {
                        return self.pos.get_order().add_product(product);
                    }

                }
            });
        },
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var current_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                return this._super()
            } else {
                return current_pricelist
            }
        }
    });
    screens.ScreenWidget.include({

        show: function () {
            var self = this;
            this._super();
            var config = this.pos.config;
            if (config.allow_discount == false) {
                $('.numpad .mode-button:eq(1)').addClass('oe_hidden');
                $('.numpad .mode-button:eq(1)').removeClass('selected-mode');
            }
            if (config.allow_qty == false) {
                $('.numpad .mode-button:eq(0)').addClass('oe_hidden');
                $('.numpad .mode-button:eq(0)').removeClass('selected-mode');
            }
            if (config.allow_price == false) {
                $('.numpad .mode-button:eq(2)').addClass('oe_hidden');
                $('.numpad .mode-button:eq(2)').removeClass('selected-mode');
            }
            if (config.allow_numpad == false) {
                $('.numpad').hide();
            }
            if (config.allow_remove_line == false) {
                $('.numpad-backspace').hide();
            }
            if (config.allow_payment == false) {
                $('.pay').hide();
            }
            if (config.allow_customer == false) {
                $('.set-customer').hide();
            }
            if (config.allow_add_order == false) {
                $('.neworder-button').hide();
            }
            if (config.allow_remove_order == false) {
                $('.deleteorder-button').hide();
            }
            if (config.allow_add_product == false) {
                $('.rightpane').hide();
            }
            $('.pos-logo').hide();
            this.pos.barcode_reader.set_action_callback({ // bind device scan return order
                'order': _.bind(self.barcode_order_return_action, self),
            });
            if (this.pos.config.is_customer_screen) {
                $('.layout-table').replaceWith();
                $('.buttons_pane').replaceWith();
                $('.collapsed').replaceWith();
                $('.leftpane').css("left", '60%');
                $('.leftpane').css("right", '0');
                $('.leftpane').css("width", '40%');
                $('.rightpane').css("right", '40%');
                $('.rightpane').css("left", '0');
                $('.rightpane').css("width", '60%');
                $('.order').css("max-width", "100%")
                $('.pos-logo').replaceWith();
                $('.username').replaceWith();
                $('.order-selector').replaceWith();
                $('.pos-branding').css("position", 'initial');
                $('.pos-rightheader').css("left", '92%')
                $('.pos-rightheader').css("right", 0)
                var image_url = window.location.origin + '/web/image?model=pos.config.image&field=image&id=';
                var images = self.pos.images;
                for (var i = 0; i < images.length; i++) {
                    images[i]['image_url'] = 'background-image:url(' + image_url + images[i]['id'] + ')';
                }
                var CustomerScreen = $(qweb.render('CustomerScreenWidget', {
                    widget: this,
                    images: self.pos.images,
                }));
                $('.rightpane').append(CustomerScreen);
                new Swiper('.gallery-top', {
                    spaceBetween: 10,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    autoplay: {
                        delay: self.pos.config.delay,
                        disableOnInteraction: false,
                    }
                });
                new Swiper('.gallery-thumbs', {
                    spaceBetween: 10,
                    centeredSlides: true,
                    slidesPerView: 'auto',
                    touchRatio: 0.2,
                    slideToClickedSlide: true,
                    autoplay: {
                        delay: self.pos.config.delay,
                        disableOnInteraction: false,
                    }
                });
            }
        },
        // multi scanner barcode
        // controller of barcode scanner
        // Please dont change this function because
        // 1) we're have multi screen and multi barcode type
        // 2) at each screen we're have difference scan and parse code
        // 3) default of odoo always fixed high priority for scan products

        barcode_product_action: function (code) {
            var current_screen = this.pos.gui.get_current_screen();
            if (current_screen && current_screen == 'return_products') {
                this.scan_return_product(code);
            }
            if (current_screen && current_screen == 'login_page') {
                this.scan_barcode_user(code);
            }
            if (current_screen != 'return_products' && current_screen != 'login_page') {
                return this._super(code)
            }
        },
        barcode_order_return_action: function (datas_code) {
            if (datas_code && datas_code['type']) {
                console.log('{scanner}' + datas_code.type);
            }
            if (datas_code.type == 'order') {
                var order = this.pos.db.order_by_ean13[datas_code['code']]
                var order_lines = this.pos.db.lines_by_order_id[order.id];
                if (!order_lines) {
                    this.barcode_error_action(datas_code);
                    return false;
                } else {
                    this.gui.show_popup('popup_return_pos_order_lines', {
                        order_lines: order_lines,
                        order: order
                    });
                    return true
                }
            }
        }
    });

    screens.ScaleScreenWidget.include({
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var current_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                return this._super()
            } else {
                return current_pricelist
            }
        }
    });
    screens.OrderWidget.include({
        init: function (parent, options) {
            var self = this;
            this.mouse_down = false;
            this.moved = false;
            this.auto_tooltip;
            this._super(parent, options);
            this.line_mouse_down_handler = function (event) {
                self.line_mouse_down(this.orderline, event);
            };
            this.line_mouse_move_handler = function (event) {
                self.line_mouse_move(this.orderline, event);
            };
        },
        // if config lock when print receipt
        // we'll lock order
        change_selected_order: function () {
            var res = this._super();
            var order = this.pos.get_order();
            if (order.lock && this.pos.config.lock_order_printed_receipt) {
                this.pos.lock_order();
            } else {
                this.pos.unlock_order();
            }
        },
        touch_start: function (product, x, y) {
            var self = this;
            this.auto_tooltip = setTimeout(function () {
                if (!self.moved) {
                    var inner_html = self.gui.screen_instances.products.product_list_widget.generate_html(product);
                    $('.product-screen').prepend(inner_html);
                    $(".close_button").on("click", function () {
                        $('#info_tooltip').remove();
                    });
                }
            }, 30);
        },
        touch_end: function () {
            if (this.auto_tooltip) {
                clearTimeout(this.auto_tooltip);
            }
        },
        line_mouse_down: function (line, event) {
            var self = this;
            if (event.which == 1) {
                $('#info_tooltip').remove();
                self.moved = false;
                self.mouse_down = true;
                self.touch_start(line.product, event.pageX, event.pageY);
            }
        },
        line_mouse_move: function (line, event) {
            var self = this;
            if (self.mouse_down) {
                self.moved = true;
            }

        },
        render_orderline: function (orderline) {
            var el_node = this._super(orderline);
            if (this.pos.config.tooltip) {
                el_node.addEventListener('mousedown', this.line_mouse_down_handler);
                el_node.addEventListener('mousemove', this.line_mouse_move_handler);
            }
            return el_node;
        },
        remove_orderline: function (order_line) {
            try {
                this._super(order_line);
            } catch (ex) {
                console.error(ex);
                return this.gui.show_popup('alert_result', {
                    title: 'Error',
                    body: ex,
                    timer: 5000,
                    confirm: function () {
                        return this.gui.close_popup();
                    },
                    cancel: function () {
                        return this.gui.close_popup();
                    }
                });
            }
        },
        set_value: function (val) {
            var self = this;
            var mode = this.numpad_state.get('mode');
            var order = this.pos.get_order();
            if (!order.get_selected_orderline()) {
                return this.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Please select line',
                    confirm: function () {
                        return this.gui.close_popup();
                    },
                    cancel: function () {
                        return this.gui.close_popup();
                    }
                });
            }
            // limit discount by cashiers
            if (mode == 'discount' && this.pos.config.discount_limit && order != undefined && order.get_selected_orderline() != undefined) {
                this.gui.show_popup('number', {
                    'title': _t('Are you sure apply discount ?'),
                    'value': self.pos.config.discount_limit_amount,
                    'confirm': function (discount) {
                        if (discount > self.pos.config.discount_limit_amount) {
                            self.pos.gui.close_popup();
                            return self.gui.show_popup('alert_confirm', {
                                title: _t('Limit discount'),
                                body: 'You can not set discount bigger than ' + self.pos.config.discount_limit_amount + '. Please contact admin for upgrade limit discount',
                                confirmButtonText: 'Yes',
                                cancelButtonText: 'Close',
                                confirm: function () {
                                    self.pos.gui.close_popup();
                                },
                                cancel: function () {
                                    self.pos.gui.close_popup();
                                }
                            })
                        } else {
                            order.get_selected_orderline().set_discount(discount);
                        }
                    }
                });
            } else {
                // validate
                var order = this.pos.get_order();
                if (mode == 'quantity' && this.pos.config.validate_discount_change && order && order.get_selected_orderline) {
                    return this.pos.gui.show_popup('password', {
                        confirm: function (value) {
                            if (value != this.pos.user.pos_security_pin) {
                                return this.pos.gui.show_popup('alert_result', {
                                    title: 'Wrong',
                                    body: 'Password not correct, please check pos secuirty pin'
                                })
                            } else {
                                order.get_selected_orderline().set_quantity(val);
                            }
                        }
                    })
                }
                if (mode == 'discount' && this.pos.config.validate_discount_change && order && order.get_selected_orderline) {
                    return this.pos.gui.show_popup('password', {
                        confirm: function (value) {
                            if (value != this.pos.user.pos_security_pin) {
                                return this.pos.gui.show_popup('alert_result', {
                                    title: 'Wrong',
                                    body: 'Password not correct, please check pos secuirty pin'
                                })
                            } else {
                                order.get_selected_orderline().set_discount(val);
                            }
                        }
                    })
                }
                if (mode == 'price' && this.pos.config.validate_discount_change && order && order.get_selected_orderline) {
                    return this.pos.gui.show_popup('password', {
                        confirm: function (value) {
                            if (value != this.pos.user.pos_security_pin) {
                                return this.pos.gui.show_popup('alert_result', {
                                    title: 'Wrong',
                                    body: 'Password not correct, please check pos secuirty pin'
                                })
                            } else {
                                var selected_orderline = order.get_selected_orderline();
                                selected_orderline.price_manually_set = true;
                                selected_orderline.set_unit_price(val);
                            }
                        }
                    })
                }
                this._super(val);
            }
        },
        set_lowlight_order: function (buttons) {
            for (var button_name in buttons) {
                buttons[button_name].highlight(false);
            }
        },
        update_summary: function () {
            this._super();
            var selected_order = this.pos.get_order();
            if (selected_order) {
                var buttons = this.getParent().action_buttons;
                // highlight button button combo
                if (selected_order.selected_orderline && buttons && buttons.button_combo) {
                    var is_combo = selected_order.selected_orderline.is_combo();
                    var has_combo_item_tracking_lot = selected_order.selected_orderline.has_combo_item_tracking_lot();
                    buttons.button_combo.highlight(is_combo);
                }
                // highlight button button combo add lot
                if (buttons && buttons.button_combo_item_add_lot) {
                    buttons.button_combo_item_add_lot.highlight(has_combo_item_tracking_lot);
                }
                // highlight button internal_transfer_button
                var can_do = selected_order.validation_order_can_do_internal_transfer();

                if (buttons && buttons.internal_transfer_button) {
                    buttons.internal_transfer_button.highlight(can_do);
                }
                // highlight button receipt to kitchen
                try {
                    var changes = selected_order.hasChangesToPrint();
                    if (buttons && buttons.button_kitchen_receipt_screen) {
                        buttons.button_kitchen_receipt_screen.highlight(changes);
                    }
                } catch (e) {

                }
                // update loyalty point
                var $loyalty_element = $(this.el).find('.summary .loyalty-information');
                var lines = selected_order.orderlines.models;
                if (!lines || lines.length == 0) {
                    console.log('rules null');
                    $loyalty_element.addClass('oe_hidden');
                    return;
                } else {
                    var client = selected_order.get_client();
                    var plus_point = selected_order.give_plus_point();
                    var redeem_point = selected_order.get_redeem_point();
                    if (client) {
                        this.el.querySelector('.plus_point').textContent = this.format_currency_no_symbol(plus_point);
                        this.el.querySelector('.redeem_point').textContent = this.format_currency_no_symbol(redeem_point);
                        var pos_loyalty_point = client['pos_loyalty_point'];
                        var remaining_point = pos_loyalty_point - redeem_point
                        this.el.querySelector('.remaining_point').textContent = this.format_currency_no_symbol(remaining_point);
                        selected_order.plus_point = plus_point;
                        selected_order.redeem_point = redeem_point;
                        if (client['pos_loyalty_point'] > selected_order.get_redeem_point() && buttons && buttons.reward_button) {
                            buttons.reward_button.highlight(true);
                        }
                        else if (client['pos_loyalty_point'] <= selected_order.get_redeem_point() && buttons && buttons.reward_button) {
                            buttons.reward_button.highlight(false);
                        }
                    } else {
                        selected_order.reset_plus_point();
                        selected_order.reset_redeem_point();
                        this.el.querySelector('.plus_point').textContent = '0';
                        this.el.querySelector('.redeem_point').textContent = '0';
                        this.el.querySelector('.remaining_point').textContent = '0';
                    }
                }
                // highlight button create PO
                if (buttons && buttons.button_create_purchase_order) {
                    buttons.button_create_purchase_order.highlight(true);
                }
                // highlight button create SO
                if (buttons && buttons.button_create_sale_order) {
                    buttons.button_create_sale_order.highlight(true);
                }
                // highlight button change unit of measure of line
                if (selected_order && selected_order.selected_orderline) {
                    var is_multi_unit = selected_order.selected_orderline.is_multi_unit_of_measure();
                    if (buttons && buttons.button_choice_uom) {
                        buttons.button_choice_uom.highlight(is_multi_unit);
                    }
                }
                // highlight button change variant of line
                if (selected_order && selected_order.selected_orderline) {
                    var is_multi_variant = selected_order.selected_orderline.is_multi_variant();
                    if (buttons && buttons.variant_button) {
                        buttons.variant_button.highlight(is_multi_variant);
                    }
                }
                // promotion
                if (selected_order.orderlines && selected_order.orderlines.length && this.pos.config.promotion == true && this.pos.config.promotion_ids.length) {
                    var lines = selected_order.orderlines.models;
                    var promotion_amount = 0;
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i]
                        if (line.promotion) {
                            promotion_amount += line.get_price_without_tax()
                        }
                    }
                    if (selected_order && this.el.querySelector('.promotion_amount')) {
                        this.el.querySelector('.promotion_amount').textContent = round_pr(promotion_amount, this.pos.currency.rounding);
                        selected_order.promotion_amount = round_pr(promotion_amount, this.pos.currency.rounding);
                    }
                    var active_promotion = selected_order.current_order_can_apply_promotion();
                    var can_apply = active_promotion['can_apply'];
                    if (buttons && buttons.button_promotion) {
                        buttons.button_promotion.highlight(can_apply);
                    }
                    var promotions_apply = active_promotion['promotions_apply'];
                    if (promotions_apply.length) {
                        var promotion_recommend_customer_html = qweb.render('promotion_recommend_customer', {
                            promotions: promotions_apply
                        });
                        $('.promotion_recommend_customer').html(promotion_recommend_customer_html);
                        $('.add_promotions').click(function () {
                            selected_order.compute_promotion();
                        });
                        $('.remove_promotions').click(function () {
                            selected_order.remove_promotions_applied();
                        });
                    } else {
                        $('.promotion_recommend_customer').html(""); // hide element promotion
                        selected_order.remove_promotions_applied(); // auto clean promotion lines if still on order lines
                    }
                }
                // set tag button
                if (selected_order && selected_order.selected_orderline) {
                    var is_has_tag = selected_order.selected_orderline.is_has_tags();
                    if (buttons && buttons.button_set_tags) {
                        buttons.button_set_tags.highlight(is_has_tag);
                    }
                }
                // voucher
                if (buttons && buttons.print_voucher && this.pos.config.iface_print_via_proxy) {
                    buttons.print_voucher.highlight(this.pos.config.iface_print_via_proxy);
                }
                // set note to display
                var $note = this.el.querySelector('.order-note');
                if ($note) {
                    $note.textContent = selected_order.get_note();
                }
                // set signature to screen
                var $signature = $('.signature');
                if ($signature) {
                    $signature.attr('src', selected_order.get_signature());
                }
                // highlight lock button
                if (buttons && buttons.button_lock_unlock_order) {
                    if (selected_order['lock']) {
                        buttons.button_lock_unlock_order.highlight(true);
                        buttons.button_lock_unlock_order.$el.html('<i class="fa fa-lock" /> UnLock Order')
                    } else {
                        buttons.button_lock_unlock_order.highlight(false);
                        buttons.button_lock_unlock_order.$el.html('<i class="fa fa-unlock" /> Lock Order')
                    }

                }
            }
            if (selected_order && selected_order.orderlines.length <= 0) {
                this.set_lowlight_order(this.getParent().action_buttons);
            }
        }
    });
    var vouchers_screen = screens.ScreenWidget.extend({
        template: 'vouchers_screen',

        init: function (parent, options) {
            this._super(parent, options);
            this.vouchers = options.vouchers;
        },
        show: function () {
            this._super();
            this.vouchers = this.pos.vouchers;
            this.render_vouchers();
            this.handle_auto_print();
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
                if (this.should_close_immediately()) {
                    this.click_back();
                }
            } else {
                this.lock_screen(false);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        should_close_immediately: function () {
            return this.pos.config.iface_print_via_proxy;
        },
        lock_screen: function (locked) {
            this.$('.back').addClass('highlight');
        },
        get_voucher_env: function (voucher) {
            var order = this.pos.get_order();
            var datas = order.export_for_printing();
            return {
                widget: this,
                pos: this.pos,
                order: order,
                datas: datas,
                voucher: voucher
            };
        },
        print_web: function () {
            window.print();
        },
        print_xml: function () {
            if (this.vouchers) {
                for (var i = 0; i < this.vouchers.length; i++) {
                    var voucher_xml = qweb.render('voucher_ticket_xml', this.get_voucher_env(this.vouchers[i]));
                    this.pos.proxy.print_receipt(voucher_xml);
                }
            }
        },
        print: function () {
            var self = this;
            if (!this.pos.config.iface_print_via_proxy) {
                this.lock_screen(true);
                setTimeout(function () {
                    self.lock_screen(false);
                }, 1000);

                this.print_web();
            } else {
                this.print_xml();
                this.lock_screen(false);
            }
        },
        click_back: function () {
            this.pos.gui.show_screen('products');
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                self.click_back();
            });
            this.$('.button.print').click(function () {
                self.print();
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_vouchers: function () {
            var $voucher_content = this.$('.pos-receipt-container');
            var url_location = window.location.origin + '/report/barcode/EAN13/';
            $voucher_content.empty(); // reset to blank content
            if (this.vouchers) {
                for (var i = 0; i < this.vouchers.length; i++) {
                    this.vouchers[i]['url_barcode'] = url_location + this.vouchers[i]['code'];
                    $voucher_content.append(
                        qweb.render('voucher_ticket_html', this.get_voucher_env(this.vouchers[i]))
                    );
                }
            }
        }
    });
    gui.define_screen({name: 'vouchers_screen', widget: vouchers_screen});

    // invoices screen
    var invoices_screen = screens.ScreenWidget.extend({
        template: 'invoices_screen',
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:invoice', function () {
                self.render_screen();
            })
        },
        show: function () {
            var self = this;
            this.render_screen();
            this.details_visible = false;
            this.invoice_selected = null;
            this._super();
            this.$('.invoice-list').delegate('.invoice-line', 'click', function (event) {
                self.invoice_select(event, $(this), parseInt($(this).data('id')));
            });
            this.$('.searchbox .search-invoice').click(function () {
                self.clear_search();
            });
            var invoices = [];
            for (var i = 0; i < this.pos.db.invoices.length; i++) {
                var invoice = this.pos.db.invoices[i];
                var partner = this.pos.db.get_partner_by_id(invoice.partner_id[0]);
                var label = invoice['number'] + ', ' + invoice['name'] + ', ' + partner['display_name']
                if (partner['email']) {
                    label += ', ' + partner['email']
                }
                if (partner['phone']) {
                    label += ', ' + partner['phone']
                }
                if (partner['mobile']) {
                    label += ', ' + partner['mobile']
                }
                invoices.push({
                    value: invoice['id'],
                    label: label
                })
            }
            var $search_box = $('.clientlist-screen .search-invoice >input');
            $search_box.autocomplete({
                source: invoices,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var invoice = self.pos.db.invoice_by_id[ui['item']['value']];
                        if (invoice) {
                            self.display_invoice_details('show', invoice);
                        }
                        setTimeout(function () {
                            self.clear_search();
                        }, 10);

                    }
                }
            });
        },
        invoice_select: function (event, $line, id) {
            var invoice = this.pos.db.get_invoice_by_id(id);
            this.$('.invoice-line .lowlight').removeClass('lowlight');
            if ($line.hasClass('highlight')) {
                $line.removeClass('highlight');
                $line.addClass('lowlight');
                this.display_invoice_details('hide', invoice);
            } else {
                this.$('.client-list .highlight').removeClass('highlight');
                $line.addClass('highlight');
                var y = event.pageY - $line.parent().offset().top;
                this.display_invoice_details('show', invoice, y);
            }
        },

        display_invoice_details: function (visibility, invoice, clickpos) {
            this.invoice_selected = invoice;
            var self = this;
            var contents = this.$('.invoice-details-contents');
            var parent = this.$('.client-list').parent();
            var scroll = parent.scrollTop();
            var height = contents.height();
            if (visibility === 'show') {
                contents.empty();
                contents.append($(qweb.render('invoice_detail', {widget: this, invoice: invoice})));
                var new_height = contents.height();
                if (!this.details_visible) {
                    // resize client list to take into account client details
                    parent.height('-=' + new_height);

                    if (clickpos < scroll + new_height + 20) {
                        parent.scrollTop(clickpos - 20);
                    } else {
                        parent.scrollTop(parent.scrollTop() + new_height);
                    }
                } else {
                    parent.scrollTop(parent.scrollTop() - height + new_height);
                }

                this.details_visible = true;
                this.$('.inv-print-invoice').click(function () { // print invoice
                    self.chrome.do_action('account.account_invoices', {
                        additional_context: {
                            active_ids: [self.invoice_selected['id']]
                        }
                    })
                });
                this.$('.inv-print-invoice-without-payment').click(function () { // print invoice without payment
                    self.chrome.do_action('account.account_invoices_without_payment', {
                        additional_context: {
                            active_ids: [self.invoice_selected['id']]
                        }
                    })
                });
                this.$('.inv-send-email').click(function () { // send email invoice to customer

                });

                this.$('.inv-register-payment').click(function () { // register payment invoice
                    self.gui.show_popup('popup_invoice_register_payment', {
                        invoice: self.invoice_selected
                    })
                });
                this.$('.inv-action_invoice_open').click(function () { // action inv open
                    return rpc.query({
                        model: 'account.invoice',
                        method: 'action_invoice_open',
                        args: [self.invoice_selected['id']]
                    }).then(function (result) {
                        var message = '<a class="so_link" target="_blank" href="' + window.location.origin + '/web#id=' + self.invoice_selected['id'] + '&view_type=form&model=account.invoice">';
                        message += self.invoice_selected['number'] + '(Click)</a>';
                        return self.gui.show_popup('alert_confirm', {
                            title: message,
                            body: 'Click open new tab review invoice',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'No',
                            confirm: function () {
                                self.pos.gui.close_popup();
                            },
                            cancel: function () {
                                self.pos.gui.close_popup();
                            }
                        });
                    }).fail(function (type, error) {
                        self.gui.show_popup('notify_popup', {
                            title: 'ERROR',
                            from: 'top',
                            align: 'center',
                            body: 'Odoo server have problem',
                            color: 'danger',
                            timer: 2000
                        });
                    });

                });
                this.$('.inv-add-credit-note').click(function () {
                    self.gui.show_popup('popup_account_invoice_refund', {
                        invoice: self.invoice_selected,
                    })
                });
                this.$('.inv-cancel').click(function () {
                    self.gui.show_popup('popup_account_invoice_cancel', {
                        invoice: self.invoice_selected,
                    })

                });
            } else if (visibility === 'hide') {
                contents.empty();
                parent.height('100%');
                if (height > scroll) {
                    contents.css({height: height + 'px'});
                    contents.animate({height: 0}, 400, function () {
                        contents.css({height: ''});
                    });
                } else {
                    parent.scrollTop(parent.scrollTop() - height);
                }
                this.details_visible = false;
            }
        },
        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            if (this.pos.db.invoices.length) {
                this.render_invoice_list(this.pos.db.invoices);
            }
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.search-invoice input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function () {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
        },
        perform_search: function (query, associate_result) {
            if (query) {
                var invoices = this.pos.db.search_invoice(query);
                this.render_invoice_list(invoices);
            }
        },
        clear_search: function () {
            var invoices = this.pos.db.invoices;
            this.render_invoice_list(invoices);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        render_invoice_list: function (invoices) {
            var contents = this.$el[0].querySelector('.invoice-list');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(invoices.length, 1000); i < len; i++) {
                var invoice = invoices[i];
                var invoice_html = qweb.render('invoice_line', {
                    widget: this,
                    invoice: invoice
                });
                invoice = document.createElement('tbody');
                invoice.innerHTML = invoice_html;
                invoice = invoice.childNodes[1];
                contents.appendChild(invoice);
            }
        }
    });
    gui.define_screen({name: 'invoices', widget: invoices_screen});

    // validation payment
    screens.ActionpadWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.pay').click(function () {
                if (self.pos.config.validate_payment) {
                    self.pos.gui.show_screen('products');
                    return self.pos.gui.show_popup('password', {
                        confirm: function (value) {
                            if (value != this.pos.user.pos_security_pin) {
                                return this.pos.gui.show_popup('alert_result', {
                                    title: 'Wrong',
                                    body: 'Password not correct, please check pos secuirty pin'
                                })
                            } else {
                                return this.pos.gui.show_screen('payment');
                            }
                        }
                    })
                }
            });
        }
    });

    var return_products = screens.ScreenWidget.extend({ // return products screen
        template: 'return_products',
        start: function () {
            this.products_return = [];
            this._super();
            this.render_screen();
        },
        show: function () {
            var self = this;
            this._super();
            var products = [];
            for (var i = 0; i < this.pos.products.length; i++) {
                var product = this.pos.products[i];
                var label = "";
                if (product['default_code']) {
                    label += '[' + product['default_code'] + ']'
                }
                if (product['barcode']) {
                    label += '[' + product['barcode'] + ']'
                }
                if (product['display_name']) {
                    label += '[' + product['display_name'] + ']'
                }
                products.push({
                    value: product['id'],
                    label: label
                })
            }
            var $search_box = $('.search_return_products >input');
            $search_box.autocomplete({
                source: products,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var product_selected = self.pos.db.product_by_id[ui['item']['value']];
                        if (product_selected) {
                            self.add_product(product_selected);
                        }
                    }
                }
            });
        },
        scan_return_product: function (datas) {
            var product_selected = this.pos.db.product_by_barcode[datas['code']];
            if (product_selected) {
                this.add_product(product_selected);
                return true;
            } else {
                this.barcode_error_action(datas);
                return false;
            }
        },
        add_product: function (product_selected) {
            var self = this;
            if (product_selected) {
                var product_exsit = _.find(this.products_return, function (product) {
                    return product['id'] == product_selected['id']
                });
                var products = _.filter(this.products_return, function (product) {
                    return product['id'] != product_selected['id']
                });
                if (product_exsit) {
                    if (!product_exsit['quantity_return']) {
                        product_exsit['quantity_return'] = 1
                    } else {
                        product_exsit['quantity_return'] += 1
                    }

                } else {
                    product_selected['quantity_return'] = 1;
                    products.push(product_selected);
                    this.products_return = products;
                }
                this.render_products_return();
                setTimeout(function () {
                    self.$('.searchbox input')[0].value = '';
                }, 10);
            }
        },

        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
            var $confirm_return = this.$('.confirm_return');
            $confirm_return.click(function () {
                if (self.products_return.length <= 0) {
                    return self.pos.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Lines list empty, please find products'
                    })
                }
                var $return_journal_id = $('#return_journal_id').val();
                var return_journal_id = parseInt($return_journal_id);
                var return_payment_register = _.find(self.pos.cashregisters, function (cashregister) {
                    return cashregister.journal['id'] == return_journal_id;
                });
                var order = self.pos.get_order();
                if (return_payment_register && order) {
                    order['is_return'] = true;
                    for (var i = 0; i < order.orderlines.models.length + 1; i++) {
                        order.remove_orderline(order.orderlines.models[i]);
                    }
                    for (var i = 0; i < order.paymentlines.models.length + 1; i++) {
                        order.paymentlines.remove(order.paymentlines.models[i]);
                    }
                    order.remove_orderline(order.orderlines.models[0]);
                    order.remove_orderline(order.orderlines.models[0]);
                    for (var i = 0; i < self.products_return.length; i++) {
                        var product = self.products_return[i];
                        var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                        line['is_return'] = true;
                        order.orderlines.add(line);
                        var price_return = product['price_return'] || product['list_price'];
                        line.set_unit_price(price_return);
                        line.set_quantity(-product['quantity_return'], 'keep price when return');
                    }
                    var return_paymentline = new models.Paymentline({}, {
                        order: order,
                        cashregister: return_payment_register,
                        pos: self.pos
                    });
                    var amount = order.get_total_with_tax();
                    return_paymentline.set_amount(amount);
                    order.paymentlines.add(return_paymentline);
                    order.trigger('change', order);
                    return self.gui.show_screen('payment');
                } else {
                    return self.pos.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Return Mode not selected, please select again'
                    })
                }
            });
        },
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        render_products_return: function () {
            var self = this;
            var contents = this.$el[0].querySelector('tbody');
            contents.innerHTML = "";
            for (var i = 0; i < this.products_return.length; i++) {
                var product = this.products_return[i];
                var product_html = qweb.render('product_return_row', {
                    widget: this,
                    product: product
                });
                product = document.createElement('tbody');
                product.innerHTML = product_html;
                product = product.childNodes[1];
                contents.appendChild(product);
            }
            $('.product_row .quantity').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var product = _.find(self.products_return, function (product) {
                    return product['id'] == product_id;
                });
                var html = '<div class="form-group">' + '<input value="' + (product['qty_return'] || 0) + '" id="qty_return" type="number" class="form-control voucher" />' + '</div>'
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Quantity'),
                    html: html,
                    body: 'Please input quantity need return',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No',
                    confirm: function () {
                        var $quantity_return = $('#qty_return').val();
                        var quantity_return = parseFloat($quantity_return);
                        var product = _.find(self.products_return, function (product) {
                            return product['id'] == product_id;
                        });
                        if (product) {
                            product['quantity_return'] = quantity_return;
                        }
                        self.render_products_return();
                    },
                    cancel: function () {

                    }
                })
            });
            $('.product_row .edit_amount').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var product = _.find(self.products_return, function (product) {
                    return product['id'] == product_id;
                });
                var html = '<div class="form-group">' + '<input value="' + (product['price_return'] || 0) + '" id="price_return" type="number" class="form-control voucher" />' + '</div>'
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Amount return'),
                    html: html,
                    body: 'Please input amount',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No',
                    confirm: function () {
                        var $price_return = $('#price_return').val();
                        var price_return = parseFloat($price_return);
                        var product = _.find(self.products_return, function (product) {
                            return product['id'] == product_id;
                        });
                        if (product) {
                            product['price_return'] = price_return;
                        }
                        self.render_products_return();
                    },
                    cancel: function () {

                    }
                })
            });
            $('.product_row .remove').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var products = _.filter(self.products_return, function (product) {
                    return product['id'] !== product_id;
                });
                self.products_return = products;
                self.render_products_return();
            });
        }

    });
    gui.define_screen({name: 'return_products', widget: return_products});

    // daily report screen
    var daily_report = screens.ScreenWidget.extend({
        template: 'daily_report',
        start: function () {
            this.line_selected = [];
            this._super();
            this.render_screen();
        },
        show: function () {
            var self = this;
            if (this.line_selected.length == 0) {
                this.line_selected = this.pos.db.pos_order_lines
            }
            this._super();
            $('.search-clear').click();
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
            var users = this.pos.users;
            var users_list = [];
            for (var i = 0; i < users.length; i++) {
                var user = users[i];
                var label = user.name;
                users_list.push({
                    value: user['id'],
                    label: label
                })
            }
            var $search_box = $('.search_user >input');
            $search_box.autocomplete({
                source: users_list,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var user_id = ui['item']['value'];
                        var user = self.pos.user_by_id[user_id];
                        self.line_selected = _.filter(self.pos.db.pos_order_lines, function (line) {
                            return line['create_uid'][0] == user_id;
                        });
                        setTimeout(function () {
                            $('.search_user input')[0].value = user['display_name'];
                        }, 100);
                        var start_date = $('#start_date').val();
                        var end_date = $('#end_date').val();
                        self.$('.pos-receipt-container').empty();
                        if (start_date && end_date) {
                            self.line_selected = _.filter(self.line_selected, function (line) {
                                return line['create_date'] >= start_date && line['create_date'] <= end_date
                            })
                        }
                        self.render_report();
                    }
                }
            });
        },
        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            this.render_report();
            $('.back').click(function () {
                self.pos.gui.show_screen('products');
            });
            $('.search-clear').click(function () {
                self.line_selected = self.pos.db.pos_order_lines;
                self.render_report();
            });
            $('.print_daily_report').click(function () {
                var start_date = $('#start_date').val();
                var end_date = $('#end_date').val();
                if (start_date && end_date) {
                    self.line_selected = _.filter(self.line_selected, function (line) {
                        return line['create_date'] >= start_date && line['create_date'] <= end_date
                    })
                }
                self.$('.pos-receipt-container').empty();
                if (self.line_selected.length == 0) {
                    return self.pos.gui.show_popup('alert_result', {
                        title: 'Warning',
                        body: 'Your filter have any data for print'
                    })
                } else {
                    self.render_report(true);
                }

            });
        },
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        render_report: function (print_xml) {
            var $daily_report = this.$('.pos-receipt-container');
            var line_selected = this.line_selected;
            var orderlines_by_user_id = {};
            for (var i = 0; i < line_selected.length; i++) {
                var line = line_selected[i];
                if (!orderlines_by_user_id[line['create_uid'][0]]) {
                    orderlines_by_user_id[line['create_uid'][0]] = [line]
                } else {
                    orderlines_by_user_id[line['create_uid'][0]].push(line)
                }
            }
            var datas = [];
            for (user_id in orderlines_by_user_id) {
                var user = this.pos.user_by_id[user_id];
                var orderlines = orderlines_by_user_id[user_id];
                var amount_total = 0;
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    amount_total += line['price_unit'] * line['qty']
                }
                if (user) {
                    datas.push({
                        user: user,
                        orderlines: orderlines,
                        amount_total: amount_total
                    })
                }
            }
            if (datas.length) {
                var report_html = qweb.render('daily_report_user_html', {
                    datas: datas,
                    pos: this.pos,
                    widget: this
                });
                $daily_report.html(report_html)
                if (print_xml) {
                    var report_xml = qweb.render('daily_report_user_xml', {
                        datas: datas,
                        pos: this.pos,
                        widget: this
                    });
                    this.pos.proxy.print_receipt(report_xml);
                }
            }
        }

    });
    gui.define_screen({name: 'daily_report', widget: daily_report});

    var kitchen_receipt_screen = screens.ScreenWidget.extend({
        template: 'kitchen_receipt_screen',
        show: function () {
            this._super();
            var self = this;
            this.render_receipt();
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.next').removeClass('highlight');
            } else {
                this.$('.next').addClass('highlight');
            }
        },
        get_receipt_all_printer_render_env: function () {
            var order = this.pos.get_order();
            var printers = this.pos.printers;
            var item_new = [];
            var item_cancelled = [];
            var table = null;
            var floor = null;
            for (var i = 0; i < printers.length; i++) {
                var changes = order.computeChanges(printers[i].config.product_categories_ids);
                table = changes['table'];
                floor = changes['floor'];
                for (var i = 0; i < changes['new'].length; i++) {
                    item_new.push(changes['new'][i]);
                }
                for (var i = 0; i < changes['cancelled'].length; i++) {
                    item_cancelled.push(changes['cancelled'][i]);
                }
            }
            return {
                widget: this,
                table: table,
                floor: floor,
                new_items: item_new,
                cancelled_items: item_cancelled
            }
        },
        get_receipt_filter_by_printer_render_env: function (printer) {
            var order = this.pos.get_order();
            var item_new = [];
            var item_cancelled = [];
            var changes = order.computeChanges(printer.config.product_categories_ids);
            for (var i = 0; i < changes['new'].length; i++) {
                item_new.push(changes['new'][i]);
            }
            for (var i = 0; i < changes['cancelled'].length; i++) {
                item_cancelled.push(changes['cancelled'][i]);
            }
            return {
                widget: this,
                table: changes['table'] || null,
                floor: changes['floor'] || null,
                new_items: item_new,
                cancelled_items: item_cancelled,
                time: changes['time']
            }
        },
        print_web: function () {
            var self = this;
            this.lock_screen(true);
            setTimeout(function () {
                self.lock_screen(false);
            }, 1000);
            window.print();
        },
        click_back: function () {
            this.pos.gui.show_screen('products');
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                self.click_back();
            });
            this.$('.button.print-kitchen-receipt').click(function () {
                self.print_web();
            });
        },
        render_receipt: function () {
            var values = this.get_receipt_all_printer_render_env();
            this.$('.pos-receipt-container').html(qweb.render('kitchen_receipt', values));
            var printers = this.pos.printers;
            for (var i = 0; i < printers.length; i++) {
                var value = this.get_receipt_filter_by_printer_render_env(printers[i]);
                if (value['new_items'].length > 0 || value['cancelled_items'].length > 0) {
                    var receipt = qweb.render('kitchen_receipt_xml', value);
                    printers[i].print(receipt);
                }
                this.pos.get_order().saveChanges();
            }
        }
    });

    gui.define_screen({name: 'kitchen_receipt_screen', widget: kitchen_receipt_screen});

    // login page
    var login_page = screens.ScreenWidget.extend({
        template: 'login_page',

        start: function () {
            this._super();
        },
        login: function () {
            var pos_security_pin = $('#pos_security_pin').val();
            if (this.pos.user.pos_security_pin == false) {
                return this.gui.show_popup('alert_result', {
                    title: 'Warning',
                    body: 'Your account not set pos security pin'
                });
            }
            if (pos_security_pin == this.pos.user.pos_security_pin) {
                $('.pos-topheader').removeClass('oe_hidden');
                $('#pos_security_pin').value = '';
                var default_screen = this.pos.default_screen;
                var startup_screen = this.gui.startup_screen;
                this.gui.set_default_screen(default_screen);
                this.gui.set_startup_screen(startup_screen);
                this.gui.show_screen(default_screen);
            } else {
                return this.gui.show_popup('alert_result', {
                    title: 'Wrong',
                    body: 'Wrong pos security pin, please check again'
                });
            }
        },
        show: function () {
            var self = this;
            $('#password').focus();
            this.$('.confirm-login').click(function () {
                self.login()
            });
            this.$('.confirm-logout').click(function () {
                self.gui._close();
            });
            $('.pos-topheader').addClass('oe_hidden');
            this.pos.barcode_reader.set_action_callback({
                'login_security': _.bind(self.scan_barcode_pos_security_pin, self)
            });
            this._super();
        },
        scan_barcode_pos_security_pin: function (datas) {
            var barcode = datas['code'];
            if (this.pos.user['barcode'] == barcode) {
                $('.pos-topheader').removeClass('oe_hidden');
                $('#pos_security_pin').value = '';
                var default_screen = this.pos.default_screen;
                var startup_screen = this.gui.startup_screen;
                this.gui.set_default_screen(default_screen);
                this.gui.set_startup_screen(startup_screen);
                this.gui.show_screen(default_screen);
                return true
            } else {
                this.barcode_error_action(datas);
                return false;
            }
        }
    });
    gui.define_screen({
        name: 'login_page',
        widget: login_page
    });

    // orders screen
    var orders_screen = screens.ScreenWidget.extend({
        template: 'orders_screen',
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:order', function () {
                self.render_screen();
            })
        },
        show: function () {
            this.render_screen();
            this._super();
        },
        render_screen: function () {
            this.pos.quotation_selected = null;
            var self = this;
            if (this.pos.db.orders_store.length) {
                this.render_list(this.pos.db.orders_store);
            }
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.order-list').delegate('.pos_order_row', 'click', function (event) {
                self.pos_order_select(event, $(this), parseInt($(this).data('id')));
            });
            this.$('.search-quotation input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function () {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
            var orders_filters = [];
            for (var i = 0; i < this.pos.db.orders_store.length; i++) {
                var order = this.pos.db.orders_store[i];
                var label = order['name'];
                if (order['ean13']) {
                    label += ', ' + order['ean13']
                }
                if (order['pos_reference']) {
                    label += ', ' + order['pos_reference']
                }
                if (order.partner_id) {
                    var partner = this.pos.db.get_partner_by_id(order.partner_id[0]);
                    if (partner) {
                        label += ', ' + partner['name'];
                        if (partner['email']) {
                            label += ', ' + partner['email']
                        }
                        if (partner['phone']) {
                            label += ', ' + partner['phone']
                        }
                        if (partner['mobile']) {
                            label += ', ' + partner['mobile']
                        }
                    }

                }
                if (order['note']) {
                    label += ', ' + order['note'];
                }
                orders_filters.push({
                    value: order['id'],
                    label: label
                })
            }
            var $search_box = $('.search-pos-order >input');
            $search_box.autocomplete({
                source: orders_filters,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var order = self.pos.db.order_by_id[ui['item']['value']];
                        if (order) {
                            self.display_pos_order_detail('show', order);
                        }
                        setTimeout(function () {
                            self.clear_search();
                        }, 10);

                    }
                }
            });
        },
        perform_search: function (query, associate_result) {
            var orders;
            if (query) {
                orders = this.pos.db.search_order(query);
                this.render_list(orders);
            }
        },
        clear_search: function () {
            var orders = this.pos.db.orders_store;
            this.render_list(orders);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        render_list: function (orders) {
            var self = this;
            var contents = this.$el[0].querySelector('.order-list');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                var order = orders[i];
                if (order.partner_id) {
                    order['partner'] = this.pos.db.partner_by_id[order['partner_id'][0]]
                } else {
                    order['partner'] = []
                }
                var order_html = qweb.render('pos_order', {
                    widget: this,
                    order: order
                });
                order = document.createElement('tbody');
                order.innerHTML = order_html;
                order = order.childNodes[1];
                contents.appendChild(order);
            }
        },
        pos_order_select: function (event, $order, id) {
            var order = this.pos.db.order_by_id[id];
            this.$('.pos_order_row .lowlight').removeClass('lowlight');
            if ($order.hasClass('highlight')) {
                $order.removeClass('highlight');
                $order.addClass('lowlight');
                this.display_pos_order_detail('hide', order);
            } else {
                this.$('.client-list .highlight').removeClass('highlight');
                $order.addClass('highlight');
                var y = event.pageY - $order.parent().offset().top;
                this.display_pos_order_detail('show', order, y);
            }
        },
        display_pos_order_detail: function (visibility, order, clickpos) {
            this.order_selected = order;
            var self = this;
            var contents = this.$('.pos-order-contents');
            var parent = this.$('.client-list').parent();
            var scroll = parent.scrollTop();
            var height = contents.height();
            if (visibility === 'show') {
                contents.empty();
                contents.append($(qweb.render('pos_order_detail', {widget: this, order: order})));
                var new_height = contents.height();
                if (!this.details_visible) {
                    // resize client list to take into account client details
                    parent.height('-=' + new_height);

                    if (clickpos < scroll + new_height + 20) {
                        parent.scrollTop(clickpos - 20);
                    } else {
                        parent.scrollTop(parent.scrollTop() + new_height);
                    }
                } else {
                    parent.scrollTop(parent.scrollTop() - height + new_height);
                }

                this.details_visible = true;
            } else if (visibility === 'hide') {
                contents.empty();
                parent.height('100%');
                if (height > scroll) {
                    contents.css({height: height + 'px'});
                    contents.animate({height: 0}, 400, function () {
                        contents.css({height: ''});
                    });
                } else {
                    parent.scrollTop(parent.scrollTop() - height);
                }
                this.details_visible = false;
            }
            // action object
            $('.return-order').click(function () {
                var order = self.order_selected;
                var order_lines = self.pos.db.lines_by_order_id[order.id];
                if (!order_lines) {
                    return self.gui.show_popup('alert_confirm', {
                        title: 'Warning',
                        body: 'Could not find any lines of order',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'Close',
                        confirm: function () {
                            self.pos.gui.close_popup();
                        },
                        cancel: function () {
                            self.pos.gui.close_popup();
                        }
                    });
                } else {
                    return self.gui.show_popup('popup_return_pos_order_lines', {
                        order_lines: order_lines,
                        order: order
                    });
                }
            });
            $('.register-amount').click(function () {
                var pos_order = self.order_selected;
                if (pos_order) {
                    self.gui.show_popup('popup_register_payment', {
                        pos_order: pos_order
                    })
                }
            });
            $('.made-invoice').click(function () {
                var pos_order = self.order_selected;
                if (pos_order) {
                    return self.gui.show_popup('alert_confirm', {
                        title: 'Create Invoice for' + pos_order['name'],
                        body: 'Will made invoice for this order',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'Close',
                        confirm: function () {
                            self.pos.gui.close_popup();
                            return rpc.query({
                                model: 'pos.order',
                                method: 'made_invoice',
                                args:
                                    [[pos_order['id']]],
                                context: {
                                    pos: true
                                }
                            }).then(function (invoice_vals) {
                                var message = "<a class='so_link' target='_blank' href='" + window.location.origin + "/web#id=" + invoice_vals[0]['id'] + "&view_type=form&model=account.invoice'" + ">";
                                message += invoice_vals[0]['number'];
                                message += "</a>";
                                return self.gui.show_popup('alert_confirm', {
                                    title: message,
                                    body: 'Click for open new tab review invoice just created.',
                                    confirmButtonText: 'Yes',
                                    cancelButtonText: 'Close',
                                    confirm: function () {
                                        self.pos.gui.close_popup();
                                    },
                                    cancel: function () {
                                        self.pos.gui.close_popup();
                                    }
                                });
                            }).fail(function (type, error) {
                                return self.gui.show_popup('alert_confirm', {
                                    title: 'Error ',
                                    body: 'Could not made invoice',
                                    confirmButtonText: 'Yes',
                                    cancelButtonText: 'Close',
                                    confirm: function () {
                                        self.pos.gui.close_popup();
                                    },
                                    cancel: function () {
                                        self.pos.gui.close_popup();
                                    }
                                });
                            });
                        },
                        cancel: function () {
                            return self.pos.gui.close_popup();
                        }
                    });
                }
            });
            $('.reprint-order').click(function () {
                var order = self.order_selected;
                if (!order) {
                    return;
                }
                var json = {
                    'sequence_number': order['sequence_number'],
                    'name': order.name,
                    'partner_id': order.partner_id.id || null,
                    'lines': [],
                    'amount_total': order.amount_total,
                    'uid': order['uid'],
                    'statement_ids': [],
                    'id': order.id,
                    'ean13': order.ean13
                };
                var lines = self.pos.db.lines_by_order_id[order.id];
                if (lines) {
                    for (var i in lines) {
                        var line = lines[i];
                        json['lines'].push([0, 0, {
                            'price_unit': line.price_unit,
                            'qty': line.qty,
                            'product_id': line.product_id[0],
                            'discount': line.discount,
                            'pack_lot_ids': [],
                            'id': line.id
                        }])
                    }
                } else {
                    var lines = self.pos.db.lines_by_order_id[order['id']];
                    for (var i = 0; i < lines.length; i++) {
                        lines[i][2].qty = -lines[i][2].qty
                    }
                    json.lines = order.lines;
                }
                if (order) {
                    var order = new models.Order({}, {pos: self.pos, json: json, temporary: true});
                    if (self.pos.config.iface_print_via_proxy) {
                        var amount_paid = self.pos.db.order_by_ean13[ean13]['amount_paid'];
                        var amount_total = self.pos.db.order_by_ean13[ean13]['amount_total']
                        var amount_debit = amount_total - amount_paid;
                        var env = {
                            widget: self.pos,
                            pos: self.pos,
                            order: order,
                            receipt: order.export_for_printing(),
                            orderlines: order.get_orderlines(),
                            paymentlines: order.get_paymentlines(),
                            amount_paid: amount_paid,
                            amount_total: amount_total,
                            amount_debit: amount_debit

                        };
                        var receipt = qweb.render('XmlReceipt', env);
                        self.pos.proxy.print_receipt(receipt);
                    } else {
                        return self.gui.show_popup('alert_confirm', {
                            title: 'Warning ',
                            body: 'You have not set IP address of posbox or not active print receipt.',
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
                }
            });
        }
    });

    gui.define_screen({name: 'orders_screen', widget: orders_screen});

    // products operation screen
    var products_screen = screens.ScreenWidget.extend({
        template: 'products_screen',
        start: function () {
            var self = this;
            this._super();
            this.products = this.pos.products;
            this.product_by_id = {};
            this.product_by_string = "";
            this.save_products(this.products);
        },
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.product_cache = new screens.DomCache();
            this.pos.bind('product:updated', function (product_data) {
                var products = _.filter(self.products, function (product) {
                    return product['id'] != product_data['id'];
                })
                products.push(product_data);
                self.product_by_string = "";
                self.save_products(products);
            })
        },
        save_products: function (products) {
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                this.product_by_id[product['id']] = product;
                this.product_by_string += this.pos.db._product_search_string(product);
            }
        },
        search_products: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < 1000; i++) {
                var r = re.exec(this.product_by_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.product_by_id[id] !== undefined) {
                        results.push(this.product_by_id[id]);
                    } else {
                        var code = r
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        show: function () {
            var self = this;
            this._super();
            this.renderElement();
            this.details_visible = false;
            this.old_product = null;
            this.$('.back').click(function () {
                self.gui.back();
            });
            this.$('.new-product').click(function () {
                self.display_product_edit('show', {});
            });
            this.render_list(this.products);
            if (this.old_product) {
                this.display_product_edit('show', this.old_product, 0);
            }
            this.$('.client-list-contents').delegate('.product_row', 'click', function (event) {
                self.product_selected(event, $(this), parseInt($(this).data('id')));
            });
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function () {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-product').click(function () {
                self.clear_search();
            });
        },
        hide: function () {
            this._super();
        },
        perform_search: function (query, associate_result) {
            products = this.search_products(query);
            this.render_list(products);
        },
        clear_search: function () {
            this.render_list(this.products);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        render_list: function (products) {
            var self = this;
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(products.length, 1000); i < len; i++) {
                var product = products[i];
                var product_line_html = qweb.render('product_row', {widget: this, product: products[i]});
                var product_line = document.createElement('tbody');
                product_line.innerHTML = product_line_html;
                product_line = product_line.childNodes[1];
                this.product_cache.cache_node(product.id, product_line);
                if (product === this.old_product) {
                    product_line.classList.add('highlight');
                } else {
                    product_line.classList.remove('highlight');
                }
                contents.appendChild(product_line);
            }
            var products = [];
            for (var i = 0; i < this.products.length; i++) {
                var product = this.products[i];
                var label = "";
                if (product['default_code']) {
                    label = '[' + product['default_code'] + ']'
                }
                if (product['barcode']) {
                    label = '[' + product['barcode'] + ']'
                }
                if (product['display_name']) {
                    label = '[' + product['display_name'] + ']'
                }
                if (product['description']) {
                    label = '[' + product['description'] + ']'
                }
                products.push({
                    value: product['id'],
                    label: label
                })
            }
            var $search_box = $('.clientlist-screen .searchbox >input');
            $search_box.autocomplete({
                source: products,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var product = self.product_by_id(ui['item']['value']);
                        if (product) {
                            self.display_product_edit('show', product);
                        }
                        setTimeout(function () {
                            self.clear_search();
                        }, 100);
                    }
                }
            });
        },
        product_selected: function (event, $line, id) {
            var product = this.product_by_id[id];
            this.$('.client-list .lowlight').removeClass('lowlight');
            if ($line.hasClass('highlight')) {
                $line.removeClass('highlight');
                $line.addClass('lowlight');
                this.display_product_edit('hide', product);
            } else {
                this.$('.client-list .highlight').removeClass('highlight');
                $line.addClass('highlight');
                var y = event.pageY - $line.parent().offset().top;
                this.display_product_edit('show', product, y);
            }
        },

        // return url image for widget xml
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        // save product values to backend
        // trigger refesh products screen
        save_product_edit: function (product) {
            var self = this;
            var fields = {};
            this.$('.client-details-contents .detail').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields.name) {
                return this.pos.gui.show_popup('alert_result', {
                    title: 'Error',
                    body: 'A Product name is required'
                });
            }
            if (this.uploaded_picture) {
                fields.image = this.uploaded_picture.split(',')[1];
            }
            fields['list_price'] = parseFloat(fields['list_price']);
            fields['pos_categ_id'] = parseFloat(fields['pos_categ_id']);
            if (fields['id']) {
                rpc.query({
                    model: 'product.product',
                    method: 'write',
                    args: [[parseInt(fields['id'])], fields],
                })
                    .then(function (result) {
                        if (result == true) {
                            self.pos.gui.show_popup('alert_result', {
                                title: 'Saved',
                                body: 'Product saved'
                            })
                        }
                    }, function (type, err) {
                        self.pos.gui.show_popup('alert_result', {
                            title: 'Error',
                            body: 'Odoo connection fail, could not save'
                        })
                    });
            } else {
                rpc.query({
                    model: 'product.product',
                    method: 'create',
                    args: [fields],
                })
                    .then(function (product_id) {
                        self.$('.client-details-contents').hide();
                        self.pos.gui.show_popup('alert_result', {
                            title: 'Saved',
                            body: 'Product saved'
                        })
                    }, function (type, err) {
                        self.pos.gui.show_popup('alert_result', {
                            title: 'Error',
                            body: 'Odoo connection fail, could not save'
                        })
                    });
            }
        },
        // resizes an image, keeping the aspect ratio intact,
        // the resize is useful to avoid sending 12Mpixels jpegs
        // over a wireless connection.
        resize_image_to_dataurl: function (img, maxwidth, maxheight, callback) {
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var ratio = 1;

                if (img.width > maxwidth) {
                    ratio = maxwidth / img.width;
                }
                if (img.height * ratio > maxheight) {
                    ratio = maxheight / img.height;
                }
                var width = Math.floor(img.width * ratio);
                var height = Math.floor(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                var dataurl = canvas.toDataURL();
                callback(dataurl);
            };
        },
        // Loads and resizes a File that contains an image.
        // callback gets a dataurl in case of success.
        load_image_file: function (file, callback) {
            var self = this;
            if (!file.type.match(/image.*/)) {
                return this.pos.gui.show_popup('alert_result', {
                    title: 'Error',
                    body: 'Unsupported File Format, Only web-compatible Image formats such as .png or .jpeg are supported',
                    timer: 3000
                });
            }

            var reader = new FileReader();
            reader.onload = function (event) {
                var dataurl = event.target.result;
                var img = new Image();
                img.src = dataurl;
                self.resize_image_to_dataurl(img, 800, 600, callback);
            };
            reader.onerror = function () {
                return self.pos.gui.show_popup('alert_result', {
                    title: 'Error',
                    body: 'Could Not Read Image, The provided file could not be read due to an unknown error',
                    timer: 3000
                });
            };
            reader.readAsDataURL(file);
        },
        display_product_edit: function (visibility, product, clickpos) { // display product details to header page
            var self = this;
            var contents = this.$('.client-details-contents');
            contents.empty();
            if (visibility == 'show') {
                contents.append($(qweb.render('product_edit', {widget: this, product: product})));
                contents.find('.save').on('click', function (event) {
                    self.save_product_edit(event);
                });
                contents.find('.print_label').on('click', function (event) {
                    var fields = {};
                    $('.client-details-contents .detail').each(function (idx, el) {
                        fields[el.name] = el.value || false;
                    });
                    var product_id = fields['id'];
                    var product = self.pos.db.product_by_id[product_id];
                    if (product && product['barcode']) {
                        var product_label_html = qweb.render('product_label_xml', {
                            product: product
                        });
                        self.pos.proxy.print_receipt(product_label_html);
                        self.pos.gui.show_popup('alert_result', {
                            title: 'Printed barcode',
                            body: 'Please get product label at your printer'
                        })
                    } else {
                        self.pos.gui.show_popup('alert_result', {
                            title: 'Missing barcode',
                            body: 'Barcode of product not set'
                        })
                    }

                })
                this.$('.client-details-contents').show();
            }
            if (visibility == 'hide') {
                this.$('.client-details-contents').hide();
            }

            contents.find('input').blur(function () {
                setTimeout(function () {
                    self.$('.window').scrollTop(0);
                }, 0);
            });
            contents.find('.image-uploader').on('change', function (event) {
                self.load_image_file(event.target.files[0], function (res) {
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='" + res + "'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                    }
                });
            });
        },
        // close screen
        close: function () {
            this._super();
        }
    });
    gui.define_screen({name: 'productlist', widget: products_screen});

    screens.ReceiptScreenWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back_order').click(function () {
                var order = self.pos.get_order();
                if (order) {
                    self.pos.gui.show_screen('products');
                }
            });
        },
        show: function () {
            this._super();
            try {
                JsBarcode("#barcode", this.pos.get('selectedOrder').ean13, {
                    format: "EAN13",
                    displayValue: true,
                    fontSize: 20
                });
            } catch (error) {
            }
        }
    });

    screens.PaymentScreenWidget.include({
        renderElement: function () {
            var self = this;
            // Quickly Payment
            if (this.pos.quickly_datas) {
                this.quickly_datas = this.pos.quickly_datas;
            } else {
                this.quickly_datas = []
            }
            this._super();
            var order = this.pos.get_order();
            // Multi Currency
            order.selected_currency = this.pos.currency_by_id[this.pos.currency.id];
            this.$('.select-currency').on('change', function (e) {
                var currency_id = parseInt($('.select-currency').val());
                var selected_currency = self.pos.currency_by_id[currency_id];
                var company_currency = self.pos.currency_by_id[self.pos.currency['id']];
                //Return action if have not selected currency or company currency is 0
                if (!selected_currency || company_currency['rate'] == 0) {
                    return;
                }
                order.selected_currency = selected_currency;
                var currency_covert_text = company_currency['rate'] / selected_currency['rate'];
                // add current currency rate to payment screen
                var $currency_covert = self.el.querySelector('.currency-covert');
                if ($currency_covert) {
                    $currency_covert.textContent = '1 ' + selected_currency['name'] + ' = ' + currency_covert_text + ' ' + company_currency['name'];
                }
                var selected_paymentline = order.selected_paymentline;
                var default_register = _.find(self.pos.cashregisters, function (register) {
                    return register['journal']['pos_method_type'] == 'default';
                });
                if (selected_paymentline) {
                    selected_paymentline.set_amount("0");
                    self.inputbuffer = "";
                }
                if (!selected_paymentline && default_register) {
                    order.add_paymentline(default_register);
                }
                var due = order.get_due();
                var amount_full_paid = due * selected_currency['rate'] / company_currency['rate'];
                var due_currency = amount_full_paid;
                var $currency_paid_full = self.el.querySelector('.currency-paid-full');
                if ($currency_paid_full) {
                    $currency_paid_full.textContent = due_currency;
                }
                self.add_currency_to_payment_line();
                self.render_paymentlines();
            });
            this.$('.update-rate').on('click', function (e) {
                var currency_id = parseInt($('.select-currency').val());
                var selected_currency = self.pos.currency_by_id[currency_id];
                self.selected_currency = selected_currency;
                if (selected_currency) {
                    self.hide();
                    self.gui.show_popup('textarea', {
                        title: _t('Input Rate'),
                        value: self.selected_currency['rate'],
                        confirm: function (rate) {
                            var selected_currency = self.selected_currency;
                            selected_currency['rate'] = parseFloat(rate);
                            self.show();
                            self.renderElement();
                            var params = {
                                name: new Date(),
                                currency_id: self.selected_currency['id'],
                                rate: parseFloat(rate),
                            }
                            return rpc.query({
                                model: 'res.currency.rate',
                                method: 'create',
                                args:
                                    [params],
                                context: {}
                            }).then(function (rate_id) {
                                return rate_id;
                            }).then(function () {
                                self.gui.close_popup();
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
                                }
                            });
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            // Button Set Note
            this.$('.set-note').click(function () {
                var order = self.pos.get_order();
                if (order) {
                    self.hide();
                    self.gui.show_popup('textarea', {
                        title: _t('Add Order Note'),
                        value: order.get_note(),
                        confirm: function (note) {
                            order.set_note(note);
                            order.trigger('change', order);
                            self.show();
                            self.renderElement();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            // Signature on Order
            this.$('.payment-signature-order').click(function () {
                var order = self.pos.get_order();
                self.hide();
                self.gui.show_popup('popup_order_signature', {
                    order: order,
                    confirm: function (rate) {
                        self.show();
                    },
                    cancel: function () {
                        self.show();
                    }
                });

            });
            // Partial Payment
            this.$('.partial-pay').click(function () {
                var order = self.pos.get_order();
                if (order && !order.get_client()) {
                    return setTimeout(function () {
                        self.pos.gui.show_screen('clientlist');
                    }, 300);
                }
                if (order && order.get_client()) {
                    return self.gui.show_popup('alert_confirm', {
                        title: 'Partial Payment Oder',
                        body: 'When customer come back, and need payment full, you can find order at pos orders screen',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'Close',
                        confirm: function () {
                            self.pos.gui.close_popup();
                            self.pos.push_order(order);
                            self.gui.show_screen('receipt');
                        },
                        cancel: function () {
                            self.pos.gui.close_popup();
                        }
                    });

                }
            });
            // Click for Full Payment
            this.$('.full_payment').click(function () {
                var company_currency = self.pos.currency_by_id[self.pos.currency['id']];
                var order = self.pos.get_order();
                var selected_paymentline = order.selected_paymentline;
                var register = _.find(self.pos.cashregisters, function (register) {
                    return register['journal']['pos_method_type'] == 'default';
                });
                var amount_due = order.get_due();
                if (register) {
                    if (!selected_paymentline) {
                        order.add_paymentline(register);
                        selected_paymentline = order.selected_paymentline;
                    }
                    selected_paymentline.set_amount(amount_due);
                    self.order_changes();
                    self.render_paymentlines();
                    self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount_due));
                }
            });
            // input manual voucher
            this.$('.input_voucher').click(function () {
                self.hide();
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Input code'),
                    html: '<div class="form-group">' +
                    '<input id="input-field" type="text" class="form-control voucher" />' +
                    '</div>',
                    body: 'Made sure odoo server running and input correct code of voucher',
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No',
                    confirm: function () {
                        var code = $('.voucher').val();
                        self.show();
                        self.renderElement();
                        if (!code) {
                            return false;
                        } else {
                            return rpc.query({
                                model: 'pos.voucher',
                                method: 'get_voucher_by_code',
                                args: [code],
                            }).then(function (voucher) {
                                if (voucher == -1) {
                                    return self.gui.show_popup('alert_confirm', {
                                        title: 'Wrong',
                                        body: 'Code have not exist or expired date',
                                        confirmButtonText: 'Yes',
                                        cancelButtonText: 'Close',
                                        confirm: function () {
                                            self.pos.gui.close_popup();
                                        },
                                        cancel: function () {
                                            self.pos.gui.close_popup();
                                        }
                                    });
                                } else {
                                    var current_order = self.pos.get('selectedOrder');
                                    current_order.voucher_id = voucher.id;
                                    var voucher_register = _.find(self.pos.cashregisters, function (cashregister) {
                                        return cashregister.journal['pos_method_type'] == 'voucher';
                                    });
                                    if (voucher_register) {
                                        if (voucher['customer_id'] && voucher['customer_id'][0]) {
                                            var client = self.pos.db.get_partner_by_id(voucher['customer_id'][0]);
                                            if (client) {
                                                current_order.set_client(client)
                                            }
                                        }
                                        var amount = 0;
                                        if (voucher['apply_type'] == 'fixed_amount') {
                                            amount = voucher.value;
                                        } else {
                                            amount = current_order.get_total_with_tax() / 100 * voucher.value;
                                        }
                                        // remove old paymentline have journal is voucher
                                        var paymentlines = current_order.paymentlines;
                                        for (var i = 0; i < paymentlines.models.length; i++) {
                                            var payment_line = paymentlines.models[i];
                                            if (payment_line.cashregister.journal['pos_method_type'] == 'voucher') {
                                                payment_line.destroy();
                                            }
                                        }
                                        // add new payment with this voucher just scanned
                                        var voucher_paymentline = new models.Paymentline({}, {
                                            order: current_order,
                                            cashregister: voucher_register,
                                            pos: self.pos
                                        });
                                        voucher_paymentline.set_amount(amount);
                                        current_order.paymentlines.add(voucher_paymentline);
                                        current_order.trigger('change', current_order)
                                        self.render_paymentlines();
                                        self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount));
                                        return true;
                                    } else {
                                        return self.gui.show_popup('alert_confirm', {
                                            title: 'Warning',
                                            body: 'Could not add payment line because your system have not create journal have type voucher or journal voucher not add to your pos config',
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

                                }
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
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                });
            });
            // add wallet
            this.$('.add_wallet').click(function () {
                self.hide();
                var order = self.pos.get_order();
                var change = order.get_change();
                var wallet_register = _.find(self.pos.cashregisters, function (cashregister) {
                    return cashregister.journal['pos_method_type'] == 'wallet';
                });
                if (!change || change == 0) {
                    return self.pos.gui.show_popup('alert_input', {
                        title: _t('Order change empty'),
                        html: '',
                        confirmButtonText: 'Ok, keep',
                        cancelButtonText: 'No, validate order',
                        cancel: function () {
                            self.show();
                            self.renderElement();
                            return self.pos.gui.close_popup();
                        },
                        confirm: function () {
                            self.show();
                            self.renderElement();
                            return self.pos.gui.close_popup();
                        }
                    });
                }
                // no need add client
                // if (!order.get_client()) {
                //     return setTimeout(function () {
                //         self.pos.gui.show_screen('clientlist');
                //     }, 1);
                // }
                if (!wallet_register) {
                    return self.pos.gui.show_popup('alert_input', {
                        title: _t('Null'),
                        html: 'Wallet journal',
                        confirmButtonText: 'Ok, keep',
                        cancelButtonText: 'No, validate order',
                        cancel: function () {
                            self.show();
                            self.renderElement();
                            return self.pos.gui.close_popup();
                        },
                        confirm: function () {
                            self.show();
                            self.renderElement();
                            return self.pos.gui.close_popup();
                        }
                    });
                }
                if (order.finalized == false) {
                    self.gui.show_popup('number', {
                        'title': _t('Add to customer wallet'),
                        'value': change,
                        'confirm': function (value) {
                            if (value <= order.get_change()) {
                                var wallet_paymentline = new models.Paymentline({}, {
                                    order: order,
                                    cashregister: wallet_register,
                                    pos: self.pos
                                });
                                wallet_paymentline.set_amount(-value);
                                order.paymentlines.add(wallet_paymentline);
                                order.trigger('change', order);
                            }
                            self.show();
                            self.renderElement();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            // Quickly Payment
            this.$('.quickly-payment').click(function () {
                self.pos.cashregisters = self.pos.cashregisters.sort(function (a, b) {
                    return a.id - b.id;
                });
                var quickly_payment_id = parseInt($(this).data('id'));
                var quickly_payment = self.pos.quickly_payment_by_id[quickly_payment_id];
                var order = self.pos.get_order();
                var paymentlines = order.get_paymentlines();
                var open_paymentline = false;
                for (var i = 0; i < paymentlines.length; i++) {
                    if (!paymentlines[i].paid) {
                        open_paymentline = true;
                    }
                }
                if (self.pos.cashregisters.length == 0) {
                    return;
                }
                if (!open_paymentline) {
                    var register_random = _.find(self.pos.cashregisters, function (register) {
                        return register['journal']['pos_method_type'] == 'default';
                    });
                    if (register_random) {
                        order.add_paymentline(register_random);
                    } else {
                        return;
                    }
                }
                if (quickly_payment && order.selected_paymentline) {
                    var money = quickly_payment['amount'] + order.selected_paymentline['amount']
                    order.selected_paymentline.set_amount(money);
                    self.order_changes();
                    self.render_paymentlines();
                    self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(money));
                }
            });
        },
        add_currency_to_payment_line:

            function (line) {
                var order = this.pos.get_order();
                line = order.selected_paymentline;
                line.selected_currency = order.selected_currency;
            }
        ,

        render_paymentlines: function () {
            this._super();
            var order = this.pos.get_order();
            if (!order) {
                return;
            }
            var client = order.get_client();
            // Show || Hide Wallet method
            var wallet_register = _.find(this.pos.cashregisters, function (cashregister) {
                return cashregister.journal.pos_method_type == 'wallet';
            });
            if (wallet_register) {
                // if change amount > 0 or client wallet > 0, display payment method
                // else disable
                var change = order.get_change();
                var journal_id = wallet_register.journal.id;
                var $journal_element = $("[data-id='" + journal_id + "']");
                if (client && client['wallet'] > 0) {
                    $journal_element.removeClass('oe_hidden');
                    $journal_element.html('<span class="wallet">[Wallet card] ' + this.format_currency(client.wallet) + '</span>');
                } else {
                    $journal_element.addClass('oe_hidden');
                }
            }
            // Show || Hide credit method
            var credit_register = _.find(this.pos.cashregisters, function (cashregister) {
                return cashregister.journal['pos_method_type'] == 'credit';
            });
            if (credit_register) {
                if (!client || (client.balance - client.limit_debit <= 0)) {
                    var credit_journal_content = $("[data-id='" + credit_register.journal.id + "']");
                    credit_journal_content.addClass('oe_hidden');
                } else {
                    var credit_journal_content = $("[data-id='" + credit_register.journal.id + "']");
                    credit_journal_content.removeClass('oe_hidden');
                    credit_journal_content.html('<span class="credit">[Credit card] ' + this.format_currency(client.balance) + '</span>');
                }
            }

            // Show || Hide Return method
            // find return journal inside this pos
            // if current order is not return order, hide journal
            var cash_register = _.find(this.pos.cashregisters, function (cashregister) {
                return cashregister.journal['pos_method_type'] == 'return';
            });
            if (cash_register && order) {
                var return_order_journal_id = cash_register.journal.id;
                var return_order_journal_content = $("[data-id='" + return_order_journal_id + "']");
                if (!order['is_return']) {
                    return_order_journal_content.addClass('oe_hidden');
                } else {
                    return_order_journal_content.removeClass('oe_hidden');
                }
            }
            // Show || Hide Voucher method
            // find voucher journal inside this pos
            // and hide this voucher element, because if display may be made seller confuse
            var voucher_journal = _.find(this.pos.cashregisters, function (cashregister) {
                return cashregister.journal['pos_method_type'] == 'voucher';
            });
            if (voucher_journal) {
                var voucher_journal_id = voucher_journal.journal.id;
                var voucher_journal_content = $("[data-id='" + voucher_journal_id + "']");
                voucher_journal_content.addClass('oe_hidden');
            }
        }
        ,

        // Active device scan barcode voucher
        show: function () {
            var self = this;
            this._super();
            this.pos.barcode_reader.set_action_callback({
                'voucher': _.bind(self.barcode_voucher_action, self),
            });
        }
        ,
        // scan voucher viva device
        barcode_voucher_action: function (datas) {
            var self = this;
            this.datas_code = datas;
            rpc.query({
                model: 'pos.voucher',
                method: 'get_voucher_by_code',
                args: [datas['code']],
            }).then(function (voucher) {
                if (voucher == -1) {
                    self.barcode_error_action(self.datas_code);
                    return false;
                } else {
                    var current_order = self.pos.get('selectedOrder');
                    current_order.voucher_id = voucher.id;
                    var voucher_register = _.find(self.pos.cashregisters, function (cashregister) {
                        return cashregister.journal['pos_method_type'] == 'voucher';
                    });
                    if (voucher_register) {
                        if (voucher['customer_id'] && voucher['customer_id'][0]) {
                            var client = self.pos.db.get_partner_by_id(voucher['customer_id'][0]);
                            if (client) {
                                current_order.set_client(client)
                            }
                        }
                        var amount = 0;
                        if (voucher['apply_type'] == 'fixed_amount') {
                            amount = voucher.value;
                        } else {
                            amount = current_order.get_total_with_tax() / 100 * voucher.value;
                        }
                        // remove old paymentline have journal is voucher
                        var paymentlines = current_order.paymentlines;
                        for (var i = 0; i < paymentlines.models.length; i++) {
                            var payment_line = paymentlines.models[i];
                            if (payment_line.cashregister.journal['pos_method_type'] == 'voucher') {
                                payment_line.destroy();
                            }
                        }
                        // add new payment with this voucher just scanned
                        var voucher_paymentline = new models.Paymentline({}, {
                            order: current_order,
                            cashregister: voucher_register,
                            pos: self.pos
                        });
                        voucher_paymentline.set_amount(amount);
                        current_order.paymentlines.add(voucher_paymentline);
                        current_order.trigger('change', current_order)
                        self.render_paymentlines();
                        self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount));
                    } else {
                        self.gui.show_popup('notify_popup', {
                            title: 'ERROR',
                            from: 'top',
                            align: 'center',
                            body: 'Please create 1 Journal Method with POS method type is Voucher, add to pos config, close session and re-start session.',
                            color: 'danger',
                            timer: 1000
                        });
                        return;
                    }

                }
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
            return true;
        }
        ,
        click_paymentmethods: function (id) {
            // id : id of journal
            var self = this;
            this._super(id);
            var order = this.pos.get_order();
            var selected_paymentline = order.selected_paymentline;
            var client = order.get_client();

            // if credit, wallet: require choice client the first
            if (selected_paymentline && selected_paymentline.cashregister && selected_paymentline.cashregister.journal['pos_method_type'] && (selected_paymentline.cashregister.journal['pos_method_type'] == 'wallet' || selected_paymentline.cashregister.journal['pos_method_type'] == 'credit') && !client) {
                return setTimeout(function () {
                    self.pos.gui.show_screen('clientlist');
                }, 30);
            }
            // method wallet
            var wallet_register_selected = _.find(this.pos.cashregisters, function (register) {
                return register.journal['pos_method_type'] == 'wallet' || register.journal['id'];
            });
            if (client && wallet_register_selected && selected_paymentline) {
                var change = order.get_change();
                selected_paymentline.set_amount(change);
            }
        }
        ,
        validate_order: function (force_validation) {
            var self = this;
            var order = this.pos.get_order();
            var wallet = 0;
            var use_wallet = false;
            var credit = 0;
            var use_credit = false;
            var payments_lines = order.paymentlines.models;
            var client = this.pos.get_order().get_client();
            if (client) {
                for (var i = 0; i < payments_lines.length; i++) {
                    var payment_line = payments_lines[i];
                    if (payment_line.cashregister.journal['pos_method_type'] && payment_line.cashregister.journal['pos_method_type'] == 'wallet') {
                        wallet += payment_line.get_amount();
                        use_wallet = true;
                    }
                    if (payment_line.cashregister.journal['pos_method_type'] && payment_line.cashregister.journal['pos_method_type'] == 'credit') {
                        credit += payment_line.get_amount();
                        use_credit = true;
                    }
                }
                if (client['wallet'] < wallet && use_wallet == true) {
                    return this.pos.gui.show_popup('alert_confirm', {
                        title: _t('Error'),
                        body: 'You can not set wallet bigger than ' + this.format_currency(client['wallet']),
                        confirmButtonText: 'Ok',
                        cancelButtonText: 'No, close',
                        confirm: function () {
                            return self.pos.gui.close_popup();
                        },
                        cancel: function () {
                            return self.pos.gui.close_popup();
                        }
                    })
                }
                if ((client['limit_debit'] > (client['balance'] - credit)) && use_credit == true) {
                    return this.pos.gui.show_popup('alert_confirm', {
                        title: _t('Error'),
                        body: 'Limit debit of customer not allow add payment line amount bigger than ' + this.format_currency(client['balance'] - client['limit_debit']),
                        confirmButtonText: 'Ok',
                        cancelButtonText: 'No, close',
                        confirm: function () {
                            return self.pos.gui.close_popup();
                        },
                        cancel: function () {
                            return self.pos.gui.close_popup();
                        }
                    })
                }
            }
            return this._super(force_validation);
        }
    });

    // receipt screeen review
    // review receipt
    // receipt review
    var receipt_review = screens.ScreenWidget.extend({
        template: 'receipt_review',
        show: function () {
            this._super();
            var self = this;
            this.render_change();
            this.render_receipt();
            this.handle_auto_print();
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
            } else {
                this.lock_screen(false);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto && !this.pos.get_order()._printed;
        },
        should_close_immediately: function () {
            return this.pos.config.iface_print_via_proxy && this.pos.config.iface_print_skip_screen;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.back').removeClass('highlight');
            } else {
                this.$('.back').addClass('highlight');
            }
        },
        get_receipt_render_env: function () {
            var order = this.pos.get_order();
            return {
                widget: this,
                pos: this.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines(),
            };
        },
        print_web: function () {
            window.print();
            this.pos.get_order()._printed = true;
        },
        print_xml: function () {
            var env = this.get_receipt_render_env();
            var receipt;
            if (this.pos.config.receipt_without_payment_template == 'display_price') {
                receipt = qweb.render('XmlReceipt', env);
            } else {
                receipt = qweb.render('xml_receipt_not_show_price', env);
            }
            this.pos.proxy.print_receipt(receipt);
            this.pos.get_order()._printed = true;
        },
        print: function () {
            var self = this;

            if (!this.pos.config.iface_print_via_proxy) { // browser (html) printing
                this.lock_screen(true);
                setTimeout(function () {
                    self.lock_screen(false);
                }, 1000);
                this.print_web();
            } else {    // proxy (xml) printing
                this.print_xml();
                this.lock_screen(false);
            }
        },

        click_back: function () {
            this.pos.gui.show_screen('products')
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
            });
            this.$('.button.print').click(function () {
                if (!self._locked) {
                    self.print();
                }
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_receipt: function () {
            this.$('.pos-receipt-container').html(qweb.render('pos_ticket_review', this.get_receipt_render_env()));
        }
    });
    gui.define_screen({name: 'receipt_review', widget: receipt_review});

    return {
        login_page: login_page
    };


});
