# -*- coding: utf-8 -*-
{
    'name': "dobtor_sfic_member",

    'summary': """
        Add member info in POS UI""",

    'description': """
        Add member info in POS UI
    """,

    'author': "Dobtor SI",
    'website': "https://www.dobtor.com",
    'category': 'Uncategorized',
    'version': '0.1',
    'depends': [
        'base',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/sales_member_views.xml',
        'views/res_partner_views.xml',
    ],
}
