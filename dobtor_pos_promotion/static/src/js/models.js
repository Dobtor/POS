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

    models.load_fields('product.product', ['is_promotion_product', 'attribute_value_ids']);

    var _super_product = exports.Product;
    exports.Product = exports.Product.extend({
        get_pricelist: function (pricelist) {
            var self = this;
            var pricelist_items = _.filter(pricelist.items, function (item) {
                var merge_variant = false;
                if ((item.variant_ids instanceof Array) && item.variant_ids.length > 0) {
                    $.each(self.attribute_value_ids, function (index, attr) {
                        if (item.variant_ids.includes(attr)) {
                            merge_variant = true;
                        }
                    });
                }
                return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id) &&
                    (!item.product_id || item.product_id[0] === self.id) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
                    (!item.attribute_value_ids || merge_variant);
            });
            return pricelist_items
        },
        // get_bxa_gya_free_discount: function() {

        // },
        // get_bxa_gya_free: function (rule, quantity) {
        //     var price = self.lst_price;
        //     if (quantity >= rule.bxa_gya_free_Aproduct_unit) {
        //         var add_newproduct_qty = parseInt(quantity / rule.bxa_gya_free_Aproduct_unit) * rule.bxa_gya_free_Bproduct_unit
        //     }

        //     return price
        // },
        // get_promotion_price: function (pricelist, quantity) {
        //     var self = this;
        //     var date = moment().startOf('day');
        //     if (pricelist === undefined) {
        //         alert(_t(
        //             'An error occurred when loading product prices. ' +
        //             'Make sure all pricelists are available in the POS.'
        //         ));
        //     }

        //     var category_ids = [];
        //     var category = this.categ;
        //     while (category) {
        //         category_ids.push(category.id);
        //         category = category.parent;
        //     }
        //     var pricelist_items = _.filter(pricelist.items, function (item) {
        //         var merge_variant = false;
        //         if ((item.variant_ids instanceof Array) && item.variant_ids.length > 0) {
        //             $.each(self.attribute_value_ids, function (index, attr) {
        //                 if (item.variant_ids.includes(attr)) {
        //                     merge_variant = true;
        //                 }
        //             });
        //         }
        //         return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id) &&
        //             (!item.product_id || item.product_id[0] === self.id) &&
        //             (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
        //             (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
        //             (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
        //             (!item.attribute_value_ids || merge_variant);
        //     });


        //     var price = self.lst_price;
        //     _.find(pricelist_items, function (rule) {
        //         if (rule.min_quantity && quantity < rule.min_quantity) {
        //             return false;
        //         }

        //         if (rule.base === 'pricelist') {
        //             price = self.get_price(rule.base_pricelist, quantity);
        //         } else if (rule.base === 'standard_price') {
        //             price = self.standard_price;
        //         }

        //         if (rule.compute_price === 'fixed') {
        //             price = rule.fixed_price;
        //             return true;
        //         } else if (rule.compute_price === 'percentage') {
        //             price = price - (price * (rule.percent_price / 100));
        //             return true;
        //         } else {
        //             var price_limit = price;
        //             price = price - (price * (rule.price_discount / 100));
        //             if (rule.price_round) {
        //                 price = round_pr(price, rule.price_round);
        //             }
        //             if (rule.price_surcharge) {
        //                 price += rule.price_surcharge;
        //             }
        //             if (rule.price_min_margin) {
        //                 price = Math.max(price, price_limit + rule.price_min_margin);
        //             }
        //             if (rule.price_max_margin) {
        //                 price = Math.min(price, price_limit + rule.price_max_margin);
        //             }
        //             return true;
        //         }
        //         return false;
        //     });
        //     return price;
        // },
        // get_price: function (pricelist, quantity) {
        //     var self = this;
        //     console.log(self);
        //     console.log(pricelist);
        //     if (true) {
        //         console.log('inside');
        //         var pricelist_items = _.filter(pricelist.items, function (item) {
        //             var merge_variant = false;
        //             if ((item.variant_ids instanceof Array) && item.variant_ids.length > 0) {
        //                 console.log('inside -- a');
        //                 $.each(self.attribute_value_ids, function (index, attr) {
        //                     console.log('inside -- b :' + attr);
        //                     if (item.variant_ids.includes(attr)) {
        //                         console.log('inside -- c :' + true);
        //                         merge_variant = true;
        //                     }
        //                 });
        //             }
        //             return (!item.product_tmpl_id || item.product_tmpl_id[0] === self.product_tmpl_id) &&
        //                 (!item.product_id || item.product_id[0] === self.id) &&
        //                 (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
        //                 (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
        //                 (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
        //                 (!item.attribute_value_ids || merge_variant);
        //         });
        //         console.log(pricelist_items);

        //         return _super_product.prototype.get_price.apply(this, arguments)
        //     } else {
        //         return this.get_promotion_price(pricelist, quantity)
        //     }
        // },
    });

    var _super_order = exports.Order;
    exports.Order = Backbone.Model.extend({
        get_product_pricelist: function (pricelist, product) {
            var pricelist_items = _.filter(pricelist.items, function (item) {
                var merge_variant = false;
                if ((item.variant_ids instanceof Array) && item.variant_ids.length > 0) {
                    $.each(product.attribute_value_ids, function (index, attr) {
                        if (item.variant_ids.includes(attr)) {
                            merge_variant = true;
                        }
                    });
                }
                return (!item.product_tmpl_id || item.product_tmpl_id[0] === product.product_tmpl_id) &&
                    (!item.product_id || item.product_id[0] === product.id) &&
                    (!item.categ_id || _.contains(category_ids, item.categ_id[0])) &&
                    (!item.date_start || moment(item.date_start).isSameOrBefore(date)) &&
                    (!item.date_end || moment(item.date_end).isSameOrAfter(date)) &&
                    (!item.attribute_value_ids || merge_variant);
            });

            return pricelist_items;
        },
        // get_something : function( ) {
        //     if (true) {
        //         var product = line.product;
        //         var pricelist_items = this.get_product_pricelist(pricelists, product);
        //         this.get_something();
        //     } 
        //     else if (true) {
        //         // add product
        //     }
        // },
        // get_price: function() {

        // Declare variables
        // var orderlines = this.orderlines;

        // // find all discount product and remove all. 
        // var discount_line = _.filter(orderlines, function(line) {
        //     var product = line.product;
        //     return product.discount_type; 
        // });
        // if (discount_line.length) {
        //     $.each(discount_line, function (inedx, d_line) {
        //         this.remove_orderline(d_line);
        //     });
        // }

        //     var pricelists = this.pos.pricelists;


        //     $.each(orderlines, function (index, line) {
        //         var product = line.product;
        //         var pricelist_items = this.get_product_pricelist(pricelists, product);
        //         if (pricelist_items && pricelist_items.length == 1) {
        //             // add prodcut
        //         } else if (pricelist_items && pricelist_items.length > 1) {

        //         }
        //     });


        // }
    });

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
        // can_be_merged_with: function (orderline) {
        //     var self = this;
        //     if (self.bogo_merge(orderline)) {
        //         return false;
        //     }
        //     if (_super_orderline.prototype.can_be_merged_with.apply(this, arguments))
        //         return true;
        // },
        // bogo_merge: function (orderline) {
        //     var merge = false;
        //     _.each(orderline.get_product().get_pricelist(orderline.order.pricelist), function (pricelist) {
        //         window.pricelist = pricelist
        //         if (pricelist.compute_price == 'bogo_sale') {
        //             merge = true;
        //         }
        //     });
        //     return merge;
        // },
        // set_origin_quantity: function (quantity) {
        //     var quant = parseFloat(quantity) || 0;
        //     var unit = this.get_unit();
        //     if (unit) {
        //         if (unit.rounding) {
        //             this.quantity = round_pr(quant, unit.rounding);
        //             var decimals = this.pos.dp['Product Unit of Measure'];
        //             this.quantityStr = field_utils.format.float(this.quantity, {
        //                 digits: [69, decimals]
        //             });
        //         } else {
        //             this.quantity = round_pr(quant, 1);
        //             this.quantityStr = this.quantity.toFixed(0);
        //         }
        //     } else {
        //         this.quantity = quant;
        //         this.quantityStr = '' + this.quantity;
        //     }
        //     this.trigger('change', this);
        // },
        // bogo_bxa_gya_free: function (quantity) {
        //     var self = this;

        //     if (self.referce_ids) {
        //         $.each(self.referce_ids.models, function (inedx, item) {
        //             this.order.remove_orderline(item);
        //         })
        //     }

        //     var quant = parseFloat(quantity) || 0;
        //     if (this.get_unit()) {
        //         this.set_origin_quantity(quantity);
        //     }
        //     // 尚未處理 multi pricelist 需處理. 
        //     var get_current_pricelist = self.product.get_pricelist(self.order.pricelist)[0]
        //     console.log(get_current_pricelist)
        //     var bxa_gya_free_Aproduct_unit = get_current_pricelist.bxa_gya_free_Aproduct_unit
        //     var bxa_gya_free_Bproduct_unit = get_current_pricelist.bxa_gya_free_Bproduct_unit
        //     if (quant > 1 && quant >= bxa_gya_free_Aproduct_unit) {
        //         var add_newproduct_qty = parseInt(quant / bxa_gya_free_Aproduct_unit) * bxa_gya_free_Bproduct_unit
        //         this.order.add_product(
        //             this.product, {
        //                 'quantity': {
        //                     'quantity': add_newproduct_qty,
        //                     'gift': 'bxa_gya_free'
        //                 }
        //             }
        //         )
        //         this.order.selected_orderline.lock = true;
        //         this.order.selected_orderline.set_res_id(self);
        //         this.referce_ids.add(
        //             this.order.selected_orderline
        //         );
        //         var price = this.order.selected_orderline.price
        //         if (this.pos.db.get_promotion_product()) {
        //             this.order.add_product(
        //                 this.pos.db.get_promotion_product(), {
        //                     'quantity': {
        //                         'quantity': add_newproduct_qty,
        //                         'gift': 'promotion'
        //                     }
        //                 }
        //             )
        //             this.order.selected_orderline.set_unit_price(-price)
        //             this.order.selected_orderline.lock = true;
        //             this.order.selected_orderline.set_res_id(self);
        //             this.referce_ids.add(
        //                 this.order.selected_orderline
        //             );
        //         }
        //         this.order.select_orderline(self);
        //     }

        // },
        // bogo_bxa_gyb_free: function (quantity) {
        //     var self = this;

        //     if (self.referce_ids) {
        //         $.each(self.referce_ids.models, function (inedx, item) {
        //             this.order.remove_orderline(item);
        //         })
        //     }

        //     var quant = parseFloat(quantity) || 0;
        //     if (this.get_unit()) {
        //         this.set_origin_quantity(quantity);
        //     }
        //     // 尚未處理 multi pricelist 需處理. 
        //     var get_current_pricelist = self.product.get_pricelist(self.order.pricelist)[0]

        //     var bxa_gyb_free_Aproduct_unit = get_current_pricelist.bxa_gyb_free_Aproduct_unit
        //     var bxa_gyb_free_Bproduct_unit = get_current_pricelist.bxa_gyb_free_Bproduct_unit
        //     if (quant > 1 && quant > bxa_gyb_free_Aproduct_unit) {
        //         var add_newproduct_qty = parseInt(quant / bxa_gyb_free_Aproduct_unit) * bxa_gyb_free_Bproduct_unit
        //         var porudct = this.pos.db.get_product_by_id(get_current_pricelist.bxa_gyb_free_products)
        //         if (porudct) {
        //             this.order.add_product(
        //                 porudct, {
        //                     'quantity': {
        //                         'quantity': add_newproduct_qty,
        //                         'gift': 'bxa_gyb_free'
        //                     }
        //                 }
        //             )
        //             this.order.selected_orderline.lock = true;
        //             this.order.selected_orderline.set_res_id(self);
        //             this.referce_ids.add(
        //                 this.order.selected_orderline
        //             );

        //             if (this.pos.db.get_promotion_product()) {
        //                 this.order.add_product(
        //                     this.pos.db.get_promotion_product(), {
        //                         'quantity': {
        //                             'quantity': add_newproduct_qty,
        //                             'gift': 'promotion'
        //                         }
        //                     }
        //                 )
        //                 this.order.selected_orderline.set_unit_price(-this.order.selected_orderline.price)
        //                 this.order.selected_orderline.lock = true;
        //                 this.order.selected_orderline.set_res_id(self);
        //                 this.referce_ids.add(
        //                     this.order.selected_orderline
        //                 );
        //             }
        //         }
        //         this.order.select_orderline(self);
        //     }
        // },
        // bogo_bxa_gyb_discount: function () {
        //     var self = this;
        //     var quant = parseFloat(quantity) || 0;
        //     if (this.get_unit()) {
        //         this.set_origin_quantity(quantity);
        //     }
        // },
        // set_quantity: function (quantity) {
        //     var self = this;
        //     var gift = null;
        //     if (this.lock) {
        //         alert(_t('This line you can not modify quantity'));
        //         return;
        //     }

        //     var objectConstructor = {}.constructor;
        //     if (quantity.constructor === objectConstructor) {
        //         // handle reference Loop
        //         // if set_quantity have bogo_merge (add_product's options)
        //         //   'quantity': {
        //         //      'quantity': add_newproduct_qty,
        //         //      'gift': 'bxa_gya_free'
        //         //    }

        //         gift = quantity.gift;
        //         quantity = quantity.quantity;
        //     } else {

        //     }

        //     this.order.assert_editable();
        //     if (quantity === 'remove') {
        //         this.order.remove_orderline(this);
        //         return;
        //     }
        //     console.log(gift)
        //     if ((self.bogo_merge(this)) && (!gift)) {
        //         var pricelist = self.product.get_pricelist(self.order.pricelist)
        //         console.log(pricelist)
        //         window.pricelist = pricelist
        //         var promotion_rule = _.find(pricelist, function (rule) {
        //             if (rule.compute_price == "bogo_sale") {
        //                 return true;
        //             }
        //             return false;
        //         })
        //         switch (promotion_rule.bogo_base) {
        //             case 'bxa_gya_free':
        //                 this.bogo_bxa_gya_free(quantity);
        //                 break;
        //             case 'bxa_gyb_free':
        //                 this.bogo_bxa_gyb_free(quantity);
        //                 break;
        //             case 'bxa_gyb_discount':
        //                 this.bogo_bxa_gyb_discount(quantity);
        //                 break;
        //             default:
        //                 console.log('bogo_sale is empty or otherwise');
        //                 break;
        //         }
        //     } else {
        //         _super_orderline.prototype.set_quantity.apply(this, [quantity])
        //     }
        // },
        export_as_JSON: function () {
            var res = _super_orderline.prototype.export_as_JSON.apply(this, arguments);
            return res
        },
    });

    // return exports;
})