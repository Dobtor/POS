# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_promotion_return",
    'summary': """
        The module allows to make order returns from POS with Promotion.
    """,
    'description': """
         - The module allows to make order returns from POS with Promotion.
         - Can return posted pos order.
         - If POS can create invoice, then create open bill waitting to close.
         - Closing can reconcile bill and write to payable account.
    """,
    'author': "Dobtor SI",
    'website': "https://www.dobtor.com",
    'category': 'dobtor-POS',
    'version': '0.1',
    'depends': [
        'base',
        'account',
        'purchase',
        'dobtor_pos_multi_pricelist',
        'dobtor_pos_sfic_wallet',
        'pos_orders_history_return'
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/res_pertner_data.xml',
        'data/account_journal.xml',
        'views/assets.xml',
        'views/pos_config_views.xml',
        'views/pos_order_views.xml',
        'views/res_config_settings_views.xml',
    ],
}
