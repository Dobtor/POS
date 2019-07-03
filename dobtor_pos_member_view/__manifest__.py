# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_member_view",

    'summary': """
       Add member info in POS UI """,

    'description': """
        Add member info in POS UI
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
        'dobtor_pos_sfic_wallet',
        'point_of_sale',
        'dobtor_sale_member',
        # 'pos_orders_history',
        ],
        # always loaded
    'data': [
        'views/assets.xml',
        'views/res_partner.xml',
    ],
    'qweb': ['static/src/xml/pos.xml'],
}
