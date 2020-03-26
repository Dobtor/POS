odoo.define('dobtor_pos_member_view.screens', function (require) {
    "use strict";
    
    var screens = require('point_of_sale.screens');
    screens.ClientListScreenWidget.include({

        show: function(){
            this._super();
            this.render_list([]);
        },
        perform_search: function(query, associate_result){
            // name Regular Expression : /^[\u4e00-\u9fa5]{2,4}$/
            var customers;
            query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'');
            var patt = new RegExp(/^09\d{8}$|^[0]\d{7,11}$|^[\u4e00-\u9fa5a-zA-Z]{2,20}$/);   
            if(query && patt.test(query)){
                customers = this.pos.db.search_partner(query);
                this.display_client_details('hide');
                if ( associate_result && customers.length === 1){
                    this.new_client = customers[0];
                    this.save_changes();
                    this.gui.back();
                }
                this.render_list(customers);
            }
            else{
                this.render_list([]);
            }
        },
        clear_search: function(){
            this._super();
            this.render_list([]);
        },
    });
    
})