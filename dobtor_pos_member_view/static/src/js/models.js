odoo.define('dobtor_pos_member_view.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var _super_posmodel = models.PosModel.prototype;

    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            models.load_fields('res.partner', ['birthday', 'expired_date', 'sfic_point', 'total_amount', 'gender', 'member_id', 'pos_counter']);
            _super_posmodel.initialize.apply(this, arguments);
        },
    });

    models.load_models([{
        model: 'sales.member',
        fields: ['name'],
        loaded: function (self, member_id) {
            self.member_id = member_id;
        },
    }], {
        'after': 'res.partner'
    });
})