odoo.define('dobtor_pos_member_view.db', function (require) {
    "use strict";
    
    var db = require('point_of_sale.DB');

    db.include({

        _partner_search_string: function(partner){
            var str =  partner.name;
            if(partner.phone){
                str += '|' + partner.phone.split(' ').join('');
            }
            if(partner.mobile){
                str += '|' + partner.mobile.split(' ').join('');
            }
            str = '' + partner.id + ':' + str.replace(':','') + '\n';

            return str;
        },
    });
})