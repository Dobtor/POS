odoo.define('dobtor_pos_multi_pricelist.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var _super_posmodel = models.PosModel.prototype;
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var exports = models
    var _super_posmodel = exports.PosModel;
    var field_utils = require('web.field_utils');
    var round_di = utils.round_decimals;
    var utils = require('web.utils');

    exports.load_models({
        model:  'product.pricelist',
        fields: ['name', 'display_name','discount_item', 'discount_product'],
        domain: function(self) { return [['id', 'in', self.config.multi_pricelist_ids]]; },
        loaded: function(self, pricelists){
            _.map(pricelists, function (pricelist) { pricelist.items = []; });
            self.default_pricelist = _.findWhere(pricelists, {id: self.config.pricelist_id[0]});
            self.pricelists = pricelists;
        },
    },{'after':'product.pricelist'})
    exports.load_models({
        model:'sales.member',
        loaded: function(self, members){
            var partner_by_id = {};
            _.each(self.partners, function (partner) {
                partner_by_id[partner.id] = partner;
            });

            _.each(members, function (member) {
                var partner = partner_by_id[member.partner_id[0]];
                partner.member_id.push(member);
            });
        },
    })
    exports.load_fields('product.product', ['discount_type'])
    exports.load_fields('res.partner', ['birthday','member_id']);
    exports.Order = exports.Order.extend({

        remove_discount: function () {
            var orderlines = this.orderlines;
            // find all discount product and remove all. 
            var discount_line = _.filter(orderlines.models, function (line) {
                var product = line.product;
                return product.discount_type;
            });
            if (discount_line) {
                $.each(discount_line, function (inedx, d_line) {
                    this.remove_orderline(d_line);
                });
            }
        },
        check_order_discount: function () {
            var self = this;
            var pricelists = this.pos.pricelists;
            var customer = this.get_client();
            self.remove_discount();
            $.each(this.orderlines.models, function (i, line) {
                var product = line.product;
                var items = [];
                $.each(pricelists, function (i, pl) {
                    var pricelist_items = product.get_pricelist(pl);
                    $.each(pricelist_items, function (i, item) {
                        items.push(item)
                    })
                })
                if (items.length > 0) {
                    if (items.length == 1) {
                        var result = line.get_price_byitem(items[0])
                        if (result.quantity > 0) {
                            if (result.type == 'price') {
                                console.log(this.pos.pricelists)
                                // console.log(items[0)
                                console.log(result)
                                console.log(result.price)
                                console.log(result.quantity)
                                var limit_discount = 0.6
                                if(customer.member_id && limit_discount > line.discount ){
                                    var original_price = round_pr((result.price - product.lst_price), 1)
                                    self.add_product(product, {
                                        'price': original_price,
                                        'quantity': result.quantity,
                                    })
                                    self.add_product(member_discount_product,{
                                        'price':original_price * (1-member_discount_rate),
                                        'quantity':1
                                    })
                                }
                                else{
                                self.add_product(product, {
                                    'price': round_pr((result.price - product.lst_price), 1),
                                    'quantity': result.quantity,
                                })
                            }
                                // self.add_product(items[0].related_product, {
                                //     'price': round_pr((result.price - product.lst_price), 1),
                                //     'quantity': result.quantity,
                                // })
                            }
                            if (result.type == 'bogo') {
                                self.add_product(items[0].related_product, {
                                    'price': result.price,
                                    'quantity': result.quantity,
                                })
                            }
                        }
                    } else {
                        var pk = _.find(items, function (item) {
                            return item.is_primary_key;
                        });
                        if (pk) {
                            console.log(line.get_price_byitem(pk).price,'in here')
                            self.add_product(product, {
                                    'price': round_pr((line.get_price_byitem(pk).price - line.price), 1),
                                    'quantity': line.get_price_byitem(pk).quantity,
                                })
                            // self.add_product(pk.related_product, {
                            //     'price': round_pr((line.get_price_byitem(pk).price - line.price), 1),
                            //     'quantity': line.get_price_byitem(pk).quantity,
                            // })
                        } else {
                            var temp_price = line.price
                            $.each(items, function (i, item) {
                                var result = line.get_price_byitem(item)
                                console.log(result)
                                var discount_rate = result.discount/100
                                if (result.discount > 0) {
                                    var discount_price = -discount_rate * temp_price
                                    self.add_product(product, {
                                        'price': discount_price,
                                        'quantity': result.quantity
                                    })
                                    // self.add_product(item.related_product, {
                                    //     'price': discount_price,
                                    //     'quantity': result.quantity
                                    // })
                                    temp_price = temp_price + discount_price
                                }

                            })
                        }

                    }
                }
            })
        }
    })

    return exports;
})
