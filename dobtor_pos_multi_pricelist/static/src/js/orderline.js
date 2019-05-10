odoo.define('dobtor_pos_mulit_pricelist.orderline', function (require) {
    "use strict";
    var rpc = require('web.rpc');
    var models = require('point_of_sale.models');
    var _super_order = models.Orderline.prototype;

    models.Orderline = models.OrderOrderline.extend({
        initialize:function(attr,options){
            _super_order.initialize.apply(attr, options);
            console.log('in side')
        },
    })  
});