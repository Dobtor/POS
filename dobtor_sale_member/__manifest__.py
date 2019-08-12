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
    'category': 'POS',
    'version': '0.1',
    'depends': [
        'point_of_sale',
        'product',
        'percentage_widget',
        'dobtor_pos_sfic_wallet',
        ],
    'data': [
        'security/ir.model.access.csv',
        'data/data.xml',
        'views/member_view.xml',
        'views/pricelist_view.xml',
        'views/res_partner_view.xml',
    ],
}
