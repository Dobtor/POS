odoo.define('dobtor_sfic_member.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            models.load_fields('res.partner', ['birthday', 'expired_date', 'total_amount', 'gender']);
            _super_posmodel.initialize.apply(this, arguments);
        },
    });
})