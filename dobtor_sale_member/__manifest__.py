# -*- coding: utf-8 -*-
{
    'name': "dobtor_sale_member",

    'summary': """
        POS can create self member system""",

    'description': """
        POS can create self member system, include member level , member discount , member term 
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/12.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'POS',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': [
        'point_of_sale',
        'product',
        'percentage_widget',
        'dobtor_sfic_wallet',
        ],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'data/data.xml',
        'views/member_view.xml',
        'views/pricelist_view.xml',
        'views/res_partner_view.xml',
    ],
}