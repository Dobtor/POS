# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError



class BogoItem(models.Model):
    """ 
    Buy one, get one 50% off. 
    Buy two, get another one 40% off.
    """
    _name = 'sale.promotion.bogo_offer.item'
    _description = 'BOGO Offer Item'


class SalePromotion(models.Model):
    _name = 'sale.promotion.rule'
    _description = 'Promotion Rule'
    _order = "sequence"

    pricelist_id = fields.Many2one(
        string=_('Referce Pricelist'),
        comodel_name='product.pricelist',
        ondelete='set null',
    )
    
    name = fields.Char(
        string=_('Promotion Rule Name'),
        required=True
    )
    sequence = fields.Integer(
        string='Sequence',
        default=10
    )
    date_start = fields.Date(
        string=_('Start Date'), 
        help="Starting date for the pricelist item validation"
    )
    date_end = fields.Date(
        string=_('End Date'), 
        help="Ending valid for the pricelist item validation"
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


class SalePromotionRuleRangeBased(models.Model):
    _name = 'sale.promotion.rule.range.based'
    _description = 'Promotion rule range based'
    _order = "start"

    promotion_id = fields.Many2one(
        string=_('Promotion Reference'),
        comodel_name='sale.promotion.rule',
        ondelete='cascade',
        index=True,
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
                raise ValidationError(_("It has to be less then 100"))
            if record.end < -1 or record.start < -1 or record.end == 0 or record.start == 0:
                raise ValidationError(_("Please enter valid Start or End number"))
            if record.based_on in ['rebate']:
                if record.based_on_rebate < 0.0:
                    raise ValidationError(_("Please enter Some Value for Calculation"))
            if record.based_on in ['percentage']:
                if record.based_on_percentage < 0.0:
                    raise ValidationError(_("Please enter Some Value for Calculation"))


class SalePromotionRuleCombo(models.Model):
    _name = 'sale.promotion.rule.range.based'
    _description = 'Promotion rule range based'
    _order = "start"

    promotion_id = fields.Many2one(
        string=_('Promotion Reference'),
        comodel_name='sale.promotion.rule',
        ondelete='cascade',
        index=True,
    )
