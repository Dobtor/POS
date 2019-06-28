# -*- coding: utf-8 -*-
import itertools
from odoo import models, fields, api
from odoo.exceptions import ValidationError, RedirectWarning, UserError

class ProductProduct(models.Model):
    _inherit = "product.product"

    extra_attribute_value_ids = fields.Many2many(
        'product.attribute.value', 'product_attribute_value_extre_rel', 'product_id', 'value_id', string='Extra Attribute Values', ondelete='restrict')

    @api.model
    def create(self, vals):
        res = super().create(vals)
        if res:
            value_ids = res.product_tmpl_id.attribute_line_ids.filtered(lambda line: line.attribute_id.create_variant == 'no_variant').mapped('value_ids')
            for value_id in value_ids:
                res.write({'extra_attribute_value_ids': [(4, value_id.id)]})

        return res

class ProductTemplate(models.Model):
    _inherit = "product.template"

    # hnva = has no_variant attributes
    valid_product_template_attribute_line_hnva_ids = fields.Many2many('product.template.attribute.line',
                                                                      compute="_compute_valid_attributes",
                                                                      string='Valid Product Attribute Lines Has No Variant Attributes', 
                                                                      help="Technical compute")

    @api.multi
    def _compute_valid_attributes(self):
        super()._compute_valid_attributes()
        for record in self:
            record.valid_product_template_attribute_line_hnva_ids = record.valid_product_template_attribute_line_ids._has_no_variant_attributes()


    @api.multi
    def write(self, vals):
        res = super().write(vals)
        if 'attribute_line_ids' in vals or vals.get('active'):
            self.create_extra_variant_ids()
        return res

    @api.multi
    def create_extra_variant_ids(self):
        Product = self.env["product.product"]

        for tmpl_id in self.with_context(active_test=False):

            extra_variants_to_change = []
            extra_variants = self.env['product.product']

            variant_alone = tmpl_id._get_valid_product_template_attribute_lines().filtered(
                lambda line: line.attribute_id.create_variant == 'always' and len(line.value_ids) == 1).mapped('value_ids')
            for value_id in variant_alone:
                updated_products = tmpl_id.product_variant_ids.filtered(
                    lambda product: value_id.attribute_id not in product.mapped('attribute_value_ids.attribute_id'))
                updated_products.write(
                    {'extra_attribute_value_ids': [(4, value_id.id)]})

            if not tmpl_id.has_dynamic_attributes():
                all_variants = itertools.product(*(
                    line.value_ids.ids for line in tmpl_id.valid_product_template_attribute_line_hnva_ids
                ))

                for value_ids in all_variants:
                    value_ids = frozenset(value_ids)
                    extra_variants_to_change += list(value_ids)
                    if len(extra_variants_to_change) > 1000:
                        raise UserError(_('The number of variants to generate is too high. '))

            # change tags
            if extra_variants_to_change:
                for product_id in Product.search([('product_tmpl_id', '=',  tmpl_id.id)]):
                    extra_variants += product_id

            if extra_variants:
                extra_variants.write({'extra_attribute_value_ids': [(6, 0, extra_variants_to_change)]})



        self.invalidate_cache()
        return True
