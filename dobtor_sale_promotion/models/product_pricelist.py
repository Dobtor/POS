# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class PricelistItem(models.Model):
    _inherit = 'product.pricelist.item'
    _order = "sequence"

    is_primary_key = fields.Boolean(
        string=_('Primary key'),
        default=False)

    sequence = fields.Integer(
        string=_('sequence'),
        default=10
    )
    # level
    level_on = fields.Selection(
        string=_('level on'),
        selection=[
            ('order', 'Applied on Order'),
            ('line', 'Per Product or Line')
        ],
        index=True,
        default='line'
    )
    base_on = fields.Selection(
        string=_('Promotion Method'),
        selection=[
            ('range', _('Range based Discount')),
            ('combo_sale', _('Combo Promotion')),
        ],
        default='range',
        help='Promotion rule applicable on selected option'
    )
    # Not for form views yet.
    range_based_on = fields.Selection(
        selection=[
            ('range', 'Range based Discount'),
            ('over', 'Over base Discount')
        ],
        index=True,
        default='range'
    )
    range_based_ids = fields.One2many(
        string=_('Range Rule Lines'),
        comodel_name='sale.promotion.rule.range.based',
        inverse_name='promotion_id',
    )
    combo_sale_ids = fields.One2many(
        string=_('Combo Rule Lines'),
        comodel_name='sale.promotion.rule.combo.sale',
        inverse_name='promotion_id',
    )

    # variant
    applied_on = fields.Selection(
        selection_add=[
            ('02_variant_value', _('Variant Value')),
        ]
    )
    variant_ids = fields.Many2many(
        string=_('Variant Value'),
        comodel_name='product.attribute.value',
        relation='pricelist_variant_rel',
        column1='pricelist_id',
        column2='variant_id',
        help="Specify a variant value if this rule only applies to one product. Keep empty otherwise."
    )

    compute_price = fields.Selection(
        selection_add=[
            ('bogo_sale', _('BOGO Offer')),
            # ('other_sale', _('Other Promotion')),
        ]
    )
    bogo_base = fields.Selection([
        ('bxa_gya_free', _('Buy (X Unit) of Product , Get (Y Unit) of Product Free')),
        ('bxa_gyb_free', _('Buy (X Unit) of Product Get (Y Unit) of Another Products Free')),
        ('bxa_gyb_discount', _(
            'Buy (X Unit) of Product A, Get (Y Unit) of Product B for $ or % Discount'))
        # ('bxa_gyc_free', _('Buy (X Unit) of Product A, Get (Y Unit) of Another Products (Categrory) Free'))
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
    # bxa_gyb_free_products = fields.Many2many(
    #     comodel_name='product.product',
    #     relation='bxa_gyb_free_products_rel',
    #     column1='product_id',
    #     column2='pricelist_id',
    #     string=_("Discounted Products"),
    #     ondelete='cascade',
    #     domain="[('type','!=','service')]"
    # )
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

    @api.one
    @api.depends('categ_id', 'product_tmpl_id', 'product_id', 'compute_price', 'fixed_price',
                 'pricelist_id', 'percent_price', 'price_discount', 'price_surcharge')
    def _get_pricelist_item_name_price(self):
        super()._get_pricelist_item_name_price()
        if self.base_on == 'combo_sale':
            self.price = _('Combo Promotion')
        if self.base_on == 'range':
            self.price = _('Range based Discount')
        if self.compute_price == 'bogo_sale':
            self.price = _("bogo offer")

    @api.onchange('level_on')
    def _onchange_level_on(self):
        if self.level_on == 'line':
            self.compute_price = 'fixed'

    @api.onchange('applied_on')
    def _onchange_applied_on(self):
        super()._onchange_applied_on()
        if self.applied_on != '02_variant_value':
            self.variant_id = False

    @api.onchange('base_on')
    def _onchange_applied_on(self):
        if self.base_on != 'combo_sale':
            self.combo_sale_ids = [(6, 0, [])]
            self.is_primary_key = False
        if self.base_on != 'range':
            self.range_based_ids = [(6, 0, [])]
        if self.base_on == 'combo_sale':
            self.is_primary_key = True

    @api.multi
    def _get_default_bxa_gya_free_value(self):
        self.bxa_gya_free_Aproduct_unit = 1
        self.bxa_gya_free_Bproduct_unit = 1

    @api.multi
    def _get_default_bxa_gyb_free_value(self):
        self.bxa_gyb_free_Aproduct_unit = 1
        self.bxa_gyb_free_Bproduct_unit = 1
        self.bxa_gyb_free_gift_base_on = 'product'
        self.bxa_gyb_free_products = False
        self.bxa_gyb_free_variant_ids = [(6, 0, [])]

    @api.multi
    def _get_default_bxa_gyb_discount_value(self):
        self.bxa_gyb_discount_Aproduct_unit = 1
        self.bxa_gyb_discount_Bproduct_unit = 1
        self.bxa_gyb_discount_gift_base_on = 'product'
        self.bxa_gyb_discount_product = False
        self.bxa_gyb_discount_variant_ids = [(6, 0, [])]
        self.bxa_gyb_discount_base_on = 'percentage'
        self.bxa_gyb_discount_fixed_price = 0.0
        self.bxa_gyb_discount_percentage_price = 0.0

    @api.onchange('compute_price')
    def _onchange_compute_price(self):
        super()._onchange_compute_price()
        if self.compute_price != 'bogo_sale':
            self.bogo_base = 'bxa_gya_free'
            self._get_default_bxa_gya_free_value()
            self._get_default_bxa_gyb_free_value()
            self._get_default_bxa_gyb_discount_value()
            self.is_primary_key = False
        if self.compute_price == 'bogo_sale':
            self.is_primary_key = True

    @api.onchange('bogo_base')
    def _onchange_bogo_base(self):
        if self.bogo_base != 'bxa_gya_free':
            self._get_default_bxa_gya_free_value()
        if self.bogo_base != 'bxa_gyb_free':
            self._get_default_bxa_gyb_free_value()
        if self.bogo_base != 'bxa_gyb_discount':
            self._get_default_bxa_gyb_discount_value()

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

    @api.constrains('bxa_gya_free_Aproduct_unit', 'bxa_gya_free_Bproduct_unit',
                    'bxa_gyb_free_Aproduct_unit', 'bxa_gyb_free_Bproduct_unit', 
                    'bxa_gyb_discount_Aproduct_unit', 'bxa_gyb_discount_Bproduct_unit',  'bxa_gyb_discount_percentage_price')
    def _check_rule_validation(self):
        """  validation at promotion create time. """
        for record in self:
            # bxa_gya_free
            if not (record.bxa_gya_free_Aproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            if not (record.bxa_gya_free_Bproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            # bxa_gyb_free
            if not (record.bxa_gyb_free_Aproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            if not (record.bxa_gyb_free_Bproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            # bxa_gyb_discount
            if not (record.bxa_gyb_discount_Aproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            if not (record.bxa_gyb_discount_Bproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            if record.bxa_gyb_discount_percentage_price > 99:
                raise ValidationError(_("It has to be less than 100"))
            if record.bxa_gyb_discount_base_on == 'percentage':
                if record.bxa_gyb_discount_percentage_price < 0.0:
                    raise ValidationError(_("Please enter Some Value for Calculation"))
