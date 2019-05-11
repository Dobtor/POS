# -*- coding: utf-8 -*-

from odoo import models, fields, api

class PosType(models.Model):
    _name = "pos.type"

    name = fields.Char("Name", required=True)
    pos_point_ratio = fields.Integer("Point Ratio", default=50, required=True)

# class dobtor_sfic_base(models.Model):
#     _name = 'dobtor_sfic_base.dobtor_sfic_base'

#     name = fields.Char()
#     value = fields.Integer()
#     value2 = fields.Float(compute="_value_pc", store=True)
#     description = fields.Text()
#
#     @api.depends('value')
#     def _value_pc(self):
#         self.value2 = float(self.value) / 100