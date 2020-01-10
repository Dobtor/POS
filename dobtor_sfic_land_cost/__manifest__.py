
{
    'name': 'Dobtor SFIC Purchase landed costs',
    'version': '12.0.1.1.0',
    "author": "Dobtor",
    'license': 'AGPL-3',
    'category': 'Purchase Management',
    'website': 'www.dobtor.com.tw',
    'summary': 'Purchase cost distribution',
    'depends': [
        'purchase_stock',
        'purchase_landed_cost',
    ],
    'data': [
        'data/purchase_expense_type.xml',
        'views/purchase_cost_distribution_view.xml',
    ],
   
}
