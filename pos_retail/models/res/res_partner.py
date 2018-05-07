# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import logging
import ast
_logger = logging.getLogger(__name__)

class res_partner(models.Model):
    _inherit = "res.partner"

    wallet = fields.Float(digits=(16, 4),
                          compute='_compute_wallet', string='Wallet amount', help='This wallet amount of customer')
    credit = fields.Float(digits=(16, 4),
                          compute='_compute_debit_credit_balance', string='Credit')
    debit = fields.Float(digits=(16, 4),
                          compute='_compute_debit_credit_balance', string='Debit')
    balance = fields.Float(digits=(16, 4),
                         compute='_compute_debit_credit_balance', string='Balance')
    limit_debit = fields.Float('Limit debit')
    credit_history_ids = fields.One2many('res.partner.credit', 'partner_id', 'Credit log')

    pos_loyalty_point = fields.Float(compute="_get_point", string='Point')
    pos_loyalty_type = fields.Many2one('pos.loyalty.category', 'Type')

    @api.model
    def create_from_ui(self, partner):
        if partner.get('property_product_pricelist', None):
            partner['property_product_pricelist'] = int(partner['property_product_pricelist'])
        return super(res_partner, self).create_from_ui(partner)

    @api.multi
    def _get_point(self):
        for partner in self:
            orders = self.env['pos.order'].search([('partner_id', '=', partner.id)])
            for order in orders:
                partner.pos_loyalty_point += order.plus_point
                partner.pos_loyalty_point -= order.redeem_point

    @api.multi
    def _compute_debit_credit_balance(self):
        for partner in self:
            partner.credit = 0
            partner.debit = 0
            partner.balance = 0
            self.env.cr.execute("select sum(amount) from res_partner_credit where partner_id=%s and type='plus'" % partner.id)
            credits = self.env.cr.fetchall()
            self.env.cr.execute("select sum(amount) from res_partner_credit where partner_id=%s and type='redeem'" % partner.id)
            debits = self.env.cr.fetchall()
            if credits:
                for credit in credits:
                    if credit[0]:
                        partner.credit += credit[0]
            if debits:
                for debit in debits:
                    if debit[0]:
                        partner.debit += debit[0]
            partner.balance = partner.credit - partner.debit
        return True

    @api.multi
    def _compute_wallet(self):
        wallet_journal = self.env['account.journal'].search([
            ('pos_method_type', '=', 'wallet'), ('company_id', '=', self.env.user.company_id.id)])
        wallet_statements = self.env['account.bank.statement'].search(
            [('journal_id', 'in', [j.id for j in wallet_journal])])

        for partner in self:
            partner.wallet = 0
            if wallet_statements:
                self._cr.execute(
                    """SELECT l.partner_id, SUM(l.amount)
                    FROM account_bank_statement_line l
                    WHERE l.statement_id IN %s AND l.partner_id = %s
                    GROUP BY l.partner_id
                    """,
                    (tuple(wallet_statements.ids), partner.id))
                datas = self._cr.fetchall()
                for item in datas:
                    partner.wallet -= item[1]

    def sync_data(self):
        datas = self.get_data()
        sessions = self.env['pos.session'].sudo().search([
            ('state', '=', 'opened')
        ])
        self.env['pos.cache.database'].add_cache_record(self)
        if datas:
            for session in sessions:
                _logger.info('sync_data partner')
                self.env['bus.bus'].sendmany(
                    [[(self._cr.dbname, 'pos.sync.data', session.user_id.id), datas]])

    def get_data(self):
        params = self.env['ir.config_parameter'].sudo().get_param(self._name)
        if params:
            params = ast.literal_eval(params)
            datas = self.with_context(params.get('context', {})).read(params.get('fields', []))[0]
            datas['model'] = self._name
            return datas
        else:
            return None

    @api.model
    def create(self, vals):
        partner = super(res_partner, self).create(vals)
        partner.sync_data()
        return partner

    @api.multi
    def write(self, vals):
        res = super(res_partner, self).write(vals)
        for partner in self:
            partner.sync_data()
        return res

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_cache_record(record)
        return super(res_partner, self).unlink()