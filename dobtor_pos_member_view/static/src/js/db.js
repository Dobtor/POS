odoo.define('dobtor_pos_member_view.DB', function (require) {
    "use strict";
    var db = require('point_of_sale.DB')
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var _t = core._t;

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            models.load_fields('res.partner', ['member_id', 'birthday','validity_period']);
            _super_posmodel.initialize.apply(this, arguments);
        },
    });
})