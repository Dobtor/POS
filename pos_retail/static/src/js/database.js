/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.database', function (require) {

    var db = require('point_of_sale.DB');

    db.include({
        init: function (options) {
            this._super(options);
            // pos orders
            this.order_by_id = {};
            this.orders_store = [];
            this.order_by_ean13 = {};
            this.order_search_string = "";
            this.lines_by_order_id = {};
            this.order_line_by_id = {};
            this.product_by_supplier_barcode = {};
            this.sequence = 1;
            this.pos_order_lines = [];
            // pos invoices
            this.invoices = [];
            this.invoice_by_id = {};
            this.invoices = [];
            this.invoice_by_partner_id = {};
            this.invoice_search_string = "";

        },

        // function support version 10, re-build price
        compute_price: function (product, pricelist, quantity) {
            var self = this;
            var date = moment().startOf('day');
            var category_ids = [];
            if (product.categ_id) {
                var category = this.category_by_id[product.categ_id[0]];
                while (category) {
                    category_ids.push(category.id);
                    category = category.parent;
                }
            }
            var pricelist_items = _.filter(pricelist.items, function (item) {
                return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id) &&
                    (!item.product_id || item.product_id[0] === self.id) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date));
            });
            var price = product['list_price'];
            _.find(pricelist_items, function (rule) {
                if (rule.min_quantity && quantity < rule.min_quantity) {
                    return false;
                }
                if (rule.base === 'pricelist') {
                    price = self.compute_price(product, rule.base_pricelist, quantity);
                } else if (rule.base === 'standard_price') {
                    price = self.standard_price;
                }
                if (rule.compute_price === 'fixed') {
                    price = rule.fixed_price;
                    return true;
                } else if (rule.compute_price === 'percentage') {
                    price = price - (price * (rule.percent_price / 100));
                    return true;
                } else {
                    var price_limit = price;
                    price = price - (price * (rule.price_discount / 100));
                    if (rule.price_round) {
                        price = round_pr(price, rule.price_round);
                    }
                    if (rule.price_surcharge) {
                        price += rule.price_surcharge;
                    }
                    if (rule.price_min_margin) {
                        price = Math.max(price, price_limit + rule.price_min_margin);
                    }
                    if (rule.price_max_margin) {
                        price = Math.min(price, price_limit + rule.price_max_margin);
                    }
                    return true;
                }
                return false;
            });
            return price;
        },

        // save data send fail of sync
        add_datas_false: function (data) {
            var datas_false = this.load('datas_false', []);
            this.sequence += 1
            data['sequence'] = this.sequence
            datas_false.push(data);
            this.save('datas_false', datas_false);
        },

        get_datas_false: function () {
            var datas_false = this.load('datas_false');
            if (datas_false && datas_false.length) {
                return datas_false
            } else {
                return []
            }
        },

        remove_data_false: function (sequence) {
            var datas_false = this.load('datas_false', []);
            var datas_false_new = _.filter(datas_false, function (data) {
                return data['sequence'] !== sequence;
            });
            this.save('datas_false', datas_false_new);
        },
        // store product to pos
        add_products: function (products) {
            this._super(products);
            if (!products instanceof Array) {
                products = [products];
            }
            for (var i = 0, len = products.length; i < len; i++) {
                var product = products[i];
                var stored_categories = this.product_by_category_id;
                product = products[i];
                var search_string = this._product_search_string(product);
                var category_ids = products[i].pos_categ_ids;
                if (!category_ids) {
                    continue
                }
                if (category_ids.length == 0) {
                    category_ids = [this.root_category_id];
                }
                for (var n = 0; n < category_ids.length; n++) {
                    var category_id = category_ids[n];
                    if (!stored_categories[category_id]) {
                        stored_categories[category_id] = [product.id];
                    } else {
                        stored_categories[category_id].push(product.id);
                    }
                    if (this.category_search_string[category_id] === undefined) {
                        this.category_search_string[category_id] = '';
                    }
                    this.category_search_string[category_id] += search_string;

                    var ancestors = this.get_category_ancestors_ids(category_id) || [];

                    for (var j = 0, jlen = ancestors.length; j < jlen; j++) {
                        var ancestor = ancestors[j];
                        if (!stored_categories[ancestor]) {
                            stored_categories[ancestor] = [];
                        }
                        stored_categories[ancestor].push(product.id);

                        if (this.category_search_string[ancestor] === undefined) {
                            this.category_search_string[ancestor] = '';
                        }
                        this.category_search_string[ancestor] += search_string;
                    }
                }
                // product by suppliers barcode
                if (product['supplier_barcode']) {
                    if (!this.product_by_supplier_barcode[product['supplier_barcode']]) {
                        this.product_by_supplier_barcode[product['supplier_barcode']] = [product];
                    } else {
                        this.product_by_supplier_barcode[product['supplier_barcode']].push(product);
                    }

                }
            }
        },
        _order_search_string: function (order) {
            var str = order.ean13;
            str += '|' + order.name;
            str += '|' + order.state;
            if (order.partner_id) {
                var partner = this.partner_by_id[order.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (order.pos_reference) {
                str += '|' + order['pos_reference'];
            }
            if (order.note) {
                str += '|' + order['note'];
            }
            str = '' + order['ean13'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_order: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.order_search_string);
                if (r && r[1]) {
                    var ean13 = r[1];
                    if (this.order_by_ean13[ean13] !== undefined) {
                        results.push(this.order_by_ean13[ean13]);
                    } else {
                        var code = r
                    }
                } else {
                    break;
                }
            }
            return results;
        },

        // save data load from backend
        save_pos_orders: function (orders) {
            if (this.orders_store.length == 0) {
                this.orders_store = orders;
            } else {
                this.orders_store = this.orders_store.concat(orders);
            }
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                if (order.partner_id) {
                    if (order.partner_id[0]) {
                        var partner = this.get_partner_by_id(order.partner_id[0]);
                    } else {
                        var partner = this.get_partner_by_id(order.partner_id);
                    }
                    order.partner = partner;
                }
                this.order_by_id[order['id']] = order;
                this.order_by_ean13[order.ean13] = order;
                this.order_search_string += this._order_search_string(order);
            }
        },
        save_data_sync_order: function (new_order) {
            var old_orders = _.filter(this.orders_store, function (old_order) {
                return old_order['id'] != new_order['id']
            });
            old_orders.push(new_order);
            this.orders_store = old_orders;
            if (new_order.partner_id) {
                var partner = this.get_partner_by_id(new_order.partner_id[0]);
                new_order.partner = partner;
            }
            this.order_by_id[new_order['id']] = new_order;
            this.order_by_ean13[new_order.ean13] = new_order;
            this.order_search_string = "";
            for (var i = 0; i < old_orders.length; i++) {
                this.order_search_string += this._order_search_string(old_orders[i]);
            }
        },

        // save order line from backend
        save_pos_order_line: function (lines) {
            if (this.pos_order_lines) {
                this.pos_order_lines = lines;
            } else {
                this.pos_order_lines = this.pos_order_lines.concat(lines);
            }
            for (var i = 0; i < lines.length; i++) {
                this.order_line_by_id[lines[i]['id']] = lines[i];
                if (!this.lines_by_order_id[lines[i].order_id[0]]) {
                    this.lines_by_order_id[lines[i].order_id[0]] = [lines[i]]
                } else {
                    this.lines_by_order_id[lines[i].order_id[0]].push(lines[i])
                }
            }
        },
        save_data_sync_order_line: function (new_order_line) {
            var old_line = this.order_line_by_id[new_order_line['id']];
            if (!old_line) {
                this.order_line_by_id[new_order_line['id']] = new_order_line;
                if (!this.lines_by_order_id[new_order_line.order_id[0]]) {
                    this.lines_by_order_id[new_order_line.order_id[0]] = [new_order_line]
                } else {
                    this.lines_by_order_id[new_order_line.order_id[0]].push(new_order_line)
                }
            } else {
                this.order_line_by_id[new_order_line['id']] = new_order_line;
                this.pos_order_lines = _.filter(this.pos_order_lines, function (line) {
                    return line['id'] != new_order_line['id'];
                })
            }
            this.pos_order_lines.push(new_order_line)

        },
        // Data of Invoices
        _invoice_search_string: function (invoice) {
            var str = invoice.number;
            str += '|' + invoice.name;
            if (invoice.partner_id) {
                var partner = this.partner_by_id[invoice.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (invoice.date_invoice) {
                str += '|' + invoice['date_invoice'];
            }
            str = '' + invoice['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_invoice: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.invoice_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.invoice_by_id[id] !== undefined) {
                        results.push(this.invoice_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        save_invoices: function (invoices) {
            if (this.invoices.length == 0) {
                this.invoices = invoices;
            } else {
                this.invoices = this.invoices.concat(invoices);
            }
            for (var i = 0; i < invoices.length; i++) {
                var inv = invoices[i];
                this.invoice_by_id[inv.id] = inv;
                if (!this.invoice_by_partner_id[inv.partner_id[0]]) {
                    this.invoice_by_partner_id[inv.partner_id[0]] = [inv]
                } else {
                    this.invoice_by_partner_id[inv.partner_id[0]].push(inv);
                }
                this.invoice_search_string += this._invoice_search_string(inv);
            }
        },
        save_data_sync_invoice: function (invoice) {
            var old_invoice = this.invoice_by_id[invoice['id']];
            if (!old_invoice) {
                this.invoices.push(invoice);
                this.invoice_by_id[invoice.id] = invoice;
                if (!this.invoice_by_partner_id[invoice.partner_id[0]]) {
                    this.invoice_by_partner_id[invoice.partner_id[0]] = [invoice]
                } else {
                    this.invoice_by_partner_id[invoice.partner_id[0]].push(invoice);
                }
                this.invoice_search_string += this._invoice_search_string(invoice);
            } else {
                this.invoices = _.filter(this.invoices, function (old_invoice) {
                    return old_invoice['id'] != invoice['id'];

                });
                this.invoices.push(invoice);
                this.invoice_by_id[invoice.id] = invoice;
                if (!this.invoice_by_partner_id[invoice.partner_id[0]]) {
                    this.invoice_by_partner_id[invoice.partner_id[0]] = [invoice]
                } else {
                    this.invoice_by_partner_id[invoice.partner_id[0]].push(invoice);
                }
                this.invoice_search_string = "";
                for (var i = 0; i < this.invoices.length; i++) {
                    var invoice = this.invoices[i]
                    this.invoice_search_string += this._invoice_search_string(invoice);
                }
            }

        },
        get_invoice_by_id: function (id) {
            return this.invoice_by_id[id];
        }
    });


});
