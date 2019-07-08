# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class PricelistItem(models.Model):
    _inherit = 'product.pricelist.item'

    compute_price = fields.Selection(
        selection_add=[
            ('bogo_sale', _('BOGO Offer')),
        ]
    )

    # bogo_base = fields.Selection(
    #     string=_('bogo base on'),
    #     selection=[
    #         ('bogo_promotion', _('Buy (X Unit) of Product A, Get (Y Unit) of Product B for $ or % Discount')),
    #         ('bxa_gya_discount', _('Buy (X Unit) of Product , Get Product for % Discount')),
    #     ],
    #     index=True,
    #     default='bogo_promotion'
    # )

    # bogo_promotion
    bogo_Aproduct_unit = fields.Integer(
        string=_("Product Qty"),
        default=1
    )
    bogo_Bproduct_unit = fields.Integer(
        string=_("Discounted Product Qty"),
        default=1
    )
    bogo_base_on = fields.Selection([
        ('fixed', _('Fix Price')),
        ('percentage', _('Percentage (discount)'))
    ],
        string="Based On",
        index=True,
        default='percentage'
    )
    bogo_gift_base_on = fields.Selection(
        selection=[
            ('product', _('Product')),
            ('variant', _('Variant Value')),
            ('the_same', _('The Same as Apple On'))
        ],
        index=True,
        default='product'
    )
    bogo_attribute_id = fields.Many2many(
        string=_('BOGO Discount Attribute'),
        comodel_name='product.attribute',
        compute='_compute_bogo_attribute'
    )
    bogo_variant_ids = fields.Many2many(
        string=_('Discounted Variant Value'),
        comodel_name='product.attribute.value',
        relation='pricelist_bogo_promotion_variant_rel',
        column1='pricelist_id',
        column2='variant_id',
    )
    bogo_product = fields.Many2one(
        comodel_name='product.product',
        string=_("Discounted Product"),
        domain="[('type','!=','service')]",
        ondelete='cascade',
    )
    bogo_fixed_price = fields.Float(
        string=_("Fixed Discount")
    )
    bogo_percentage_price = fields.Float(
        string=_("Percentage Discount"),
        default=100
    )

    # bxa_gya_discount
    bxa_gya_discount_apply_all = fields.Boolean(
         string=_('Use last compliance discount, Apply all'),
    )

    bxa_gya_discount_ids = fields.One2many(
        string=_('BOGO Rule Lines'),
        comodel_name='sale.promotion.bogo_offer.item',
        inverse_name='promotion_id',
    )

    @api.multi
    @api.depends('bogo_variant_ids', 'bogo_variant_ids.attribute_id')
    def _compute_bogo_attribute(self):
        for item in self:
            item.bogo_attribute_id = item.bogo_variant_ids.mapped('attribute_id')

    @api.multi
    def _get_default_bogo_value(self):
        self.order_by_pirce = 'asc'
        self.bogo_Aproduct_unit = 1
        self.bogo_Bproduct_unit = 1
        self.bogo_gift_base_on = 'the_same'
        self.bogo_product = False
        self.bogo_variant_ids = [(6, 0, [])]
        self.bogo_base_on = 'percentage'
        self.bogo_fixed_price = 0.0
        self.bogo_percentage_price = 100.0


