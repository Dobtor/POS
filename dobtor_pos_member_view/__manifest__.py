# -*- coding: utf-8 -*-
{
    'name': "dobtor_pos_member_view",

    'summary': """
       Add member info in POS UI """,

    'description': """
        Add member info in POS UI
    """,

    'author': "Dobtor SI",
    'website': "http://www.dobtor.com",
    'category': 'Uncategorized',
    'version': '0.1',
    'depends': [
        'point_of_sale',
        'dobtor_sfic_member',
    ],
    # always loaded
    'data': [
        'views/assets.xml',
    ],
    'qweb': ['static/src/xml/pos.xml'],
}
