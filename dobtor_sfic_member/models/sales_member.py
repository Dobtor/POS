# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class SaleMember(models.Model):
    _name = 'sales.member'

    name = fields.Char(
        string='name',
        required=True
    )
    member_line = fields.One2many(
        string='Members',
        comodel_name='sales.member.line',
        inverse_name='member_id'
    )    

class SaleMemberLine(models.Model):
    _name = 'sales.member.line'
   
    member_id = fields.Many2one(
        comodel_name='sales.member',
        string="Member Type"
    )
    partner_id = fields.Many2one(
        string='Members',
        comodel_name='res.partner'
    )
    phone = fields.Char(
        related="partner_id.phone"
    )
    email = fields.Char(
        related="partner_id.email"
    )

    @api.multi
    def write(self, val):
        if val.get('partner_id', False):
            line = self.env['sales.member.line'].search([
                ('partner_id', '=', val.get('partner_id', False)),
                ('member_id', '!=', self.member_id.id)
            ])
        if len(line):
            line.unlink()
            self.env['res.partner'].write({
                
            })
        return super().write(val)

    @api.model
    def create(self, val):
        if val.get('partner_id', False):
            line = self.env['sales.member.line'].search([
                ('partner_id', '=', val.get('partner_id', False)),
                ('member_id', '!=', self.member_id.id)
            ])
        if len(line):
            line.unlink()
        return super().create(val)
