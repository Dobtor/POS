# -*- coding: utf-8 -*-
{
    'name': "POS SFIC Base",

    'summary': """
        SFIC POS base
    """,

    'description': """
        
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",

    'category': 'Uncategorized',
    'version': '0.1',

    'depends': [
        'base', 
        'sale', 
        'point_of_sale'
    ],

    'data': [
        'security/ir.model.access.csv',
        'views/pos.xml',
        'views/product.xml',
    ],
}