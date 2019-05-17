# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class Pricelist(models.Model):
    _inherit = 'product.pricelist'

    sale_promotion_ids = fields.One2many(
        string=_('promotion rule'),
        comodel_name='sale.promotion.rule',
        inverse_name='pricelist_id',
    )

class PricelistItem_Variant(models.Model):
    _inherit = 'product.pricelist.item'

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

    @api.one
    @api.depends('categ_id', 'product_tmpl_id', 'product_id', 'compute_price', 'fixed_price',
                 'pricelist_id', 'percent_price', 'price_discount', 'price_surcharge')
    def _get_pricelist_item_name_price(self):
        super()._get_pricelist_item_name_price()
        if self.variant_id:
            self.name = self.variant_id.name
    
    @api.onchange('applied_on')
    def _onchange_applied_on(self):
        if self.applied_on != '02_variant_value':
            self.variant_id = False

class PricelistItem_BOGO(models.Model):
    _inherit = 'product.pricelist.item'

    compute_price = fields.Selection(
        selection_add=[
            ('bogo_sale', _('BOGO Offer')),
            # ('other_sale', _('Other Promotion')),
        ]
    )
    bogo_base = fields.Selection([
        ('bxa_gya_free', _('Buy (X Unit) of Product , Get (Y Unit) of Product Free')),
        ('bxa_gyb_free', _('Buy (X Unit) of Product Get (Y Unit) of Another Products Free')),
        ('bxa_gyb_discount', _('Buy (X Unit) of Product A, Get (Y Unit) of Product B for $ or % Discount'))
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
    
    bxa_gyb_free_products = fields.Many2one(
        string = _("Discounted Products"),
        comodel_name='product.product',
        ondelete='cascade',
        domain="[('type','!=','service')]",
    )
    # bxa_gyb_free_products = fields.Many2one(
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
    bxa_gyb_discount_product = fields.Many2one(
        comodel_name='product.product',
        string=_("Discounted Product"),
        domain="[('type','!=','service')]",
        ondelete='cascade',
    )
    bxa_gyb_discount_fixed_price = fields.Float(string=_("Fixed Discount"))
    bxa_gyb_discount_percentage_price = fields.Float(
        string=_("Percentage Discount"))

    @api.one
    @api.depends('categ_id', 'product_tmpl_id', 'product_id', 'compute_price', 'fixed_price',
                 'pricelist_id', 'percent_price', 'price_discount', 'price_surcharge')
    def _get_pricelist_item_name_price(self):
        super()._get_pricelist_item_name_price()

        #  TODO :
        # if self.compute_price == 'combo_sale':
        #     self.price = ("%s %s") % (self.fixed_price, self.pricelist_id.currency_id.name)
       
        if self.compute_price == 'bogo_sale':
            self.price = _("bogo offer")
        # elif self.compute_price == 'other_sale':
        #     self.price = _("%s %% discount") % (self.percent_price)


    @api.multi
    def _get_default_bxa_gya_free_value(self):
        self.bxa_gya_free_Aproduct_unit = 1
        self.bxa_gya_free_Bproduct_unit = 1

    @api.multi
    def _get_default_bxa_gyb_free_value(self):
        self.bxa_gyb_free_Aproduct_unit = 1
        self.bxa_gyb_free_Bproduct_unit = 1
        self.bxa_gyb_free_products = False
        # self.bxa_gyb_free_products = [(6, 0, [])]

    @api.multi
    def _get_default_bxa_gyb_discount_value(self):
        self.bxa_gyb_discount_Aproduct_unit = 1
        self.bxa_gyb_discount_Bproduct_unit = 1
        self.bxa_gyb_discount_product = False
        self.bxa_gyb_discount_fixed_price = 0.0
        self.bxa_gyb_discount_percentage_price = 0.0

    @api.onchange('compute_price')
    def _onchange_compute_price(self):
        super()._onchange_compute_price()
        if self.compute_price != 'bogo_sale':
            self._get_default_bxa_gya_free_value()
            self._get_default_bxa_gyb_free_value()
            self._get_default_bxa_gyb_discount_value()

    @api.onchange('bogo_base')
    def _onchange_bogo_base(self):
        if self.bogo_base != 'bxa_gya_free':
            self._get_default_bxa_gya_free_value()
        if self.bogo_base != 'bxa_gyb_free':
            self._get_default_bxa_gyb_free_value()
        if self.bogo_base != 'bxa_gyb_discount':
            self._get_default_bxa_gyb_discount_value()

    @api.onchange('bxa_gyb_discount_base_on')
    def _onchange_bxa_gyb_discount_base_on(self):
        if self.bxa_gyb_discount_base_on != 'fixed':
            self.bxa_gyb_discount_fixed_price = 0.0
        if self.bxa_gyb_discount_base_on != 'percentage':
            self.bxa_gyb_discount_percentage_price = 0.0
