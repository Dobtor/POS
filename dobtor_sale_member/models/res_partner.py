# -*- coding: utf-8 -*-

import odoo
from odoo import models, fields, api
from odoo.tools.translate import _
from odoo.exceptions import UserError
from datetime import datetime,timedelta
import logging
import time

class ResPartner(models.Model):
    _inherit = "res.partner"

    birthday = fields.Date('Date of Birth')
    member_id = fields.Many2one(comodel_name='sales.member',string="Member Type")
    total_amount = fields.Float(string='total_amount',default=0)
    expired_date= fields.Datetime(string='Expired Date',default=fields.Datetime.now,)
    history_join_ids = fields.One2many('sales.history.join','partner_id', string='History Join',readonly=True)
    member_type_name = fields.Char(string='member_type_name',related='member_id.name')

    @api.model
    def _cron_verify_member(self):
        records = self.search([('member_id', '!=', False),('expired_date', '<=', fields.Date.today())])
        for partner in records:
            if partner.total_amount >= partner.member_id.next_threshold:
                partner.expired_date = datetime.today() + timedelta(days=partner.member_id.expired_date)
                partner._add_history_tag()
            else:
                member_type= self.env['sales.member'].sudo().search([('annual_threshold', '<=', partner.total_amount)],order='annual_threshold desc',limit=1)
                if member_type:
                    partner.member_id = member_type.id
                    partner.expired_date = datetime.today() + timedelta(days=member_type.expired_date)
                    partner._add_history_tag()
                else:
                    partner.member_id = False
                    partner.expired_date = False
            partner.total_amount =0

    @api.model
    def _add_history_tag(self):
        history= {
                'partner_id'		: self.id,
                'type_id'	: self.member_id.id,
                'date'			:time.strftime("%Y-%m-%d %H:%M:%S")
        }
        history_id = self.env['sales.history.join'].create(history)
    @api.multi
    def action_member_level_up(self):
        if not self.member_id:
            sale_member = self.env['sales.member'].sudo().search([],order='annual_threshold asc',limit=1)
            if sale_member:
                self.update({
                    'member_id': sale_member.id,
                    'expired_date':datetime.today() + timedelta(days=sale_member.expired_date)
                    })
                self._add_history_tag()
            return
        else:   
            sale_member = self.env['sales.member'].sudo().search([('annual_threshold', '>', self.member_id.annual_threshold)],order='annual_threshold asc',limit=1)
            if sale_member and  sale_member != self.member_id:
                self.update({
                    'member_id': sale_member.id,
                    'expired_date':datetime.today() + timedelta(days=sale_member.expired_date)
                    })
                self._add_history_tag()
            return
