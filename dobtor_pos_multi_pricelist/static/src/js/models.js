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

    exports.PosModel = exports.PosModel.extend({
        initialize: function (session, attributes) {
            exports.load_fields('pos.order.line', ['line_name'])
            exports.load_fields('product.pricelist', ['discount_item', 'discount_product'])
            _super_posmodel.prototype.initialize.apply(this, arguments);
        },
    })
    var _super_orderline = exports.Orderline;

    var OrderlineCollection = Backbone.Collection.extend({
        model: exports.Orderline,
    });

    exports.Orderline = exports.Orderline.extend({
        initialize: function (attr, options) {
            var self = this;
            self.discount_price = 0;
            self.lock = false;
            self.referce_ids = new OrderlineCollection();
            self.res_id = undefined;
            _super_orderline.prototype.initialize.apply(self, arguments);
        },
        get_pricelist_discount_product: function (pricelist) {
            if (pricelist) {
                var product = this.pos.db.get_product_by_id(pricelist.discount_product[0])
                if (product) {
                    return product
                } else {
                    return false
                }

            }
        },
        get_discount_rate: function (product, pricelist, quantity) {
            var new_price = product.get_price(pricelist, quantity)
            var origin_price = product.lst_price
            if ((origin_price - new_price) > 0) {
                var rate = round_pr(((origin_price - new_price) / origin_price), this.get_unit().rounding)
                return rate
            } else {
                return 0
            }
        },

        do_unit(quantity) {
            var quant = parseFloat(quantity) || 0;
            var unit = this.get_unit();
            if (unit) {
                if (unit.rounding) {
                    this.quantity = round_pr(quant, unit.rounding);
                    var decimals = this.pos.dp['Product Unit of Measure'];
                    this.quantity = round_di(this.quantity, decimals)
                    this.quantityStr = field_utils.format.float(this.quantity, {
                        digits: [69, decimals]
                    });
                } else {
                    this.quantity = round_pr(quant, 1);
                    this.quantityStr = this.quantity.toFixed(0);
                }
            } else {
                this.quantity = quant;
                this.quantityStr = '' + this.quantity;
            }
            this.trigger('change', this);
        },
        set_res_id: function (line) {
            this.res_id = line;
        },
        add_discount_product: function (quantity) {
            var pricelists = this.pos.pricelists;
            var self = this;
            var product = self.product;
            var temp_price = 0;
            var origin_price = product.lst_price * quantity
            
            // // 需要修正 不確定是否算Line的價格這樣算會不會有影響(ex: discount or round_pr())
            $.each(pricelists, function (index, pricelist) {
                var discount_product = self.get_pricelist_discount_product(pricelist)
                var rate = self.get_discount_rate(product, pricelist, quantity)
                if (rate > 0 && quantity>1) {
                    console.log('index',index)
                    // var discount_price =  round_pr(this.get_unit_price() * quantity * (1 - rate/100), this.pos.currency.rounding);
                    var discount_price = (origin_price - temp_price) * rate
                    // 需先判斷有沒有sub_line，有的話刪除
                    var discount_line = self.order.add_product(discount_product, {
                        'price': discount_price,
                        'quantity': {
                            'quantity': quantity,
                            'option': true,
                        }
                    })
                    temp_price = -discount_price
                }
            })
        },
        check_rule: function () {},
        set_quantity: function (quantity) {
            this.order.assert_editable();
            if (quantity === 'remove') {
                this.order.remove_orderline(this);
                return;
            } else {
                var objectConstructor = {}.constructor;
                var is_discount = null;
                if (quantity.constructor === objectConstructor) {
                    is_discount = quantity.option;
                    quantity = quantity.quantity;
                }
                if (is_discount != true) {
                    this.check_rule();
                    if (this.get_unit()) {
                        this.do_unit(quantity);
                    }
                    this.add_discount_product(quantity);
                } else {
                    _super_orderline.prototype.set_quantity.apply(this, [quantity])
                }
            }
        },
    })

    return exports;
})