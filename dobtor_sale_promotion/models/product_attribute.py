# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class ProductAttributeValue(models.Model):
    _inherit = 'product.attribute.value'

    create_variant = fields.Selection(
        string=_("Create Variants"),
        related='attribute_id.create_variant',
    )
