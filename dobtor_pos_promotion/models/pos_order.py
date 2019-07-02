# -*- coding: utf-8 -*-
from odoo import models, fields, api


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    main_line = fields.Char(
        string="Main Line"
    )
    
    sub_line = fields.Char(
        string="Sub Line"
    )
    

