# -*- coding: utf-8 -*-

import odoo
from odoo import models, fields, api
from datetime import datetime
import time


class ResPartner(models.Model):
    _inherit = "res.partner"

    birthday = fields.Date('Date of Birth')
    total_amount = fields.Float(string='total_amount',default=0)
    expired_date= fields.Datetime(string='Expired Date',default=fields.Datetime.now,)
    gender = fields.Selection(selection=[('male', 'Male'), ('female', 'Female')], required=True,copy=False)
    member_id = fields.Many2one(comodel_name='sales.member',string="Member Type")
