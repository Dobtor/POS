# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
from odoo.tools import float_compare, pycompat


class BogoItem(models.Model):
    """ 
    Buy one, get one 50% off. 
    Buy two, get another one 40% off.
    """
    _name = 'sale.promotion.bogo_offer.item'
    _description = 'BOGO Offer Item'
    _order = 'promotion_id, buy_x'
    
    promotion_id = fields.Many2one(
        string=_('Promotion Reference'),
        comodel_name='product.pricelist.item',
        ondelete='cascade',
        index=True,
    )
    pricelist_id = fields.Many2one(
        string=_('Referce pricelist'),
        related='promotion_id.pricelist_id',
        readonly=True,
        store=True
    )
    buy_x = fields.Integer(
        string=_('Buy (X Unit)'),
        readonly=True,
        store=True
    )
    based_on_percentage = fields.Float(
        string=_('Percentage'),
        default=0.0
    )

    @api.model_create_multi
    def create(self, vals_list):
        conut = 0
        for res in vals_list:
            if res.get('promotion_id', False):
                pircelist_item = self.env['product.pricelist.item'].search(
                        [('id', '=', res.get('promotion_id'))])
                conut += 1
                res['buy_x'] = len(pircelist_item.bxa_gya_discount_ids) + conut
        promotion = super().create(vals_list)
        self.clear_caches()
        return promotion

    @api.multi
    def unlink(self):
        for record in self:
            if not isinstance(record.id, models.NewId):
                pircelist_item = self.env['product.pricelist.item'].search([('id', '=', record.promotion_id.id)])
                conut = 0
                for item in pircelist_item.bxa_gya_discount_ids:
                    if record.id != item.id:
                        conut += 1
                        item.write({'buy_x': conut})
        res = super().unlink()
        self.clear_caches()
        return res

    @api.constrains('based_on_percentage')
    def _check_rule_validation(self):
        """  validation at promotion create time. """
        for record in self:
            if record.based_on_percentage > 99:
                raise ValidationError(_("It has to be less then 100"))
            if record.based_on_percentage < 0.0:
                raise ValidationError(_("Please enter Some Value for Calculation"))


class SalePromotionRuleRangeBased(models.Model):
    _name = 'sale.promotion.rule.range.based'
    _description = 'Promotion rule range based'
    _order = "start DESC"

    promotion_id = fields.Many2one(
        string=_('Promotion Reference'),
        comodel_name='product.pricelist.item',
        ondelete='cascade',
        index=True,
    )
    pricelist_id = fields.Many2one(
        string=_('Referce pricelist'),
        related='promotion_id.pricelist_id',
        readonly=True, 
        store=True
    )
    range_based_on = fields.Selection(
        readonly=True, 
        related='promotion_id.range_based_on',
        store=True
    )
    start = fields.Float(
        string=_('Start')
    )
    end = fields.Float(
        string=_('End'),
        help=_('-1 Express infinite')
    )
    based_on = fields.Selection(
        selection=[
            ('rebate', _('Cash Back (Rebate)')),
            ('percentage', _('Percentage (discount)'))],
        index=True,
        default='rebate'
    )
    based_on_rebate = fields.Float(
        string=_('Cash Back'), 
        default=0.0
    )
    based_on_percentage = fields.Float(
        string=_('Percentage'), 
        default=0.0
    )

    @api.constrains('end', 'start', 'based_on', 'based_on_rebate', 'based_on_percentage')
    def _check_rule_validation(self):
        """  validation at promotion create time. """
        for record in self:
            if record.based_on_percentage > 99:
                raise ValidationError(_("It has to be less than 100"))
            if record.end < -1 or record.start < -1 or record.end == 0 or record.start == 0:
                raise ValidationError(_("Please enter valid Start or End number"))
            if record.based_on in ['rebate']:
                if record.based_on_rebate < 0.0:
                    raise ValidationError(_("Please enter Some Value for Calculation"))
            if record.based_on in ['percentage']:
                if record.based_on_percentage < 0.0:
                    raise ValidationError(_("Please enter Some Value for Calculation"))


class SalePromotionRuleCombo(models.Model):
    _name = 'sale.promotion.rule.combo.sale'
    _description = 'Promotion rule combo sale'

    promotion_id = fields.Many2one(
        string=_('Promotion Reference'),
        comodel_name='product.pricelist.item',
        ondelete='cascade',
        index=True,
    )
    pricelist_id = fields.Many2one(
        string=_('Referce pricelist'),
        related='promotion_id.pricelist_id',
        readonly=True,
        store=True
    )
    applied_on = fields.Selection(
        string=_('Applied on'),
        selection=[
            ('product', _('Product')),
            ('variant', _('Variant Value')),
        ],
        index=True,
        default='product'
    )
    variant_ids = fields.Many2many(
        string=_('Variant Value'),
        comodel_name='product.attribute.value',
        relation='promotion_combo_sale_variant_rel',
        column1='promotion_id',
        column2='variant_id',
    )
    product_id = fields.Many2one(
        string=_('Product'),
        comodel_name='product.product',
        ondelete='cascade',
    )
    based_on = fields.Selection(
        selection=[
            ('price', _('Fix Price (Specify a Price)')),
            ('percentage', _('Percentage (discount)'))],
        index=True,
        default='price'
    )
    based_on_price = fields.Float(
        string=_('Price'),
        default=0.0
    )
    based_on_percentage = fields.Float(
        string=_('Percentage'),
        default=0.0
    )
    
    @api.constrains('based_on', 'based_on_price', 'based_on_percentage')
    def _check_rule_validation(self):
        """  validation at promotion create time. """
        for record in self:
            if record.based_on_percentage > 99:
                raise ValidationError(_("It has to be less then 100"))
            if record.based_on in ['price']:
                if record.based_on_price < 0.0:
                    raise ValidationError(_("Please enter Some Value for Calculation"))
            if record.based_on in ['percentage']:
                if record.based_on_percentage < 0.0:
                    raise ValidationError(_("Please enter Some Value for Calculation"))
