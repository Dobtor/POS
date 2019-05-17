from odoo import models, fields, api

class Pos(models.Model):
    
    _inherit = 'pos.order'

    order_pricelist_id = fields.Many2one(string='order_pricelist_id',comodel_name='pos.order.pricelist')
