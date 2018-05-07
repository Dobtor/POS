from odoo import api, models, fields

class purchase_order(models.Model):

    _inherit = "purchase.order"

    signature = fields.Binary('Signature', readonly=1)
    source = fields.Char('Source', readonly=1)