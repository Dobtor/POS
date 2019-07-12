odoo.define('dobtor_pos_promotion.promotion_schema', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var exports = models;
    var is_debug = false;


    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({
        prepare_promotion_model: (model) => {
            /**
             * @param {object} model 
             * -------------------------------------------------------
             * @param {object} rule current product rule (pricelist item)
             * @param {string} type ['bogo', 'price', 'range', 'combo'], TPH (Discrimnator)
             * @param {number} price pirce of product
             * @param {number} discount discount (percentage)
             * @param {number} quantity number of product in this rule
             * @param {object} prdocut current product
             * @param {number} prdocut_id current product id
             */
            window.dev_model = model;
            console.log(model);
            return _.extend({}, ({
                rule_id,
                rule,
                type,
                price,
                discount,
                quantity,
                product,
                product_id,
                // TPH, type is bogo
                product_type,
                gift_product_the_same,
                marge_variant_ids,
                // TPH, type is combo
                product_tag,
                marge_tag,
                marge_product,
                combo_promotion,
                // TPH, type is range
                round_value,
            } = model));
        },
    });
});