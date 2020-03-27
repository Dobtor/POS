# -*- coding: utf-8 -*-

import odoo
from odoo import models, fields, api, _
from datetime import datetime
import time


class ResPartner(models.Model):
    _inherit = "res.partner"
    
    birthday = fields.Date('Date of Birth')
    total_amount = fields.Float(string='total_amount',default=0)
    expired_date= fields.Datetime(string='Expired Date',default=fields.Datetime.now,)
    gender = fields.Selection(selection=[
        ('male', _('Male')),
        ('female', _('Female')),
        ('ohter', _('Other'))
    ],
        string='Gender',
        default='male'
    )

    member_id = fields.Many2one(
        comodel_name='sales.member',
    )

    @api.multi
    def write(self, vals):
        for res in self:
            if vals.get('member_id', False):
                self.env['sales.member.line'].create({
                    'partner_id': res.id,
                    'member_id': int(vals.get('member_id'))
                })
            check = {key: val for key,
                     val in vals.items() if key == 'member_id'}
            if len(check) and check['member_id'] == False and res.member_id != False:
                line = self.env['sales.member.line'].search([
                    ('partner_id', '=', res.id),
                    ('member_id', '=', res.member_id.id)
                ])
                if len(line):
                    line.unlink()
        return super().write(vals)
