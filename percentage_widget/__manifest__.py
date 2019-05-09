# -*- coding: utf-8 -*-
{
    'name': 'Percentage Widget',
    'version': '1.0',
    'category': 'Widget',
    'description': """
        Feature:
        - Percentage widget for list view and form view

        How to use:
        - Adding widget="percentage" attribute for your Float field on view
        Ex: <field name="commission" widget="percentage" />
    """,
    'author': 'The Gok Team',
    'depends': [
    ],

    'data': [
        'views/assets_view.xml',
    ],

    'qweb': [
        'static/src/xml/*.xml',
    ],
    'js': [
        'static/src/js/*.js',
    ],
    'test': [],
    'demo': [],

    'installable': True,
    'active': False,
    'application': True,
}
