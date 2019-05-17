# -*- coding: utf-8 -*-
{
    'name': "dobtor_sale_promotion",

    'summary': """
        Promotion Rule
    """,

    'description': """
        Promotion Rule
            - BOGO Offer (Buy One Get One Free Rule)
            - Combo Promotion (Merge two promotional offers to provide additional discounts)
            - Rebate Discount (Set discounts based on Price Range)
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",

    'category': 'sale',
    'version': '0.1',

    'depends': [
        'product',
        'sale'
    ],

    # always loaded
    'data': [
        'security/res_groups.xml',
        'security/ir.model.access.csv',
        'views/product_views.xml',
        'views/promotion_rule_views.xml',
        'views/product_pricelist_views.xml',
        'views/res_config_setting.xml',
    ],
}
