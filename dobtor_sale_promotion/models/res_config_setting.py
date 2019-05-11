from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_sale_promotion = fields.Boolean(
        string=_("Allow Custom Promotion Rule"), 
        implied_group='dobtor_sale_promotion.group_sale_promotion'
    )

    promotion_product_id = fields.Many2one(
        'product.product',
        string=_('Promotion Product'),
        domain="[('is_promotion_product', '=', True)]", 
        context="{'default_is_promo_product':1,'default_type':'service'}",
        config_parameter='sale.promotion',
        help=_('Default product used for promotion')
    )
