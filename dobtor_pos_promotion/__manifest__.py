# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_promotion",

    'summary': """
        POS Promotional Discounts Rules
    """,

    'description': """
        POS Promotional Discounts Rules
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",
    'category': 'pos',

    'depends': [
        'base',
        'product',
        'sale', 
        'point_of_sale',
        'dobtor_sale_promotion',
        'dobtor_pos_sfic_base'
    ],

    'data': [
        # 'security/ir.model.access.csv',
        'views/assets.xml',
    ]
}
