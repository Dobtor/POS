# -*- coding: utf-8 -*-
{
    'name': "POS SFIC Point",

    'summary': """
        Use for sfic custom points""",

    'description': """
        
    """,

    'author': "Dobtor",
    'website': "http://www.dobtor.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/12.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Uncategorized',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base', 'dobtor_pos_sfic_base'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        # 'views/views.xml',
        # 'views/templates.xml',
        'views/point_of_sale.xml',
        'views/account_journal.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ],
    'qweb': ['static/src/xml/pos.xml'],
}