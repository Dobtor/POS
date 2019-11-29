# -*- coding: utf-8 -*-
import logging
import psycopg2
from odoo import tools, models, fields, api, _
from odoo.tools import float_is_zero
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    invoice_state = fields.Selection(
        string='Invoice state',
        selection=[
            ('to_invoice', _('To invoice')),
            ('invoiced', _('Fully invoiced'))
        ],
        default='to_invoice'
    )
    purchase_journal = fields.Many2one(
        'account.journal',
        related='session_id.config_id.purchase_journal_id',
        string='Purchase Journal',
        store=True,
        readonly=True
    )
    bill_account_move = fields.Many2one(
        'account.move',
        string='Journal Entry (BILL)',
        readonly=True,
        copy=False
    )

    def _get_order_partner(self, order):
        partner_id = order.partner_id
        if not order.partner_id:
            if order.company_id.pos_guests_id:
                partner_id = order.company_id.pos_guests_id
            else:
                default_partner = self.env.ref(
                    'dobtor_pos_promotion_return.res_partner_the_pos_guests')
                partner_id = default_partner if default_partner else self.env['res.partner'].sudo().create({
                    'name': 'The POS Guests',
                    'supplier': True,
                })
                order.sudo().company_id.update({
                    'pos_guests_id': partner_id.id
                })
            order.sudo().update({'partner_id': partner_id})
        return partner_id

    @api.model
    def create_from_ui(self, orders):
        submitted_references = [o['data']['name'] for o in orders]
        pos_order = self.search(
            [('pos_reference', 'in', submitted_references)])
        existing_orders = pos_order.read(['pos_reference'])
        existing_references = set([o['pos_reference']
                                   for o in existing_orders])
        existing_orders_to_save = [o for o in orders if o['data']
                                   ['name'] in existing_references]
        print(len(pos_order))
        if len(pos_order) <= 1:
            self.return_from_ui(existing_orders_to_save)

        # Keep only new orders
        orders_to_save = [o for o in orders if o['data']
                          ['name'] not in existing_references]

        order_ids = []

        for tmp_order in orders_to_save:
            to_invoice = tmp_order['to_invoice']
            order = tmp_order['data']
            if to_invoice:
                self._match_payment_to_invoice(order)
            pos_order = self._process_order(order)
            order_ids.append(pos_order.id)

            try:
                pos_order.action_pos_order_paid()
            except psycopg2.DatabaseError:
                # do not hide transactional errors, the order(s) won't be saved!
                raise
            except Exception as e:
                _logger.error(
                    'Could not fully process the POS Order: %s', tools.ustr(e))

            if to_invoice:
                pos_order.action_pos_order_invoice()
                pos_order.invoice_id.sudo().with_context(
                    force_company=self.env.user.company_id.id).action_invoice_open()
                pos_order.account_move = pos_order.invoice_id.move_id
        return order_ids

    def _payment_fields(self, ui_paymentline):
        res = super()._payment_fields(ui_paymentline)
        journal = self.env['account.journal'].browse(
            ui_paymentline['journal_id'])
        if journal and journal.is_points:
            res.update({
                'payment_name': _('point'),
            })
        return res

    @api.model
    def _process_order(self, pos_order):
        if pos_order.get('returned_order'):
            prec_acc = self.env['decimal.precision'].precision_get('Account')
            pos_session = self.env['pos.session'].browse(
                pos_order['pos_session_id'])
            if pos_session.state == 'closing_control' or pos_session.state == 'closed':
                pos_order['pos_session_id'] = self._get_valid_session(
                    pos_order).id
            order = self.create(self._order_fields(pos_order))
            order.write({'returned_order': True})
            journal_ids = set()
            for payments in pos_order['statement_ids']:
                if not float_is_zero(payments[2]['amount'], precision_digits=prec_acc):
                    order.add_payment(self._payment_fields(payments[2]))
                journal_ids.add(payments[2]['journal_id'])
            if pos_session.sequence_number <= pos_order['sequence_number']:
                pos_session.write(
                    {'sequence_number': pos_order['sequence_number'] + 1})
                pos_session.refresh()
            if not float_is_zero(pos_order['amount_return'], prec_acc):
                cash_journals = []
                cash_journal_id = pos_session.cash_journal_id.id
                if not cash_journal_id:
                    cash_journal = self.env['account.journal'].search(
                        [('id', 'in', list(journal_ids))], limit=1)
                    if not cash_journal:
                        journal_list = [
                            statement.journal_id for statement in pos_session.statement_ids]
                        for journal in journal_list:
                            if not journal.is_points and journal.type == 'cash':
                                cash_journals.append(journal)
                    else:
                        cash_journals.append(cash_journal)
                if len(cash_journals):
                    cash_journal_id = cash_journals[0].id
                else:
                    raise UserError(
                        _("No cash statement found for this session. Unable to record returned cash."))
                order.add_payment({
                    'amount': -pos_order['amount_return'],
                    'payment_date': fields.Datetime.now(),
                    'payment_name': _('return'),
                    'journal': cash_journal_id,
                })
            return order
        else:
            return super()._process_order(pos_order)

    #  return create bill open

    def to_bill(self, tmp_order, order):
        to_bill = tmp_order['to_invoice']
        return to_bill

    def _prepare_bank_statement_line_payment_values(self, data):
        """Create a new payment for the order"""
        args = {
            'amount': data['amount'],
            'date': data.get('payment_date', fields.Date.context_today(self)),
            'name': self.name + ': ' + (data.get('payment_name', '') or ''),
            'partner_id': self.env["res.partner"]._find_accounting_partner(self.partner_id).id or False,
        }

        journal_id = data.get('journal', False)
        statement_id = data.get('statement_id', False)
        assert journal_id or statement_id, "No statement_id or journal_id passed to the method!"

        journal = self.env['account.journal'].browse(journal_id)
        # use the company of the journal and not of the current user
        company_cxt = dict(
            self.env.context, force_company=journal.company_id.id)

        if self.returned_order:
            account_def = self.env['ir.property'].with_context(company_cxt).get(
                'property_account_payable_id', 'res.partner')
            args['account_id'] = (
                self.partner_id.property_account_payable_id.id
            ) or (account_def and account_def.id) or False
        else:
            account_def = self.env['ir.property'].with_context(company_cxt).get(
                'property_account_receivable_id', 'res.partner')
            args['account_id'] = (self.partner_id.property_account_receivable_id.id) or (
                account_def and account_def.id) or False

        if not args['account_id']:
            if not args['partner_id']:
                msg = _('There is no receivable account defined to make payment.')
            else:
                msg = _('There is no receivable account defined to make payment for the partner: "%s" (id:%d).') % (
                    self.partner_id.name, self.partner_id.id,)
            raise UserError(msg)

        context = dict(self.env.context)
        context.pop('pos_session_id', False)
        for statement in self.session_id.statement_ids:
            if statement.id == statement_id:
                journal_id = statement.journal_id.id
                break
            elif statement.journal_id.id == journal_id:
                statement_id = statement.id
                break
        if not statement_id:
            raise UserError(_('You have to open at least one cashbox.'))

        args.update({
            'statement_id': statement_id,
            'pos_statement_id': self.id,
            'journal_id': journal_id,
            'ref': self.session_id.name,
        })

        return args

    @api.multi
    def return_from_ui(self, orders):
        for tmp_order in orders:
            order = tmp_order['data']
            if order['amount_total'] > 0:
                continue
            to_bill = self.to_bill(tmp_order, order)

            order['returned_order'] = True
            pos_order = self._process_order(order)

            try:
                pos_order.action_pos_order_paid()
            except psycopg2.OperationalError:
                raise
            except Exception as e:
                _logger.error(
                    'Could not fully process the POS Order: %s', tools.ustr(e)
                )

            if to_bill:
                pos_order.action_pos_order_bill()
                pos_order.invoice_id.sudo().action_invoice_open()
                pos_order.bill_account_move = pos_order.invoice_id.move_id

    def _prepare_bill(self):
        """
        Prepare the dict of values to create the new bill for a pos order.
        """
        invoice_type = 'in_refund' if self.amount_total >= 0 else 'in_invoice'
        return {
            'name': self.name,
            'origin': self.name,
            'account_id': self.partner_id.property_account_payable_id.id,
            'journal_id': self.session_id.config_id.bill_journal_id.id,
            'company_id': self.company_id.id,
            'type': invoice_type,
            'reference': self.name,
            'partner_id': self.partner_id.id,
            'comment': self.note or '',
            # considering partner's sale pricelist's currency
            'currency_id': self.pricelist_id.currency_id.id,
            'user_id': self.user_id.id,
        }

    @api.multi
    def action_pos_order_bill(self):
        Invoice = self.env['account.invoice']

        for order in self:
            # Force company for all SUPERUSER_ID action
            local_context = dict(
                self.env.context, force_company=order.company_id.id, company_id=order.company_id.id)
            if order.invoice_id:
                Invoice += order.invoice_id
                continue

            partner_id = self._get_order_partner(order)
            if not partner_id:
                raise UserError(_('Please provide a partner for the sale.'))

            invoice = Invoice.new(order._prepare_bill())
            invoice._onchange_partner_id()
            invoice.fiscal_position_id = order.fiscal_position_id

            inv = invoice._convert_to_write(
                {name: invoice[name] for name in invoice._cache})
            new_invoice = Invoice.with_context(
                local_context).sudo().create(inv)
            message = _(
                "This invoice has been created from the point of sale session: <a href=# data-oe-model=pos.order data-oe-id=%d>%s</a>") % (order.id, order.name)
            new_invoice.message_post(body=message)
            order.write({'invoice_id': new_invoice.id,
                         'invoice_state': 'invoiced'})
            Invoice += new_invoice

            for line in order.lines:
                self.with_context(local_context)._action_create_bill_line(
                    line, new_invoice.id)

            new_invoice.with_context(local_context).sudo().compute_taxes()
            order.sudo().write({'invoice_state': 'invoiced'})

        if not Invoice:
            return {}

        return {
            'name': _('Customer Bill'),
            'view_type': 'form',
            'view_mode': 'form',
            'view_id': self.env.ref('account.invoice_form').id,
            'res_model': 'account.invoice',
            'context': "{'type':'in_invoice'}",
            'type': 'ir.actions.act_window',
            'nodestroy': True,
            'target': 'current',
            'res_id': Invoice and Invoice.ids[0] or False,
        }

    def _action_create_bill_line(self, line=False, invoice_id=False):
        InvoiceLine = self.env['account.invoice.line']
        inv_name = line.product_id.name_get()[0][1]
        inv_line = {
            'invoice_id': invoice_id,
            'product_id': line.product_id.id,
            'quantity': line.qty if self.amount_total >= 0 else -line.qty,
            'account_analytic_id': self._prepare_analytic_account(line),
            'name': inv_name,
        }
        # Oldlin trick
        invoice_line = InvoiceLine.sudo().new(inv_line)
        invoice_line._onchange_product_id()
        tax = self.env['account.tax'].search([
            ('company_id', '=', line.order_id.company_id.id),
            ('amount_type', '=', 'percent'),
            ('type_tax_use', '=', 'purchase'),
        ], limit=1)
        if tax:
            invoice_line.invoice_line_tax_ids = [(6, False, [tax.id])]
        # We convert a new id object back to a dictionary to write to
        # bridge between old and new api
        inv_line = invoice_line._convert_to_write(
            {name: invoice_line[name] for name in invoice_line._cache})
        inv_line.update(price_unit=line.price_unit,
                        discount=line.discount, name=inv_name)
        return InvoiceLine.sudo().create(inv_line)

    # closing
    def _filtered_for_reconciliation(self):
        filter_states = ['invoiced', 'done']
        if self.env['ir.config_parameter'].sudo().get_param('point_of_sale.order_reconcile_mode', 'all') == 'partner_only':
            return self.filtered(lambda order: order.state in filter_states and order.partner_id or (order.invoice_state == 'invoiced' and order.partner_id))
        return self.filtered(lambda order: order.state in filter_states or order.invoice_state == 'invoiced')

    def _reconcile_payments(self):
        super()._reconcile_payments()
        for order in self:
            aml = order.statement_ids.mapped(
                'journal_entry_ids') | order.bill_account_move.line_ids | order.invoice_id.move_id.line_ids
            aml = aml.filtered(lambda r: not r.reconciled and r.account_id.internal_type ==
                               'payable' and r.partner_id == order.partner_id.commercial_partner_id)
            try:
                aml.reconcile()
            except Exception:
                _logger.exception(
                    'Reconciliation did not work for order %s (Bill)', order.name)

    def _create_account_move_line(self, session=None, move=None):
        def _flatten_tax_and_children(taxes, group_done=None):
            children = self.env['account.tax']
            if group_done is None:
                group_done = set()
            for tax in taxes.filtered(lambda t: t.amount_type == 'group'):
                if tax.id not in group_done:
                    group_done.add(tax.id)
                    children |= _flatten_tax_and_children(
                        tax.children_tax_ids, group_done)
            return taxes + children

        # Tricky, via the workflow, we only have one id in the ids variable
        """Create a account move line of order grouped by products or not."""
        IrProperty = self.env['ir.property']
        ResPartner = self.env['res.partner']

        if session and not all(session.id == order.session_id.id for order in self):
            raise UserError(_('Selected orders do not have the same session!'))

        grouped_data = {}
        have_to_group_by = session and session.config_id.group_by or False
        rounding_method = session and session.config_id.company_id.tax_calculation_rounding_method

        def add_anglosaxon_lines(grouped_data):
            Product = self.env['product.product']
            Analytic = self.env['account.analytic.account']
            for product_key in list(grouped_data.keys()):
                if product_key[0] == "product":
                    line = grouped_data[product_key][0]
                    product = Product.browse(line['product_id'])
                    # In the SO part, the entries will be inverted by function compute_invoice_totals
                    price_unit = self._get_pos_anglo_saxon_price_unit(
                        product, line['partner_id'], line['quantity'])
                    account_analytic = Analytic.browse(
                        line.get('analytic_account_id'))
                    res = Product._anglo_saxon_sale_move_lines(
                        line['name'], product, product.uom_id, line['quantity'], price_unit,
                        fiscal_position=order.fiscal_position_id,
                        account_analytic=account_analytic)
                    if res:
                        line1, line2 = res
                        line1 = Product._convert_prepared_anglosaxon_line(
                            line1, line['partner_id'])
                        insert_data('counter_part', {
                            'name': line1['name'],
                            'account_id': line1['account_id'],
                            'credit': line1['credit'] or 0.0,
                            'debit': line1['debit'] or 0.0,
                            'partner_id': line1['partner_id']

                        })

                        line2 = Product._convert_prepared_anglosaxon_line(
                            line2, line['partner_id'])
                        insert_data('counter_part', {
                            'name': line2['name'],
                            'account_id': line2['account_id'],
                            'credit': line2['credit'] or 0.0,
                            'debit': line2['debit'] or 0.0,
                            'partner_id': line2['partner_id']
                        })
        order = None
        for order in self.filtered(lambda o: (not o.account_move and not o.bill_account_move) or (o.state == 'paid' and o.invoice_state != 'invoiced')):
            if order.returned_order:
                current_company = order.purchase_journal.company_id
                account_def = IrProperty.get(
                    'property_account_payable_id', 'res.partner')
                order_account = order.partner_id.property_account_payable_id.id or account_def and account_def.id
                partner_id = ResPartner._find_accounting_partner(
                    order.partner_id).id or False
                if move is None:
                    # Create an entry for the sale
                    journal_id = order.purchase_journal.id
                    move = self._create_account_move(
                        order.session_id.start_at, order.name, int(journal_id), order.company_id.id)
            else:
                current_company = order.sale_journal.company_id
                account_def = IrProperty.get(
                    'property_account_receivable_id', 'res.partner')
                order_account = order.partner_id.property_account_receivable_id.id or account_def and account_def.id
                partner_id = ResPartner._find_accounting_partner(
                    order.partner_id).id or False
                if move is None:
                    # Create an entry for the sale
                    journal_id = self.env['ir.config_parameter'].sudo().get_param(
                        'pos.closing.journal_id_%s' % current_company.id, default=order.sale_journal.id)
                    move = self._create_account_move(
                        order.session_id.start_at, order.name, int(journal_id), order.company_id.id)

            def insert_data(data_type, values):
                # if have_to_group_by:
                values.update({
                    'move_id': move.id,
                })

                key = self._get_account_move_line_group_data_type_key(
                    data_type, values, {'rounding_method': rounding_method})
                if not key:
                    return

                grouped_data.setdefault(key, [])

                if have_to_group_by:
                    if not grouped_data[key]:
                        grouped_data[key].append(values)
                    else:
                        current_value = grouped_data[key][0]
                        current_value['quantity'] = current_value.get(
                            'quantity', 0.0) + values.get('quantity', 0.0)
                        current_value['credit'] = current_value.get(
                            'credit', 0.0) + values.get('credit', 0.0)
                        current_value['debit'] = current_value.get(
                            'debit', 0.0) + values.get('debit', 0.0)
                        if 'currency_id' in values:
                            current_value['amount_currency'] = current_value.get(
                                'amount_currency', 0.0) + values.get('amount_currency', 0.0)
                        if key[0] == 'tax' and rounding_method == 'round_globally':
                            if current_value['debit'] - current_value['credit'] > 0:
                                current_value['debit'] = current_value['debit'] - \
                                    current_value['credit']
                                current_value['credit'] = 0
                            else:
                                current_value['credit'] = current_value['credit'] - \
                                    current_value['debit']
                                current_value['debit'] = 0

                else:
                    grouped_data[key].append(values)

            # because of the weird way the pos order is written, we need to make sure there is at least one line,
            # because just after the 'for' loop there are references to 'line' and 'income_account' variables (that
            # are set inside the for loop)
            # TOFIX: a deep refactoring of this method (and class!) is needed
            # in order to get rid of this stupid hack
            assert order.lines, _(
                'The POS order must have lines when calling this method')
            # Create an move for each order line
            cur = order.pricelist_id.currency_id
            cur_company = order.company_id.currency_id
            amount_cur_company = 0.0
            date_order = order.date_order.date() if order.date_order else fields.Date.today()
            for line in order.lines:
                if cur != cur_company:
                    amount_subtotal = cur._convert(
                        line.price_subtotal, cur_company, order.company_id, date_order)
                else:
                    amount_subtotal = line.price_subtotal

                # Search for the income account
                if order.returned_order:
                    if line.product_id.property_account_expense_id.id:
                        income_account = line.product_id.property_account_expense_id.id
                    elif line.product_id.categ_id.property_account_expense_categ_id.id:
                        income_account = line.product_id.categ_id.property_account_expense_categ_id.id
                    else:
                        raise UserError(_('Please define income '
                                          'account for this product: "%s" (id:%d).')
                                        % (line.product_id.name, line.product_id.id))
                else:
                    if line.product_id.property_account_income_id.id:
                        income_account = line.product_id.property_account_income_id.id
                    elif line.product_id.categ_id.property_account_income_categ_id.id:
                        income_account = line.product_id.categ_id.property_account_income_categ_id.id
                    else:
                        raise UserError(_('Please define income '
                                          'account for this product: "%s" (id:%d).')
                                        % (line.product_id.name, line.product_id.id))

                name = line.product_id.name
                if line.notice:
                    # add discount reason in move
                    name = name + ' (' + line.notice + ')'

                # Create a move for the line for the order line
                # Just like for invoices, a group of taxes must be present on this base line
                # As well as its children
                if order.returned_order:
                    base_line_tax_ids = self.env['account.tax'].search([
                        ('company_id', '=', line.order_id.company_id.id),
                        ('amount_type', '=', 'percent'),
                        ('type_tax_use', '=', 'purchase'),
                    ])
                else:
                    base_line_tax_ids = _flatten_tax_and_children(line.tax_ids_after_fiscal_position).filtered(
                        lambda tax: tax.type_tax_use in ['sale', 'none'])
                data = {
                    'name': name,
                    'quantity': line.qty,
                    'product_id': line.product_id.id,
                    'account_id': income_account,
                    'analytic_account_id': self._prepare_analytic_account(line),
                    'credit': ((amount_subtotal > 0) and amount_subtotal) or 0.0,
                    'debit': ((amount_subtotal < 0) and -amount_subtotal) or 0.0,
                    'tax_ids': [(6, 0, base_line_tax_ids.ids)],
                    'partner_id': partner_id
                }
                if cur != cur_company:
                    data['currency_id'] = cur.id
                    data['amount_currency'] = -abs(line.price_subtotal) if data.get(
                        'credit') else abs(line.price_subtotal)
                    amount_cur_company += data['credit'] - data['debit']
                insert_data('product', data)

                # Create the tax lines
                if order.returned_order:
                    taxes = self.env['account.tax'].search([
                        ('company_id', '=', line.order_id.company_id.id),
                        ('amount_type', '=', 'percent'),
                        ('type_tax_use', '=', 'purchase'),
                    ], limit=1)
                else:
                    taxes = line.tax_ids_after_fiscal_position.filtered(
                        lambda t: t.company_id.id == current_company.id)
                if not taxes:
                    continue
                price = line.price_unit * (1 - (line.discount or 0.0) / 100.0)
                for tax in taxes.compute_all(price, cur, line.qty)['taxes']:
                    if cur != cur_company:
                        round_tax = False if rounding_method == 'round_globally' else True
                        amount_tax = cur._convert(
                            tax['amount'], cur_company, order.company_id, date_order, round=round_tax)
                        # amount_tax = cur.with_context(date=date_order).compute(tax['amount'], cur_company, round=round_tax)
                    else:
                        amount_tax = tax['amount']
                    data = {
                        'name': _('Tax') + ' ' + tax['name'],
                        'product_id': line.product_id.id,
                        'quantity': line.qty,
                        'account_id': tax['account_id'] or income_account,
                        'credit': ((amount_tax > 0) and amount_tax) or 0.0,
                        'debit': ((amount_tax < 0) and -amount_tax) or 0.0,
                        'tax_line_id': tax['id'],
                        'partner_id': partner_id,
                        'order_id': order.id
                    }
                    if cur != cur_company:
                        data['currency_id'] = cur.id
                        data['amount_currency'] = - \
                            abs(tax['amount']) if data.get(
                                'credit') else abs(tax['amount'])
                        amount_cur_company += data['credit'] - data['debit']
                    insert_data('tax', data)

            # round tax lines per order
            if rounding_method == 'round_globally':
                for group_key, group_value in grouped_data.items():
                    if group_key[0] == 'tax':
                        for line in group_value:
                            line['credit'] = cur_company.round(line['credit'])
                            line['debit'] = cur_company.round(line['debit'])
                            if line.get('currency_id'):
                                line['amount_currency'] = cur.round(
                                    line.get('amount_currency', 0.0))

            # counterpart
            if cur != cur_company:
                # 'amount_cur_company' contains the sum of the AML converted in the company
                # currency. This makes the logic consistent with 'compute_invoice_totals' from
                # 'account.invoice'. It ensures that the counterpart line is the same amount than
                # the sum of the product and taxes lines.
                amount_total = amount_cur_company
            else:
                amount_total = order.amount_total
            data = {
                'name': _("Trade Receivables"),  # order.name,
                'account_id': order_account,
                'credit': ((amount_total < 0) and -amount_total) or 0.0,
                'debit': ((amount_total > 0) and amount_total) or 0.0,
                'partner_id': partner_id
            }
            if cur != cur_company:
                data['currency_id'] = cur.id
                data['amount_currency'] = - \
                    abs(order.amount_total) if data.get(
                        'credit') else abs(order.amount_total)
            insert_data('counter_part', data)

            order.write({'state': 'done', 'account_move': move.id})

        if self and order and order.company_id.anglo_saxon_accounting:
            add_anglosaxon_lines(grouped_data)

        all_lines = []
        for group_key, group_data in grouped_data.items():
            for value in group_data:
                all_lines.append((0, 0, value),)
        if move:  # In case no order was changed
            move.sudo().write({'line_ids': all_lines})
            move.sudo().post()
        return True
