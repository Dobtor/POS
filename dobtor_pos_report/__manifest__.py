
{
    'name': 'Dobtor Pos report',
    'version': '12.0.1.1.0',
    "author": "Dobtor SI",
    'license': 'AGPL-3',
    'category': 'Point of Sale',
    'website': "https://www.dobtor.com",
    'summary': 'Dobtor Pos report',
    'depends': [
        'point_of_sale',
        'dobtor_pos_promotion_return',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/pos_report.xml',
    ],
   
}
