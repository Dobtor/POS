# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_promotion_return",
    'summary': """
        The module allows to make order returns from POS with Promotion.
    """,
    'description': """
        The module allows to make order returns from POS with Promotion.
    """,
    'author': "Dobtor SI",
    'website': "https://www.dobtor.com",
    'category': 'dobtor-POS',
    'version': '0.1',
    'depends': [
        'dobtor_pos_multi_pricelist',
        'dobtor_pos_sfic_wallet',
        'pos_orders_history_return'
    ],
    'data': [
        'views/assets.xml',
    ],
}
