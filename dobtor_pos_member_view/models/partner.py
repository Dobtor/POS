# -*- coding: utf-8 -*-
from odoo import models, fields, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    gender = fields.Selection(selection=[('male', 'Male'), ('female', 'Female')], required=True,copy=False)
