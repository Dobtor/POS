# -*- coding: utf-8 -*-

import odoo
from odoo import models, fields, api
from odoo.tools.translate import _
from odoo.exceptions import UserError
from datetime import datetime,timedelta
import logging
import time
_logger = logging.getLogger(__name__)

class ResPartner(models.Model):
    _inherit = "res.partner"

    birthday = fields.Date('Date of Birth',default=fields.Date.context_today)
    member_id = fields.Many2one(comodel_name='sales.member',string="Member Type")
    total_amount = fields.Float(
        string='total_amount', 
        default=0
        )
    # register_date = fields.Datetime(
    #     string="register date",
    #     default=fields.Datetime.now,
    # )
    validity_period = fields.Datetime(
        string='validity_period',
        default=fields.Datetime.now,
    )
    history_join_ids = fields.One2many('sales.history.join','partner_id', string='History Join',readonly=True)

    @api.model
    def _cron_verify_member(self):
        records = self.search([
            ('member_id', '!=', False),
            ('validity_period', '<=', fields.Date.today())])
        
        sale_member = self.env['sales.member'].sudo().search([('threshold','!=',0)])
        data=[]
        for member in sale_member:
            data.append([member.threshold,member.id,member.expired_date])
        data.sort()
        for partner in records:
            for member in data:
                if partner.total_amount > member[0]:
                    sale_member = self.env['sales.member'].browse(member[1])
                    partner.member_id=sale_member.id
                    partner.validity_period= datetime.today() + timedelta(days=member[2])
                    partner.property_product_pricelist=sale_member.pricelist_id.id
            if  partner.total_amount < data[0][0]:
                partner.member_id = None
                partner.validity_period = None
                partner.property_product_pricelist = self.env.ref('product.list0').id
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
        sale_member = self.env['sales.member'].sudo().search([('threshold','!=',0)])
        data=[]
        for member in sale_member:
            data.append([member.threshold,member.id,member.expired_date])
        data.sort()
        if self.member_id.id != False:
            
            for th in data :
                if th[0] > self.member_id.threshold:
                    self.update({
                        'member_id': th[1],
                        'validity_period':datetime.today() + timedelta(days=th[2])
                    })
                    self._add_history_tag()
                    self.update({
                        'property_product_pricelist':self.member_id.pricelist_id.id
                    })
                    return
        else:   
            self.update({
                        'member_id': data[0][1],
                        'validity_period':datetime.today() + timedelta(days=data[0][2])
                    })
            self._add_history_tag()
            self.update({
                        'property_product_pricelist':self.member_id.pricelist_id.id
                    })
            return

class member_history_join(models.Model):
    _name ='sales.history.join'


    @api.multi
    def name_get(self):
        res = []
        for record in self:
            name = record.type_id.name +'['+str(record.date)+"]"
            res.append((record.id,name))
        return res
    partner_id = fields.Many2one('res.partner', 'member_id')
    type_id = fields.Many2one('sales.member', 'Member Type')
    date = fields.Date('Date')

member_history_join()

