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
        get_partner_point: function() {
            var order = this.get_order();
            var custom = this.get_client();
            if (custom && order) {
                return custom.sfic_point;
                }
            return 0;
        }
    });

    var PosDB = db.include({
        add_partners: function(partners){
            var res = this._super(partners);
            for(var i = 0, len = partners.length; i < len; i++){
                var partner = partners[i];
                // if(partner.member_id)
                // {
                // var member_id = partner.member_id[1]
                // partner.member_id = member_id
                // }
                // if(partner.sfic_point){
                //     var str='' + partner.sfic_point
                //     partner.sfic_point = str
                // }

            }
            // console.log(partners)
            return res;
        }
    })
    return PosDB
})