odoo.define('pos_retail.pos_chanel', function (require) {
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('bus.bus');
    var core = require('web.core');
    var _t = core._t;
    var qweb = core.qweb;

    // chanel 1: pos.stock.update
    exports.pos_stock_syncing = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notification) {
            if (notification && notification[0] && notification[0][0] && typeof notification[0][0] === 'string') {
                notification = [notification]
            }
            if (notification.length) {
                for (var i = 0; i < notification.length; i++) {
                    var channel = notification[i][0];
                    var message = notification[i][1];
                    this.on_notification_do(channel, message);
                }
            }
        },
        on_notification_do: function (channel, message) {
            if (Array.isArray(channel) && channel[1] === 'pos.stock.update' && this.pos.config.sync_stock == true) {
                this.pos.update_stock(message)
            }
            this.pos.db.save('bus_last', this.bus.last)
        }
    });
    // chanel 2: pos sync backend
    // lien ket qua file pos sync data
    exports.sync_backend = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.sync.data') {
                        this.on_notification_do(notifications[i][1]);
                    }
                }
            }
        },
        on_notification_do: function (datas) {
            var model = datas['model'];
            if (model == 'product.product' && this.pos.config.sync_product == true) {
                this.pos.syncing_product(datas)
            }
            if (model == 'res.partner' && this.pos.config.sync_customer == true) {
                this.pos.syncing_partner(datas)
            }
            if (model == 'product.pricelist' && this.pos.config.sync_pricelist == true) {
                this.pos.syncing_pricelist(datas)
            }
            if (model == 'product.pricelist.item' && this.pos.config.sync_pricelist == true) {
                this.pos.syncing_pricelist_item(datas)
            }
        }
    });

    // chanel 3: pos.order
    exports.sync_pos_order = Backbone.Model.extend({
        initialize: function (pos) {
            var self = this;
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.sync_pos_order);
            this.bus.start_polling();
        },
        sync_pos_order: function (messages) {
            for (var i = 0; i < messages.length; i++) {
                var message = messages[i];
                if (message[0] && message[0][1] && message[0][1] == 'pos.order') {
                    var order_data = JSON.parse(message[1]);
                    this.pos.db.save_data_sync_order(order_data);
                    this.pos.trigger('update:order');
                }
            }
        }

    });
    // chanel 4: pos.order.line
    exports.sync_pos_order_line = Backbone.Model.extend({
        initialize: function (pos) {
            var self = this;
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.sync_pos_order_line);
            this.bus.start_polling();
        },
        sync_pos_order_line: function (messages) {
            for (var i = 0; i < messages.length; i++) {
                var message = messages[i];
                if (message[0] && message[0][1] && message[0][1] == 'pos.order.line') {
                    var lines_data = JSON.parse(message[1]);
                    this.pos.db.save_data_sync_order_line(lines_data);
                }
            }
        }
    });


    // chanel 5: account invoice
    exports.sync_invoices = Backbone.Model.extend({
        initialize: function (pos) {
            var self = this;
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.sync_invoice);
            this.bus.start_polling();
        },
        sync_invoice: function (messages) {
            for (var i = 0; i < messages.length; i++) {
                var message = messages[i];
                if (message[0] && message[0][1] && message[0][1] == 'account.invoice') {
                    var invoice_data = JSON.parse(message[1]);
                    this.pos.db.save_data_sync_invoice(invoice_data);
                    this.pos.trigger('update:invoice');
                }
            }
        }

    });
    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            // create variable for loaded can load this variable
            // this.products = [];
            return _super_posmodel.load_server_data.apply(this, arguments).then(function () {
                // 1. bus active sync product
                if (self.config.sync_product || self.config.sync_customer) {
                    self.chrome.loading_message(_t('Active sync data'), 1);
                    self.sync_backend = new exports.sync_backend(self);
                    self.sync_backend.start();
                }
                // 2. active sync stocks
                if (self.config.sync_stock) {
                    self.chrome.loading_message(_t('Active sync stock product data'), 1);
                    self.pos_stock_syncing = new exports.pos_stock_syncing(self);
                    self.pos_stock_syncing.start();
                }
                // 3.active sync orders
                self.chrome.loading_message(_t('Active sync pos order'), 1);
                self.sync_pos_order = new exports.sync_pos_order(self);
                self.sync_pos_order.start();

                // 4. active sync pos order line
                self.chrome.loading_message(_t('Active sync pos order line'), 1);
                self.sync_pos_order_line = new exports.sync_pos_order_line(self);
                self.sync_pos_order_line.start();

                // 5 active sync invoices
                if (self.config.management_invoice) {
                    self.chrome.loading_message(_t('Active sync invoices data'), 1);
                    self.sync_invoices = new exports.sync_invoices(self);
                    self.sync_invoices.start();
                }
            }).done(function () {
                console.log('load_server_data DONE');
            })
        }
    });
    return exports;
});
