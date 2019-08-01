# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class PricelistItem(models.Model):
    _inherit = 'product.pricelist.item'
    _order = "pricelist_sequence, sequence"

    is_primary_key = fields.Boolean(
        string=_('Primary key'),
        default=False,
        help=_("Rules are not integrated with orders")
    )
    not_repeat_ok = fields.Boolean(
        string=_('Can not Repeat'),
        default=False,
        help=_("Rules are unique and not repeated")
    )

    sequence = fields.Integer(
        string=_('sequence'),
        default=10
    )

    pricelist_sequence = fields.Integer(
        string=_('pricelist sequence'),
        related='pricelist_id.sequence',
    )
    # level
    level_on = fields.Selection(
        string=_('level on'),
        selection=[
            ('order', _('Applied on After Order')),
            ('line', _('General Promotion'))
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
    compute_price = fields.Selection(
        selection_add=[
            ('combo_sale', _('Combo Promotion')),
        ]
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
    combo_order_by_pirce = fields.Selection(
        string=_('Order by Price (Combo)'),
        selection=[
            ('asc', _('ascending')),
            ('desc', _('descending'))
        ],
        index=True,
        default='asc'
    )

    # variant
    applied_on = fields.Selection(
        selection_add=[
            ('02_variant_value', _('Variant Value')),
        ]
    )
    attribute_id = fields.Many2many(
        string=_('Attribute'),
        comodel_name='product.attribute',
        compute='_compute_attribute')
    variant_ids = fields.Many2many(
        string=_('Variant Value'),
        comodel_name='product.attribute.value',
        relation='pricelist_variant_rel',
        column1='pricelist_id',
        column2='variant_id',
        help="Specify a variant value if this rule only applies to one product. Keep empty otherwise."
    )

    # order by
    order_by_pirce = fields.Selection(
        string=_('Order by Price'),
        selection=[
            ('asc', _('ascending')),
            ('desc', _('descending'))
        ],
        index=True,
        default='asc'
    )

    @api.multi
    @api.depends('variant_ids', 'variant_ids.attribute_id')
    def _compute_attribute(self):
        for item in self:
            item.attribute_id = item.variant_ids.mapped('attribute_id')

    @api.one
    @api.depends('categ_id', 'product_tmpl_id', 'product_id', 'compute_price', 'fixed_price',
                 'pricelist_id', 'percent_price', 'price_discount', 'price_surcharge')
    def _get_pricelist_item_name_price(self):
        super()._get_pricelist_item_name_price()
        if self.level_on == 'order':
            if self.base_on == 'combo_sale':
                self.price = _('Combo Promotion')
            if self.base_on == 'range':
                self.price = _('Range based Discount')
            if self.variant_ids:
                self.name = _("Variant : {}".format(
                    ','.join([variant.name for variant in self.variant_ids])))
        else:
            if self.variant_ids:
                self.name = _("Variant : {}".format(
                    ','.join([variant.name for variant in self.variant_ids])))
            if self.compute_price == 'bogo_sale':
                self.price = _("bogo offer")
            if self.compute_price == 'combo_sale':
                self.price = _('Combo Promotion')


    @api.onchange('level_on')
    def _onchange_level_on(self):
        if self.level_on == 'line':
            self.compute_price = 'fixed'

    @api.onchange('applied_on')
    def _onchange_applied_on(self):
        super()._onchange_applied_on()
        if self.applied_on != '02_variant_value':
            self.variant_ids = [(6, 0, [])]

    @api.onchange('base_on')
    def _onchange_base_on(self):
        if self.base_on != 'combo_sale':
            self.combo_sale_ids = [(6, 0, [])]
            self.combo_order_by_pirce = 'asc'
        if self.base_on != 'range':
            self.range_based_ids = [(6, 0, [])]

    @api.multi
    def _get_default_bxa_gya_free_value(self):
        self.order_by_pirce = 'asc'
        self.bxa_gya_free_Aproduct_unit = 1
        self.bxa_gya_free_Bproduct_unit = 1
        self.bxa_gya_free_percentage_price = 100

    @api.onchange('compute_price')
    def _onchange_compute_price(self):
        super()._onchange_compute_price()
        if self.compute_price != 'bogo_sale':
            # self.bogo_base = 'bogo'
            self.bogo_base = 'bxa_gya_free'
            self._get_default_bxa_gya_free_value()
            self._get_default_bxa_gyb_free_value()
            self._get_default_bxa_gyb_discount_value()
            self._get_default_bogo_value()

    @api.onchange('bogo_base')
    def _onchange_bogo_base(self):
        if self.bogo_base != 'bxa_gya_free':
            self._get_default_bxa_gya_free_value()
        if self.bogo_base != 'bxa_gya_discount':
            self.order_by_pirce = 'asc'
        if self.bogo_base != 'bxa_gyb_free':
            self._get_default_bxa_gyb_free_value()
        if self.bogo_base != 'bxa_gyb_discount':
            self._get_default_bxa_gyb_discount_value()
        if self.bogo_base != 'bogo_discount':
            self._get_default_bogo_value()
        if self.bogo_base == 'bxa_gya_discount':
            self.order_by_pirce = 'desc'

    @api.constrains('bogo_Aproduct_unit', 'bogo_Bproduct_unit', 'bogo_percentage_price',
                    'bxa_gya_free_Aproduct_unit', 'bxa_gya_free_Bproduct_unit', 'bxa_gya_free_percentage_price',
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
            if record.bxa_gya_free_percentage_price > 100:
                raise ValidationError(_("It has to be less than 100"))
            if record.bxa_gya_free_percentage_price < 0.0:
                raise ValidationError(
                    _("Please enter Some Value for Calculation"))
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
            if record.bxa_gyb_discount_percentage_price > 100:
                raise ValidationError(_("It has to be less than 100"))
            if record.bxa_gyb_discount_base_on == 'percentage':
                if record.bxa_gyb_discount_percentage_price < 0.0:
                    raise ValidationError(
                        _("Please enter Some Value for Calculation"))

            # bogo
            if not (record.bogo_Aproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            if not (record.bogo_Bproduct_unit > 0):
                raise ValidationError(_("It has to be greater than 0"))
            if record.bogo_percentage_price > 100:
                raise ValidationError(_("It has to be less than 100"))
            if record.bogo_base_on == 'percentage':
                if record.bogo_percentage_price < 0.0:
                    raise ValidationError(
                        _("Please enter Some Value for Calculation"))
