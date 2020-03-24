# -*- coding: utf-8 -*-
{
    'name': "dobtor_sfic_member",

    'summary': """
        Add member info in POS UI""",

    'description': """
        Add member info in POS UI
    """,

    'author': "My Company",
    'website': "http://www.yourcompany.com",
    'category': 'Uncategorized',
    'version': '0.1',
    'depends': [
        'point_of_sale',
    ],

    'data': [
        'security/ir.model.access.csv',
        'views/assets.xml',
        'views/sales_member_views.xml',
        'views/res_partner_views.xml',
    ],
    'qweb': ['static/src/xml/pos.xml'],
}
