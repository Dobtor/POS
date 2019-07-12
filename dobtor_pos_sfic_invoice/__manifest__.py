# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_sfic_invoice",

    'summary': """
        SFIC Invoice with Point""",

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
    'depends': ['base', 'account', 'dobtor_pos_sfic_wallet', 'dobtor_pos_multi_pricelist'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/views.xml',
        'views/templates.xml',
        'views/res_config_settings_views.xml',
        'views/account_invoice_views.xml',
        'views/pos_config_view.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ],
}