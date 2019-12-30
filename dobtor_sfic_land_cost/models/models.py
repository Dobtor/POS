# Copyright 2013 Joaquín Gutierrez
# Copyright 2018 Tecnativa - Vicent Cubells
# Copyright 2014-2018 Tecnativa - Pedro M. Baeza
# License AGPL-3 - See http://www.gnu.org/licenses/agpl-3

from odoo import _, api, fields, models
from odoo.addons import decimal_precision as dp
from odoo.exceptions import UserError
from odoo.tools.misc import formatLang


class PurchaseCostDistribution(models.Model):
    _inherit = "purchase.cost.distribution"

    lc_tt_no = fields.Char(string='LC/TT No.', required=True)
    letter_of_credit_fee = fields.Float(string='Letter of Credit Fee',
                                        default=0.0)
    air_transport = fields.Float(string='Air Transport', default=0.0)
    income_tax = fields.Float(string='Income Tax', default=0.0)
    customs_fees = fields.Float(string='Customs Clearance Fees', default=0.0)
    tally_fee = fields.Float(string='Tally fee', default=0.0)
    moving_fee = fields.Float(string='Moving fee', default=0.0)
    truck_freight_fee = fields.Float(string='Truck Freight Fee', default=0.0)
    visa_fee = fields.Float(string='Visa Fee', default=0.0)
    other_customs_fees = fields.Float(string='Other Customs Clearance Fees',
                                      default=0.0)
    taxes_payable = fields.Float(string='Taxes Payable', default=0.0)
    commission_fee = fields.Float(string='Commission Fee', default=0.0)
    packaging_fee = fields.Float(string='Packaging Fee', default=0.0)
    mold_opening_fee = fields.Float(string='Mold Opening Fee', default=0.0)
    warehouse_rent = fields.Float(string='Warehouse rent', default=0.0)
    insurance = fields.Float(string='Insurance', default=0.0)
    other_income_tax = fields.Float(string='Other Income Tax', default=0.0)
    total_purchase = fields.Float(compute="_compute_total_purchase",
                                  store=True,
                                  digits=dp.get_precision('Account'),
                                  string='Total purchase')
    amount_total = fields.Float(compute="_compute_amount_total",
                                store=True,
                                digits=dp.get_precision('Account'),
                                string='Total')
    total_expense = fields.Float(compute="_compute_total_expense",
                                 store=True,
                                 digits=dp.get_precision('Account'),
                                 string='Total expenses')

    @api.depends('total_expense')
    def compute_fee_rate(self):
        for order in self:
            order.letter_of_credit_fee_rate = (order.letter_of_credit_fee *
                                               100 / order.total_expense)
            order.air_transport_rate = (order.air_transport * 100 /
                                        order.total_expense)
            order.income_tax_rate = (order.income_tax * 100 /
                                     order.total_expense)
            order.customs_fees_rate = (order.customs_fees * 100 /
                                       order.total_expense)
            order.tally_fee_rate = (order.tally_fee * 100 /
                                    order.total_expense)
            order.moving_fee_rate = (order.moving_fee * 100 /
                                     order.total_expense)
            order.truck_freight_fee_rate = (order.truck_freight_fee * 100 /
                                            order.total_expense)
            order.visa_fee_rate = (order.visa_fee * 100 / order.total_expense)
            order.other_customs_fees_rate = (order.other_customs_fees * 100 /
                                             order.total_expense)
            order.taxes_payable_rate = (order.taxes_payable * 100 /
                                        order.total_expense)
            order.commission_fee_rate = (order.commission_fee * 100 /
                                         order.total_expense)
            order.packaging_fee_rate = (order.packaging_fee * 100 /
                                        order.total_expense)
            order.mold_opening_fee_rate = (order.mold_opening_fee * 100 /
                                           order.total_expense)
            order.warehouse_rent_rate = (order.warehouse_rent * 100 /
                                         order.total_expense)
            order.insurance_rate = (order.insurance * 100 /
                                    order.total_expense)
            order.other_income_tax_rate = (order.other_income_tax * 100 /
                                           order.total_expense)

    letter_of_credit_fee_rate = fields.Float(
        string='Letter of Credit Fee Rate',
        compute='compute_fee_rate',
        store=True)
    air_transport_rate = fields.Float(string='Air Transport Rate',
                                      compute='compute_fee_rate',
                                      store=True)
    income_tax_rate = fields.Float(string='Income Tax Rate',
                                   compute='compute_fee_rate',
                                   store=True)
    customs_fees_rate = fields.Float(string='Customs Clearance Fees Rate',
                                     compute='compute_fee_rate',
                                     store=True)
    tally_fee_rate = fields.Float(string='Tally fee Rate',
                                  compute='compute_fee_rate',
                                  store=True)
    moving_fee_rate = fields.Float(string='Moving fee Rate',
                                   compute='compute_fee_rate',
                                   store=True)
    truck_freight_fee_rate = fields.Float(string='Truck Freight Fee Rate',
                                          compute='compute_fee_rate',
                                          store=True)
    visa_fee_rate = fields.Float(string='Visa Fee Rate',
                                 compute='compute_fee_rate',
                                 store=True)
    other_customs_fees_rate = fields.Float(
        string='Other Customs Clearance Fees Rate',
        compute='compute_fee_rate',
        store=True)
    taxes_payable_rate = fields.Float(string='Taxes Payable Rate',
                                      compute='compute_fee_rate',
                                      store=True)
    commission_fee_rate = fields.Float(string='Commission Fee Rate',
                                       compute='compute_fee_rate',
                                       store=True)
    packaging_fee_rate = fields.Float(string='Packaging Fee Rate',
                                      compute='compute_fee_rate',
                                      store=True)
    mold_opening_fee_rate = fields.Float(string='Mold Opening Fee Rate',
                                         compute='compute_fee_rate',
                                         store=True)
    warehouse_rent_rate = fields.Float(string='Warehouse rent Rate',
                                       compute='compute_fee_rate',
                                       store=True)
    insurance_rate = fields.Float(string='Insurance Rate',
                                  compute='compute_fee_rate',
                                  store=True)
    other_income_tax_rate = fields.Float(string='Other Income Tax Rate',
                                         compute='compute_fee_rate',
                                         store=True)


class PurchaseCostDistributionLine(models.Model):
    _inherit = "purchase.cost.distribution.line"

    warehouse_id = fields.Many2one(store=True, related="move_id.warehouse_id")


class PurchaseCostDistributionLineExpense(models.Model):
    _inherit = "purchase.cost.distribution.expense"

    @api.multi
    def update_distribution_fee(self):
        for line in self:
            # letter_of_credit_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Letter_of_Credit_Fee'
            ):
                line.distribution.letter_of_credit_fee = line.expense_amount
            # air_transport
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Air_transport'
            ):
                line.distribution.air_transport = line.expense_amount
            # income_tax
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_income_tax'):
                line.distribution.income_tax = line.expense_amount
            # warehouse rent
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Warehouse_rent'
            ):
                line.distribution.warehouse_rent = line.expense_amount
            # customs_fees
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Customs_fees'
            ):
                line.distribution.customs_fees = line.expense_amount
            # tally_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Tally_fee'):
                line.distribution.tally_fee = line.expense_amount
            # moving_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_moving_fee'):
                line.distribution.moving_fee = line.expense_amount
            # truck_freight_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Truck_freight_fee'
            ):
                line.distribution.truck_freight_fee = line.expense_amount
            # visa_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Visa_fee'):
                line.distribution.visa_fee = line.expense_amount
            # other_customs_fees
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Other_customs_fees'
            ):
                line.distribution.other_customs_fees = line.expense_amount
            # taxes_payable
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Taxes_payable'
            ):
                line.distribution.taxes_payable = line.expense_amount
            # commission_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_commission_fee'
            ):
                line.distribution.commission_fee = line.expense_amount
            # packaging_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Packaging_fee'
            ):
                line.distribution.packaging_fee = line.expense_amount
            # mold_opening_fee
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_Mold_opening_fee'
            ):
                line.distribution.mold_opening_fee = line.expense_amount
            # insurance
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_insurance'):
                line.distribution.insurance = line.expense_amount
            # other_income_tax
            if line.type == self.env.ref(
                    'dobtor_sfic_land_cost.purchase_expense_type_other_income_tax'
            ):
                line.distribution.other_income_tax = line.expense_amount

    @api.multi
    def write(self, value):
        if value.get('expense_amount'):
            super().write(value)
            self.update_distribution_fee()

        return super().write(value)

    @api.model
    def create(self, value):
        line = super().create(value)
        line.update_distribution_fee()
        return line


class PurchaseExpenseType(models.Model):
    _inherit = "purchase.expense.type"

    undeletable = fields.Boolean(default=False)

    @api.multi
    def unlink(self):
        for type in self:
            if type.undeletable == True:
                raise UserError(_('Cannot delete type which are main type.'))
        return super().unlink()