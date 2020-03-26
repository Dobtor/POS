odoo.define('dobtor_pos_member_view.db', function (require) {
    "use strict";
    
    var db = require('point_of_sale.DB');

    db.include({

        _partner_search_string: function(partner){
            var str =  partner.name;
            if(partner.phone){
                str += '|' + partner.phone.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '').split(' ').join('');
            }
            if(partner.mobile){
                str += '|' + partner.mobile.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '').split(' ').join('');
            }
            if(partner.barcode){
                str += '|' + partner.barcode.split(' ').join('');
            }
            str = '' + partner.id + ':' + str.replace(':','') + '\n';

            return str;
        },
    });
})