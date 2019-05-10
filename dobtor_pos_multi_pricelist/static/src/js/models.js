odoo.define('dobtor_pos_multi_pricelist.models', function (require) {
    "use strict";
    var rpc = require('web.rpc');
    var models = require('point_of_sale.models');
    var _super_order = models.Order.prototype;
    var _super_orderline = models.Orderline.prototype;
    models.Order = models.Order.extend({
        add_product: function (product, options) {
            _super_order.add_product.apply(this, arguments);
            this.assert_editable();
            var current_line = null;
            var product = arguments[0]
            this.orderlines.each(function (line) {
                if (line.product.cid == product.cid) {
                    current_line = line
                    current_line.main_line = current_line.cid
                    current_line.is_discount_line = false
                }
            });
            var partner_id = this.get_client() ? this.get_client().id : false
            var self = this
            var discount_line_data = []
            if (current_line) {
                var price_data = this.compute_product_price(product.id, current_line.quantity,partner_id)
                var temp_price = 0
                for (var i = 0; i < price_data.length; i++) {
                    var discount_rate = price_data[i][0]
                    var pricelist_id = price_data[i][1]
                    var discount_product_id = this.get_discount_product(pricelist_id)
                    var discount_product = this.pos.db.get_product_by_id(discount_product_id)
                    if (discount_rate > 0 && current_line.quantity > 0) {
                        var discount_line = current_line.clone()
                        discount_line.price = - (current_line.price-temp_price) * discount_rate
                        temp_price = -discount_line.price
                        var discount_product2 = $.extend(true, {}, discount_product);
                        discount_line.product = discount_product2
                        discount_line.product.display_name = this.get_product_name(pricelist_id,product.id) +' (-'+ Math.min(Math.max(parseFloat(discount_rate*100) || 0, 0),100) +'%)'
                        discount_line.order = current_line.order
                        discount_line.main_line = current_line.cid
                        discount_line.line_name = this.get_product_name(pricelist_id,product.id) +' (-'+ Math.min(Math.max(parseFloat(discount_rate*100) || 0, 0),100) +'%)'
                        discount_line_data.push(discount_line)
                    }
                }
                var need_to_delete = []
                this.orderlines.each(function (line) {
                    if(line.is_discount_line && line.main_line==current_line.cid){
                        need_to_delete.push(line)
                    }
                });
                if (need_to_delete) {
                    $.each(need_to_delete, function(i, line)  {
                        self.orderlines.remove(line);
                    })
                }
                if (discount_line_data) {
                    $.each(discount_line_data, function (i,line) {
                        var dis_line = self.orderlines.add(line);  
                        dis_line.is_discount_line = true
                        dis_line.main_line = current_line.cid
                    })
                }
                this.select_orderline(current_line);
            }
        },
        compute_product_price: function (product_id, qty,partner_id) {
            var discount_rate = null
            rpc.query({
                model: 'pos.order.line',
                method: 'compute_product_price',
                args: [
                    [],
                    product_id, qty,partner_id
                ],
            }, {
                async: false,
            }).then(function (data) {
                discount_rate = data
            })
            return discount_rate

        },
        get_discount_product: function (pricelist_id) {
            var discount_product = null
            rpc.query({
                model: 'product.pricelist',
                method: 'get_discount_product',
                args: [
                    [pricelist_id],
                ]
            }, {
                async: false,
            }).then(function (data) {
                discount_product = data
            })
            return discount_product
        },
        get_product_name: function (pricelist_id,product_id) {
            var name = null
            rpc.query({
                model: 'product.pricelist',
                method: 'get_discount_displayname',
                args: [[pricelist_id],product_id],
            }, {
                async: false,
            }).then(function (data) {
                name = data
            })
            return name
        },
        rename_orderline: function (line_id) {
            rpc.query({
                model: 'pos.order.line',
                method: 'rename_orderline',
                args:[[line_id]],
            }, {
                async: false,
            })
            return true

        },
        remove_orderline: function( line ){
            this.assert_editable();
            var self =this;
            var need_to_delete = []
            this.orderlines.each(function (sub_line) {
                if(sub_line.main_line ==line.cid){
                    need_to_delete.push(sub_line)
                }
            });
            this.orderlines.remove(line);
            if (need_to_delete) {
                $.each(need_to_delete, function(i, sub_line)  {
                    self.orderlines.remove(sub_line);
                })
            }
            
            this.select_orderline(this.get_last_orderline());
        },
    })  
    models.Orderline = models.Orderline.extend({
        export_as_JSON: function() {
            var res = _super_orderline.export_as_JSON.apply(this, arguments);
            res.line_name=null
            if(this.line_name){
                res.line_name = this.line_name
            }
            return res
        },
    })
});