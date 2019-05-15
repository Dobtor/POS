# -*- coding: utf-8 -*-

import odoo
from odoo import models, fields, api
from odoo.tools.translate import _
from odoo.exceptions import UserError, except_orm
import time
from datetime import datetime

class member_history_join(models.Model):
    _name ='sales.history.join'


    @api.multi
    def name_get(self):
        res = []
        for record in self:
            if record.type_id and record.date:
                name = record.type_id.name +'['+str(record.date)+"]"
                res.append((record.id,name))
        return res
    partner_id = fields.Many2one('res.partner', 'member_id')
    type_id = fields.Many2one('sales.member', 'Member Type')
    date = fields.Date('Date')

member_history_join()