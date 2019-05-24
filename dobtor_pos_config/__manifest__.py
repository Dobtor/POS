# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_config",

    'summary': """
        Link POS to Pricelist""",

    'description': """
       Let pos be able to set up multiple price lists, price list can also choose POS
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/12.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Uncategorized',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': [
        'product', 
        'point_of_sale',
    ],

    # always loaded
    'data': [
        # 'security/ir.model.access.csv',
        'views/pos_config_view.xml',
        'views/product_pricelist.xml',
        # 'views/assets.xml'

    ],
    # only loaded in demonstration mode
}