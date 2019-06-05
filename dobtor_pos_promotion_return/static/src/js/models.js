odoo.define('dobtor_pos_promotion_return.models', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var time = require('web.time');
    var _t = core._t;
    var round_pr = utils.round_precision;
    var exports = models;


    var _super_order = exports.Order;
    exports.Order = exports.Order.extend({

    });
});