# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_sfic_invoice",

    'summary': """
        SFIC Invoice with Point""",

    'description': """
        
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",

    'category': 'Uncategorized',
    'version': '0.1',

    'depends': [
        'base',
        'account',
        'dobtor_pos_sfic_wallet',
        'dobtor_pos_multi_pricelist',
        'pos_orders_history_return',
    ],

    'data': [
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/account_invoice_views.xml',
        'views/pos_config_view.xml',
        'views/pos_order_views.xml',
    ],
}
