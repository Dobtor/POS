# -*- coding: utf-8 -*-
from odoo import api, fields, models
import logging
_logger = logging.getLogger(__name__)

class product_pricelist(models.Model):

    _inherit = "product.pricelist"

    @api.one
    def sync_data(self):
        pricelist_fields = self.env['product.pricelist'].fields_get()
        pricelist_fields_load = []
        for k, v in pricelist_fields.items():
            if v['type'] not in ['one2many', 'binary']:
                pricelist_fields_load.append(k)
        pricelist_datas = self.read(pricelist_fields_load)[0]
        pricelist_datas['model'] = 'product.pricelist'
        sessions = self.env['pos.session'].sudo().search([
            ('state', '=', 'opened')
        ])
        for session in sessions:
            _logger.info('sync_data pricelist')
            self.env['bus.bus'].sendmany(
                [[(self._cr.dbname, 'pos.sync.data', session.user_id.id), pricelist_datas]])
        for item in self.item_ids:
            item.sync_data()

    @api.model
    def create(self, vals):
        res = super(product_pricelist, self).create(vals)
        res.sync_data()
        return res

    @api.multi
    def write(self, vals):
        res = super(product_pricelist, self).write(vals)
        for pricelist in self:
            pricelist.sync_data()
        return res

class product_pricelist_item(models.Model):

    _inherit = "product.pricelist.item"

    @api.model
    def create(self, vals):
        item = super(product_pricelist_item, self).create(vals)
        item.sync_data()
        return item

    @api.multi
    def write(self, vals):
        res = super(product_pricelist_item, self).write(vals)
        for item in self:
            item.sync_data()
        return res

    # sync data pos screen
    @api.one
    def sync_data(self):
        pricelist_item_fields = self.env['product.pricelist.item'].fields_get()
        pricelist_item_fields_load = []
        for k, v in pricelist_item_fields.items():
            if v['type'] not in ['one2many', 'binary']:
                pricelist_item_fields_load.append(k)
        pricelist_item_datas = self.read(pricelist_item_fields)[0]
        pricelist_item_datas['model'] = 'product.pricelist.item'
        sessions = self.env['pos.session'].sudo().search([
            ('state', '=', 'opened')
        ])
        for session in sessions:
            _logger.info('sync_data pricelist item')
            self.env['bus.bus'].sendmany(
                [[(self._cr.dbname, 'pos.sync.data', session.user_id.id), pricelist_item_datas]])