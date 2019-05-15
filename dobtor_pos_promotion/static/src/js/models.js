odoo.define('dobtor.pos.promotion.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var field_utils = require('web.field_utils');
    var round_pr = utils.round_precision;
    var _t = core._t;

    var exports = models
    var _super_posmodel = exports.PosModel;
    exports.PosModel = exports.PosModel.extend({
        initialize: function (session, attributes) {
            _super_posmodel.prototype.initialize.apply(this, arguments);
            exports.load_fields('product.product', ['is_promotion_product']);
        },
    })

    exports.Product = exports.Product.extend({
        get_pricelist: function (pricelist) {
            var self = this;
            // window.pricelist2 = pricelist
            // window.self = self
            // var item = pricelist.items[0]

            // window.c1 = !item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id
            // window.c2 = !item.product_id || item.product_id[0] === self.id
            // window.c3 = !item.categ_id || _.contains(category_ids, item.categ_id[0])
            // window.c4 = !item.date_start || moment(item.date_start).isSameOrBefore(date)
            // window.c5 = !item.date_end || moment(item.date_end).isSameOrAfter(date)

            var pricelist_items = _.filter(pricelist.items, function (item) {
                return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id) &&
                    (!item.product_id || item.product_id[0] === self.id) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date));
            });

            // _.find(pricelist_items, function (rule) {
            //     if (rule.compute_price == "bogo_sale") {
            //         return true;
            //     }
            //     return false;
            // })
            return pricelist_items
        },
    })

    var OrderlineCollection = Backbone.Collection.extend({
        model: exports.Orderline,
    });

    var _super_orderline = exports.Orderline;
    exports.Orderline = exports.Orderline.extend({
        initialize: function (attr, options) {
            var self = this;
            _super_orderline.prototype.initialize.apply(self, arguments);
            self.discount_price = 0;
            self.lock = false;
            self.referce_ids = new OrderlineCollection();
            self.res_id = undefined;
        },
        set_res_id: function(line) {
            this.res_id = line;
        },
        get_res_id: function() {
            return this.res_id;
        },
        set_discount: function (discount_price) {
            var disc = Math.max(parseFloat(discount_price) || 0, 0);
            this.discount_price = disc;
        },
        get_discount_price: function () {
            return this.discount_price;
        },
        can_be_merged_with: function (orderline) {
            var self = this;
            if (self.bogo_merge(orderline)) {
                return false;
            }
            if (_super_orderline.prototype.can_be_merged_with.apply(this, arguments))
                return true;
        },
        bogo_merge: function (orderline) {
            var merge = false;

            // window.get_pricelist = orderline.get_product().get_pricelist(orderline.order.pricelist)
            _.each(orderline.get_product().get_pricelist(orderline.order.pricelist), function (pricelist) {
                window.pricelist = pricelist
                if (pricelist.compute_price == 'bogo_sale') {
                    merge = true;
                }
            });
            // window.merge = merge
            return merge;
        },
        bogo_bxa_gya_free: function (quantity) {
            var self = this;
            window.referce_ids = self.referce_ids
            if (self.referce_ids) {
                $.each(self.referce_ids.models, function (inedx, item) {
                    console.log(item)
                    this.order.remove_orderline(item);
                })
            }
            
            var quant = parseFloat(quantity) || 0;
            var unit = this.get_unit();

            // 尚未處理 multi pricelist 需處理. 
            var get_current_pricelist = self.product.get_pricelist(self.order.pricelist)[0]

            var bxa_gya_free_Aproduct_unit = get_current_pricelist.bxa_gya_free_Aproduct_unit
            var bxa_gya_free_Bproduct_unit = get_current_pricelist.bxa_gya_free_Bproduct_unit
            if (quant > bxa_gya_free_Aproduct_unit) {
                var add_newproduct_qty = parseInt(quant / bxa_gya_free_Aproduct_unit) * bxa_gya_free_Bproduct_unit
                this.order.add_product(
                    this.product, {
                        'quantity': {
                            'quantity': add_newproduct_qty,
                            'gift': 'bxa_gya_free'
                        }
                    }
                )
                this.order.selected_orderline.lock = true;
                this.order.selected_orderline.set_res_id(self);
                window.line1 = this.order.selected_orderline
                this.referce_ids.add(
                    this.order.selected_orderline
                );
                if (this.pos.db.get_promotion_product()) {
                    this.order.add_product(
                        this.pos.db.get_promotion_product(), {
                            'price': -self.order.selected_orderline.quantity * self.order.selected_orderline.price
                        }
                    )
                    this.order.selected_orderline.lock = true;
                    this.order.selected_orderline.set_res_id(self);
                    this.referce_ids.add(
                        this.order.selected_orderline
                    );
                    window.line1 = this.order.selected_orderline
                }
                this.order.select_orderline(self);
            }

            if (unit) {
                if (unit.rounding) {
                    this.quantity = round_pr(quant, unit.rounding);
                    var decimals = this.pos.dp['Product Unit of Measure'];
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
        bogo_bxa_gyb_free: function () {
            var self = this;
        },
        set_quantity: function (quantity) {
            var self = this;
            var gift = null;
            if (this.lock) {
                alert(_t('This line you can not modify quantity'));
                return;
            }

            var objectConstructor = {}.constructor;
            if (quantity.constructor === objectConstructor) {
                // handle reference Loop
                // if set_quantity have bogo_merge (add_product's options)
                //   'quantity': {
                //      'quantity': add_newproduct_qty,
                //      'gift': 'bxa_gya_free'
                //    }

                gift = quantity.gift;
                quantity = quantity.quantity;
            } else {

            }

            this.order.assert_editable();
            if (quantity === 'remove') {
                this.order.remove_orderline(this);
                return;
            }

            if ((self.bogo_merge(this)) && (!gift)) {
                if (self.product.get_pricelist(self.order.pricelist)[0].bogo_base === 'bxa_gya_free') {
                    this.bogo_bxa_gya_free(quantity);
                }
                else if (self.product.get_pricelist(self.order.pricelist)[0].bogo_base === 'bxa_gyb_free') {
                    this.bogo_bxa_gyb_free(quantity);
                }   

            } else {

                _super_orderline.prototype.set_quantity.apply(this, [quantity])
            }
        },
        export_as_JSON: function () {
            var res = _super_orderline.export_as_JSON.apply(this, arguments);
            $.extend(res ,{
                res_id: this.get_res_id().id,
            })
            return res
        },
    })

    return exports;
})