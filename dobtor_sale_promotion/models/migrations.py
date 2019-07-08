# -*- coding: utf-8 -*-
# ------------------------ #
# Not used , Can be Delete #
# ------------------------ #
from odoo import models, fields, api, _


class PricelistItem(models.Model):
    _inherit = 'product.pricelist.item'

    bogo_base = fields.Selection(
        string=_('bogo base on'),
        selection=[
            ('bxa_gya_free', _('Buy (X Unit) of Product , Get (Y Unit) of Product Free')),
            ('bxa_gya_discount', _(
                'Buy (X Unit) of Product , Get Product for % Discount')),
            ('bxa_gyb_free', _(
                'Buy (X Unit) of Product Get (Y Unit) of Another Products Free')),
            ('bxa_gyb_discount', _(
                'Buy (X Unit) of Product A, Get (Y Unit) of Product B for $ or % Discount'))
        ],
        index=True,
        default='bxa_gya_free'
    )

    # bxa_gya_free
    bxa_gya_free_Aproduct_unit = fields.Integer(
        string=_("Product Qty"),
        default=1
    )
    bxa_gya_free_Bproduct_unit = fields.Integer(
        string=_("Discounted Product Qty"),
        default=1
    )

    # bxa_gyb_free
    bxa_gyb_free_Aproduct_unit = fields.Integer(
        string=_("Product Qty"),
        default=1
    )
    bxa_gyb_free_Bproduct_unit = fields.Integer(
        string=_("Discounted Product Qty"),
        default=1
    )
    bxa_gyb_free_gift_base_on = fields.Selection(
        selection=[
            ('product', _('Product')),
            ('variant', _('Variant Value')),
        ],
        index=True,
        default='product'
    )
    bxa_gyb_free_attribute_id = fields.Many2many(
        string=_('BOGO Free Attribute'),
        comodel_name='product.attribute',
        compute='_compute_bxa_gyb_free_attribute')
    bxa_gyb_free_variant_ids = fields.Many2many(
        string=_('Discounted Variant Value'),
        comodel_name='product.attribute.value',
        relation='pricelist_bogo_free_variant_rel',
        column1='pricelist_id',
        column2='variant_id',
    )
    bxa_gyb_free_products = fields.Many2one(
        string=_("Discounted Products"),
        comodel_name='product.product',
        ondelete='cascade',
        domain="[('type','!=','service')]",
    )

    # bxa_gyb_discount
    bxa_gyb_discount_Aproduct_unit = fields.Integer(
        string=_("Product Qty"),
        default=1
    )
    bxa_gyb_discount_Bproduct_unit = fields.Integer(
        string=_("Discounted Product Qty"),
        default=1
    )
    bxa_gyb_discount_base_on = fields.Selection([
        ('fixed', _('Fix Price')),
        ('percentage', _('Percentage (discount)'))
    ],
        string="Based On",
        index=True
    )
    bxa_gyb_discount_gift_base_on = fields.Selection(
        selection=[
            ('product', _('Product')),
            ('variant', _('Variant Value')),
        ],
        index=True,
        default='product'
    )
    bxa_gyb_discount_attribute_id = fields.Many2many(
        string=_('BOGO Discount Attribute'),
        comodel_name='product.attribute',
        compute='_compute_bxa_gyb_discount_attribute')
    bxa_gyb_discount_variant_ids = fields.Many2many(
        string=_('Discounted Variant Value'),
        comodel_name='product.attribute.value',
        relation='pricelist_bogo_discount_variant_rel',
        column1='pricelist_id',
        column2='variant_id',
    )
    bxa_gyb_discount_product = fields.Many2one(
        comodel_name='product.product',
        string=_("Discounted Product"),
        domain="[('type','!=','service')]",
        ondelete='cascade',
    )
    bxa_gyb_discount_fixed_price = fields.Float(
        string=_("Fixed Discount")
    )
    bxa_gyb_discount_percentage_price = fields.Float(
        string=_("Percentage Discount")
    )

    @api.multi
    @api.depends('bxa_gyb_free_variant_ids', 'bxa_gyb_free_variant_ids.attribute_id')
    def _compute_bxa_gyb_free_attribute(self):
        for item in self:
            item.bxa_gyb_free_attribute_id = item.bxa_gyb_free_variant_ids.mapped(
                'attribute_id')

    @api.multi
    @api.depends('bxa_gyb_discount_variant_ids', 'bxa_gyb_discount_variant_ids.attribute_id')
    def _compute_bxa_gyb_discount_attribute(self):
        for item in self:
            item.bxa_gyb_discount_attribute_id = item.bxa_gyb_discount_variant_ids.mapped(
                'attribute_id')

    @api.multi
    def _get_default_bxa_gyb_free_value(self):
        self.order_by_pirce = 'asc'
        self.bxa_gyb_free_Aproduct_unit = 1
        self.bxa_gyb_free_Bproduct_unit = 1
        self.bxa_gyb_free_gift_base_on = 'product'
        self.bxa_gyb_free_products = False
        self.bxa_gyb_free_variant_ids = [(6, 0, [])]

    @api.multi
    def _get_default_bxa_gyb_discount_value(self):
        self.order_by_pirce = 'asc'
        self.bxa_gyb_discount_Aproduct_unit = 1
        self.bxa_gyb_discount_Bproduct_unit = 1
        self.bxa_gyb_discount_gift_base_on = 'product'
        self.bxa_gyb_discount_product = False
        self.bxa_gyb_discount_variant_ids = [(6, 0, [])]
        self.bxa_gyb_discount_base_on = 'percentage'
        self.bxa_gyb_discount_fixed_price = 0.0
        self.bxa_gyb_discount_percentage_price = 0.0

    @api.onchange('bxa_gyb_free_gift_base_on')
    def _onchange_bxa_gyb_free_gift_base_on(self):
        if self.bxa_gyb_free_gift_base_on != 'product':
            self.bxa_gyb_free_products = False
        if self.bxa_gyb_free_gift_base_on != 'variant':
            self.bxa_gyb_free_variant_ids = [(6, 0, [])]

    @api.onchange('bxa_gyb_discount_gift_base_on')
    def _onchange_bxa_gyb_discount_gift_base_on(self):
        if self.bxa_gyb_discount_gift_base_on != 'product':
            self.bxa_gyb_discount_product = False
        if self.bxa_gyb_discount_gift_base_on != 'variant':
            self.bxa_gyb_discount_variant_ids = [(6, 0, [])]

    @api.onchange('bxa_gyb_discount_base_on')
    def _onchange_bxa_gyb_discount_base_on(self):
        if self.bxa_gyb_discount_base_on != 'fixed':
            self.bxa_gyb_discount_fixed_price = 0.0
        if self.bxa_gyb_discount_base_on != 'percentage':
            self.bxa_gyb_discount_variant_ids = 0.0


