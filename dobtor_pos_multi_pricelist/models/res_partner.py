# -*- coding: utf-8 -*-

import odoo
from odoo import models, fields, api
from odoo.tools.translate import _
from odoo.exceptions import UserError
from datetime import datetime,timedelta
import logging
from time import time

class ResPartner(models.Model):
    _inherit = "res.partner"

    used_birthday_times = fields.Integer(string="used_birthday_times",default=0)
    can_discount_times = fields.Integer(string="can_discount_times",related="member_id.birthday_discount_times")
    related_discount_product = fields.Many2one(string="related_discount_product",related="member_id.related_item")
    birthday_discount = fields.Float(string="Birthday Discount",related="member_id.birthday_discount")
    related_discount = fields.Float(string="related_discount",related="member_id.discount_rate")

    @api.model
    def _clear_used_birthday_times(self):
        records = self.search([('member_id', '!=', False),('used_birthday_times', '>', 0)])
        for partner in records:
            month = datetime.now().month           
            if str(month) != str(partner.birthday).split('-',1)[1].split('-',1)[0]:
                partner.used_birthday_times = 0
