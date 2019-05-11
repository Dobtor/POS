# -*- coding: utf-8 -*-
from odoo import models, fields, api


class Product(models.Model):
    _inherit = 'product.product'

    is_promotion_product = fields.Boolean("Is Promotion Product")
