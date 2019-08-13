# -*- coding: utf-8 -*-

from odoo import models, fields, api
import datetime
from datetime import datetime, timedelta


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model
    def _order_fields(self, ui_order):
        res = super()._order_fields(ui_order)
        session = self.env['pos.session'].browse(ui_order['pos_session_id'])
        if session.config_id.available_member_discount and res['partner_id']:   
            partner = self.env['res.partner'].browse(res['partner_id'])
            if partner.birthday:
                order_date = False
                if res['date_order'] :
                    order_date = res['date_order'].split('T')[0]
                    order_date = order_date.split('-')[-2:-1]
                birthday = datetime.strftime(partner.birthday, '%m')
                if order_date and order_date[0]== birthday:
                    partner.used_birthday_times = partner.used_birthday_times + 1
        return res 
