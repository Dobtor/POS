# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class dobtor_sale_member(models.Model):
    _name = 'sales.member'

    name = fields.Char(string='name',required=True,)
    member_ids =  fields.One2many(string='Members', comodel_name='res.partner', inverse_name='member_id')
        
