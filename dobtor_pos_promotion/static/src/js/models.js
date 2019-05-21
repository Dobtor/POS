odoo.define('dobtor.pos.promotion.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var field_utils = require('web.field_utils');
    var round_pr = utils.round_precision;
    var _t = core._t;

    var exports = models
    exports.load_fields_extend = function (model_name, fields) {
        if (!(fields instanceof Array)) {
            fields = [fields];
        }

        var models = exports.PosModel.prototype.models;
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            if (model.model === model_name) {
                if ((model.fields instanceof Array) && model.fields.length > 0) {
                    model.fields = model.fields.concat(fields || []);
                } else {
                    $.extend(model, {
                        fields: fields
                    });
                }
            }
        }
    };

    models.load_fields_extend('product.pricelist.item', ['product_tmpl_id', 'product_id',
                'categ_id', 'min_quantity', 'applied_on', 'base', 'base_pricelist_id', 
                'pricelist_id', 'price_surcharge', 'price_discount', 'price_round', 
                'price_min_margin', 'price_max_margin', 'company_id', 'currency_id', 
                'date_start', 'date_end', 'compute_price', 'fixed_price', 'percent_price', 'name', 'price']);

    models.load_fields_extend('product.pricelist.item', ['level_on', 'base_on',
        'applied_on', 'compute_price', 'bogo_base', 'bxa_gya_free_Aproduct_unit', 'bxa_gya_free_Bproduct_unit',
        'bxa_gyb_free_Aproduct_unit', 'bxa_gyb_free_Bproduct_unit', 'bxa_gyb_free_products', 'bxa_gyb_discount_Aproduct_unit',
        'bxa_gyb_discount_Bproduct_unit', 'bxa_gyb_discount_base_on', 'bxa_gyb_discount_product', 'bxa_gyb_discount_fixed_price',
        'bxa_gyb_discount_percentage_price']);

    // var exports = models
    var _super_posmodel = exports.PosModel;
    exports.PosModel = exports.PosModel.extend({
        initialize: function (session, attributes) {
            _super_posmodel.prototype.initialize.apply(this, arguments);
            exports.load_fields('product.product', ['is_promotion_product']);
        },
    })

    // models.load_models([{
    //     model: 'product.pricelist',
    //     fields: ['name', 'display_name'],
    //     domain: function (self) {
    //         return [
    //             ['id', 'in', self.config.available_pricelist_ids]
    //         ];
    //     },
    //     loaded: function (self, pricelists) {
    //         _.map(pricelists, function (pricelist) {
    //             pricelist.items = [];
    //         });
    //         _.map(pricelists, function (pricelist) {
    //             pricelist.items = [];
    //         });
    //         self.default_pricelist = _.findWhere(pricelists, {
    //             id: self.config.pricelist_id[0]
    //         });
    //         self.pricelists = pricelists;
    //         window.pricelists = pricelists
    //     },
    // }], {
    //     'after': 'product.pricelist'
    // });


    // models.load_models([{
    //     model: 'sale.promotion.rule.range.based',
    //     fields: ['name', 'display_name'],
    //     domain: function (self) {
    //         return [
    //             ['promotion_id', 'in', _.pluck(self.pricelists, 'id')]
    //         ];
    //     },
    //     loaded: function (self, promotion_rules) {
    //         var item_by_id = {};
    //         _.each(self.pricelists, function (pricelist) {
    //             _.each(pricelist.items, function (item) {
    //                 item_by_id[item.id] = item;
    //             });
    //         });

    //         _.each(promotion_rules, function (rule) {
    //             var pricelist_item = item_by_id[rule.promotion_id[0]];
    //             pricelist_item.items.push(item);
    //         });
    //     },
    // }], {
    //     'after': 'product.pricelist.item'
    // });

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
        // get_price: function (pricelist, quantity) {
        //     return _super_orderline.prototype.set_quantity.apply(this, [pricelist, quantity])
        // }
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
        set_res_id: function (line) {
            this.res_id = line;
        },
        get_res_id: function () {
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
            _.each(orderline.get_product().get_pricelist(orderline.order.pricelist), function (pricelist) {
                window.pricelist = pricelist
                if (pricelist.compute_price == 'bogo_sale') {
                    merge = true;
                }
            });
            return merge;
        },
        set_origin_quantity: function (quantity) {
            var quant = parseFloat(quantity) || 0;
            var unit = this.get_unit();
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
        bogo_bxa_gya_free: function (quantity) {
            var self = this;

            if (self.referce_ids) {
                $.each(self.referce_ids.models, function (inedx, item) {
                    this.order.remove_orderline(item);
                })
            }

            var quant = parseFloat(quantity) || 0;
            if (this.get_unit()) {
                this.set_origin_quantity(quantity);
            }
            // 尚未處理 multi pricelist 需處理. 
            var get_current_pricelist = self.product.get_pricelist(self.order.pricelist)[0]
            console.log(get_current_pricelist)
            var bxa_gya_free_Aproduct_unit = get_current_pricelist.bxa_gya_free_Aproduct_unit
            var bxa_gya_free_Bproduct_unit = get_current_pricelist.bxa_gya_free_Bproduct_unit
            if (quant > 1 && quant >= bxa_gya_free_Aproduct_unit) {
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
                this.referce_ids.add(
                    this.order.selected_orderline
                );
                var price = this.order.selected_orderline.price
                if (this.pos.db.get_promotion_product()) {
                    this.order.add_product(
                        this.pos.db.get_promotion_product(), {
                            'quantity': {
                                'quantity': add_newproduct_qty,
                                'gift': 'promotion'
                            }
                        }
                    )
                    this.order.selected_orderline.set_unit_price(-price)
                    this.order.selected_orderline.lock = true;
                    this.order.selected_orderline.set_res_id(self);
                    this.referce_ids.add(
                        this.order.selected_orderline
                    );
                }
                this.order.select_orderline(self);
            }

        },
        bogo_bxa_gyb_free: function (quantity) {
            var self = this;

            if (self.referce_ids) {
                $.each(self.referce_ids.models, function (inedx, item) {
                    this.order.remove_orderline(item);
                })
            }

            var quant = parseFloat(quantity) || 0;
            if (this.get_unit()) {
                this.set_origin_quantity(quantity);
            }
            // 尚未處理 multi pricelist 需處理. 
            var get_current_pricelist = self.product.get_pricelist(self.order.pricelist)[0]

            var bxa_gyb_free_Aproduct_unit = get_current_pricelist.bxa_gyb_free_Aproduct_unit
            var bxa_gyb_free_Bproduct_unit = get_current_pricelist.bxa_gyb_free_Bproduct_unit
            if (quant > 1 && quant > bxa_gyb_free_Aproduct_unit) {
                var add_newproduct_qty = parseInt(quant / bxa_gyb_free_Aproduct_unit) * bxa_gyb_free_Bproduct_unit
                var porudct = this.pos.db.get_product_by_id(get_current_pricelist.bxa_gyb_free_products)
                if (porudct) {
                    this.order.add_product(
                        porudct, {
                            'quantity': {
                                'quantity': add_newproduct_qty,
                                'gift': 'bxa_gyb_free'
                            }
                        }
                    )
                    this.order.selected_orderline.lock = true;
                    this.order.selected_orderline.set_res_id(self);
                    this.referce_ids.add(
                        this.order.selected_orderline
                    );

                    if (this.pos.db.get_promotion_product()) {
                        this.order.add_product(
                            this.pos.db.get_promotion_product(), {
                                'quantity': {
                                    'quantity': add_newproduct_qty,
                                    'gift': 'promotion'
                                }
                            }
                        )
                        this.order.selected_orderline.set_unit_price(-this.order.selected_orderline.price)
                        this.order.selected_orderline.lock = true;
                        this.order.selected_orderline.set_res_id(self);
                        this.referce_ids.add(
                            this.order.selected_orderline
                        );
                    }
                }
                this.order.select_orderline(self);
            }
        },
        bogo_bxa_gyb_discount: function () {
            var self = this;
            var quant = parseFloat(quantity) || 0;
            if (this.get_unit()) {
                this.set_origin_quantity(quantity);
            }
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
            console.log(gift)
            if ((self.bogo_merge(this)) && (!gift)) {
                var pricelist = self.product.get_pricelist(self.order.pricelist)
                console.log(pricelist)
                window.pricelist = pricelist
                var promotion_rule = _.find(pricelist, function (rule) {
                    if (rule.compute_price == "bogo_sale") {
                        return true;
                    }
                    return false;
                })
                switch (promotion_rule.bogo_base) {
                    case 'bxa_gya_free':
                        this.bogo_bxa_gya_free(quantity);
                        break;
                    case 'bxa_gyb_free':
                        this.bogo_bxa_gyb_free(quantity);
                        break;
                    case 'bxa_gyb_discount':
                        this.bogo_bxa_gyb_discount(quantity);
                        break;
                    default:
                        console.log('bogo_sale is empty or otherwise');
                        break;
                }
            } else {
                _super_orderline.prototype.set_quantity.apply(this, [quantity])
            }
        },
        export_as_JSON: function () {
            var res = _super_orderline.prototype.export_as_JSON.apply(this, arguments);
            return res
        },
    })

    return exports;
})