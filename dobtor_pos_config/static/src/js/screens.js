odoo.define('dobtor_pos_config.screens', function (require) {
    "use strict";
    var screens = require('point_of_sale.screens');

    screens.set_pricelist_button.include({
        init: function (parent, options) {
            this._super(parent, options);
            // this.css("display", "none");
        },
        button_click:function(){}
    })
})