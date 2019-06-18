# -*- coding: utf-8 -*-

from odoo import models, fields, api

class ProductProduct(models.Model):
    _inherit = "product.product"

    extra_attribute_value_ids = fields.Many2many(
        'product.attribute.value', 'product_attribute_value_extre_rel', 'product_id', 'value_id', string='Extra Attribute Values', ondelete='restrict')

    @api.model
    def create(self, vals):
        res = super(ProductProduct, self).create(vals)
        if res:
            value_ids = res.product_tmpl_id.attribute_line_ids.filtered(lambda line: line.attribute_id.create_variant == 'no_variant').mapped('value_ids')
            for value_id in value_ids:
                res.write({'extra_attribute_value_ids': [(4, value_id.id)]})

        return res