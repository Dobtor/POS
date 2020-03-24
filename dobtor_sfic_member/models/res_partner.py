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

    member_id = fields.Many2one(
        comodel_name='sales.member',
        compute="compute_member"
    )

    @api.multi
    def compute_member(self):
        for res in self:
            line_id = self.env['sales.member.line'].search([('partner_id', '=', res.id)], limit=1)
            res.member_id = line_id.member_id if line_id else False
