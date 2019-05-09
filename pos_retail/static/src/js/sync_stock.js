odoo.define('pos_retail.sync_stock', function (require) {
    var models = require('point_of_sale.models');

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            return _super_posmodel.load_server_data.apply(this, arguments).then(function () {
                self.chrome.call('bus_service', 'onNotification', self, function (notifications) {
                    _.each(notifications, (function (notification) {
                        if (notification[0][1] === 'pos.sync.stock') {
                            self.sync_stock(notification[1])
                        }
                    }).bind(self));
                });
            })
        },
        sync_stock: function (product_ids) {
            console.log('sync_stock product_ids: ' + product_ids);
            var location = this.get_location();
            if (location) {
                this._do_update_quantity_onhand(location.id, product_ids);
            }
        }
    });
});
