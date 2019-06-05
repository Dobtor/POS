odoo.define('dobtor_pos_promotion_return.screens', function (require) {
    "use strict";
    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var _t = core._t;

    screens.ActionpadWidget.include({
        renderElement: function () {
            // var self = this;
            this._super();
        }
    });
});