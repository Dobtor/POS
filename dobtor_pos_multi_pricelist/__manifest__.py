# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_multi_pricelist",

    'summary': """
        Using  multi pricelist in POS system""",

    'description': """
        Using  multi pricelist in POS system
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/12.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Uncategorized',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base'],

    # any module necessary for this one to work correctly
    'depends': [
        'product', 
        'sale',
        'point_of_sale',
        'dobtor_sale_member',
    ],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'data/product.xml',
        'views/views.xml',
        'views/assets.xml',
        'views/pos_order_view.xml',
        'views/product_pricelist_form_view.xml',
        'views/pos_config_view.xml',
    ],
}
