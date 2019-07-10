odoo.define('dobtor_pos_member_gender.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            models.load_fields('res.partner', ['gender']);
            _super_posmodel.initialize.apply(this, arguments);
        },
    });
})