# -*- coding: utf-8 -*-

from odoo import models, fields, api, _


class ResCompany(models.Model):
    _inherit = 'res.company'

    pos_guests_id = fields.Many2one(
        string='POS Guests',
        comodel_name='res.partner',
    )
    

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_guests_id = fields.Many2one(
        string='POS Guests',
        comodel_name='res.partner',
        related='company_id.pos_guests_id', 
        readonly=False,
        help=_("Set Default POS Guests for this Company"),
    )
