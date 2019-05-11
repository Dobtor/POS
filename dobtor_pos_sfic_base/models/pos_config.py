# -*- coding: utf-8 -*-

from datetime import datetime
from uuid import uuid4

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class PosConfig(models.Model):
    _inherit = 'pos.config'

    pos_type = fields.Many2one("pos.type", string="POS Type")
    

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