# -*- coding: utf-8 -*-
import logging
import psycopg2
from odoo import models, fields, api, tools, _

_logger = logging.getLogger(__name__)


class PosSession(models.Model):
    _inherit = "pos.session"

    def _confirm_orders(self):
        for session in self:
            company_id = session.config_id.journal_id.company_id.id
            orders = session.order_ids.filtered(
                lambda order: order.state == 'paid' and order.invoice_state == 'to_invoice' and order.returned_order == False)

            # if orders (Sale)
            if len(orders):
                journal_id = self.env['ir.config_parameter'].sudo().get_param(
                    'pos.closing.journal_id_%s' % company_id, default=session.config_id.journal_id.id)

                if not journal_id:
                    raise UserError(_("You have to set a Sale Journal for the POS:%s") % (
                        session.config_id.name,))

                move = self.env['pos.order'].with_context(force_company=company_id)._create_account_move(
                    session.start_at, session.name, int(journal_id), company_id)
                orders.with_context(
                    force_company=company_id)._create_account_move_line(session, move)
                for order in session.order_ids.filtered(lambda o: o.state not in ['done', 'invoiced'] and o.invoice_state != 'invoiced' and o.returned_order == False):
                    if order.state not in ('paid'):
                        raise UserError(
                            _("You cannot confirm all orders of this session, because they have not the 'paid' status.\n"
                              "{reference} is in state {state}, total amount: {total}, paid: {paid}").format(
                                reference=order.pos_reference or order.name,
                                state=order.state,
                                total=order.amount_total,
                                paid=order.amount_paid,
                            ))
                    order.action_pos_order_done()
            else:
                for order in session.order_ids.filtered(lambda o: o.state == 'paid' and o.invoice_state == 'invoiced'):
                    order.write({'state': 'done'})

            orders_to_reconcile = session.order_ids._filtered_for_reconciliation(
            ).filtered(lambda o: o.returned_order == False)
            orders_to_reconcile.sudo()._reconcile_payments()

            # if orders (Purchase) - return
            return_orders = session.order_ids.filtered(
                lambda o: o.returned_order == True and o.invoice_state == 'to_invoice' and o.state == 'paid')
            print('---- -- return_orders ---- --- :', return_orders)
            if len(return_orders):
                purchase_journal_id = session.config_id.purchase_journal_id.id
                purchase_move = self.env['pos.order'].with_context(force_company=company_id)._create_account_move(
                    session.start_at, session.name, int(purchase_journal_id), company_id)
                return_orders.with_context(
                    force_company=company_id)._create_account_move_line(session, purchase_move)

                for return_order in session.order_ids.filtered(lambda o: o.state not in ['done', 'invoiced'] and o.invoice_state != 'invoiced' and o.returned_order == True):
                    if return_order.state not in ('paid'):
                        raise UserError(
                            _("You cannot confirm all orders of this session, because they have not the 'paid' status.\n"
                              "{reference} is in state {state}, total amount: {total}, paid: {paid}").format(
                                reference=return_order.pos_reference or return_order.name,
                                state=return_order.state,
                                total=return_order.amount_total,
                                paid=return_order.amount_paid,
                            ))
                    return_order.action_pos_order_done()
            else:
                for order in session.order_ids.filtered(lambda o: o.state == 'paid' and o.invoice_state == 'invoiced'):
                    order.write({'state': 'done'})

            
            
            orders_to_reconcile = session.order_ids._filtered_for_reconciliation(
            ).filtered(lambda o: o.returned_order == True)
            orders_to_reconcile.sudo()._reconcile_payments()
