odoo.define('dobtor_pos_multi_pricelist.db', function (require) {
    "use strict";

    var PosDB = require('point_of_sale.DB');
    
    PosDB.include({
        get_discount_product: function () {
            for (var index in this.product_by_id) {
                // 暫時不考慮 多promotion product 同時存在問題 (抓到第一個存在的 promotion product)
                // 想法 : 可以在 backend 由 pos.config 中去設定選擇唯一的 (many2one + request)
                if (this.product_by_id[index].discount_type) {
                    return this.product_by_id[index]
                }
            }
            return undefined;
        },
    })
})