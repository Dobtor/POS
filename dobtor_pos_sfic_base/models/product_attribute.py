# -*- coding: utf-8 -*-

from odoo import api, fields, models


class ProductAttribute(models.Model):
    _inherit = "product.attribute"

    @api.multi
    def _has_no_variant_attributes(self):
        return self.filtered(lambda pa: pa.create_variant == 'no_variant')


class ProductTemplateAttributeLine(models.Model):
    _inherit = "product.template.attribute.line"
    
    @api.multi
    def _has_no_variant_attributes(self):
        return self.filtered(lambda ptal: ptal.attribute_id.create_variant == 'no_variant')
