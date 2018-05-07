from odoo import api, fields, models
import json
import logging
import ast

_logger = logging.getLogger(__name__)

class account_invoice(models.Model):
    _inherit = 'account.invoice'

    @api.model
    def pos_validate_invoice(self, invoice_id):
        invoice = self.browse(invoice_id)
        return invoice.action_invoice_open()

    @api.model
    def create(self, vals):
        invoice = super(account_invoice, self).create(vals)
        invoice.sending_notification()
        self.env['pos.cache.database'].add_cache_record(invoice)
        return invoice

    @api.multi
    def write(self, vals):
        res = super(account_invoice, self).write(vals)
        # sync invoice to pos
        for inv in self:
            inv.sending_notification()
            self.env['pos.cache.database'].add_cache_record(inv)
        return res

    def sending_notification(self):
        datas = self.get_data()
        sessions = self.env['pos.session'].sudo().search([
            ('state', '=', 'opened'),
        ])
        if datas:
            for session in sessions:
                _logger.info('{sync} invoice to pos session')
                self.env['bus.bus'].sendmany(
                    [[(self._cr.dbname, 'account.invoice', session.user_id.id), json.dumps(datas)]])
        return True

    def get_data(self):
        params = self.env['ir.config_parameter'].sudo().get_param(self._name)
        if params:
            params = ast.literal_eval(params)
            datas = self.with_context(params.get('context', {})).read(params.get('fields', []))[0]
            datas['model'] = self._name
            return datas
        else:
            return None

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_cache_record(record)
        return super(account_invoice, self).unlink()