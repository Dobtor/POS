from odoo.exceptions import UserError

from odoo import api, fields, models, tools


class PosConfig(models.Model):
    _inherit = "pos.config"

    @api.multi
    def _compute_performance(self):
        for res in self:
            performance = 0
            for session in res.session_ids:
                for order in session.order_ids:
                    performance += order.amount_total
            res.performance = performance

    performance = fields.Float(string='performance',
                               compute='_compute_performance')


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.multi
    def _compute_order_info(self):
        for order in self:
            line_total_qty = 0
            line_list_price_total = 0
            for line in order.lines:
                line_total_qty += line.qty
                line_list_price_total += (line.price_unit*line.qty)
            order.sale_qty = line_total_qty
            order.list_price_amount = line_list_price_total

    sale_qty = fields.Integer(string='Sale Qty',compute='_compute_order_info' )
    list_price_amount = fields.Float(string="list price amount",compute='_compute_order_info' )


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    @api.multi
    def _compute_included_tax_total(self):
        for res in self:
            res.included_tax_total = res.price_subtotal_incl or res.price_subtotal

    @api.depends(
        'qty',
        'price_unit',
        'product_id',
    )
    def _compute_list_price_total(self):
        for res in self:
            res.product_list_price_total = res.qty * res.price_unit

    included_tax_total = fields.Float(string='Sale Price TaxIncl',
                                      compute="_compute_included_tax_total",
                                      store=True)
    product_list_price_total = fields.Float(
        string='List Price Amount',
        compute="_compute_list_price_total",
        store=True)


class PosOrderReport(models.Model):
    _inherit = "report.pos.order"

    # attribute_id = fields.Many2one('product.attribute', string='Product Attribute', readonly=True)
    included_tax_total = fields.Float(string='Sale Price TaxIncl',
                                      readonly=True)
    order_count = fields.Float(string='Order Count', readonly=True)
    order_average_amount = fields.Float('Order Average Amount', readonly=True)
    avg_discount_rate = fields.Float(string='Average Discount Rate', readonly=True,group_operator='avg')
    price_sub_total = fields.Float(string='List Price Amount', readonly=True)

    def _select(self):
        result = super()._select()
        result += """
            ,SUM(l.included_tax_total) AS included_tax_total
            ,1.0/cast(oc.order_count as Float) AS order_count
            ,SUM(l.included_tax_total)*cast(oc.order_count as Float) AS order_average_amount
            ,SUM(l.included_tax_total)/SUM(l.qty * l.price_unit)*100 as avg_discount_rate
        """
        return result

    def _from(self):
        result = super()._from()
        result += """
            INNER JOIN (SELECT order_id ,count(*) as order_count
	                    FROM pos_order_line
	                    Group by order_id) oc ON oc.order_id = l.order_id
        """
        return result

    def _group_by(self):
        result = super()._group_by()
        result += """
            ,oc.order_count
        """
        return result

class ReportPosOrder2(models.Model):
    _name = "report.pos.order2"
    _auto = False
    _order = 'date desc'

    date = fields.Datetime(string='Order Date', readonly=True)
    order_id = fields.Many2one('pos.order', string='Order', readonly=True)
    price_total = fields.Float(string='Total Price', readonly=True)
    list_price_total = fields.Float(string='List Price Amount',
                                   readonly=True)
    qty = fields.Integer(string='Product Quantity', readonly=True)
    config_id = fields.Many2one('pos.config',
                                string='Point of Sale',
                                readonly=True)
    pos_categ_id = fields.Many2one('pos.category',
                                   string='PoS Category',
                                   readonly=True)
    session_id = fields.Many2one('pos.session',
                                 string='Session',
                                 readonly=True)
    dicount_rate = fields.Float(string='dicount_rate',
                                readonly=True,
                                group_operator='avg')
    asp = fields.Float(string='ASP', readonly=True)
    order_count = fields.Integer(string='Order Count', readonly=True)
    atv = fields.Float(string='ATV', readonly=True)

    def _select(self):
        return """
            SELECT
                MIN(orders.id) AS id,
                orders.id AS order_id,
                sessions.id AS session_id,
                sessions.config_id as config_id,
                orders.date_order AS date,
                SUM(line.qty) AS qty,
                orders.amount_total AS price_total,
                SUM(line.qty * line.price_unit) AS list_price_total,
                orders.amount_total / SUM(line.qty * line.price_unit)*100 AS dicount_rate,
                orders.amount_total / SUM(line.qty) AS asp,
                1 AS order_count,
                orders.amount_total / oc.order_count AS atv
        """



    def _from(self):
        return """
            FROM pos_session sessions
                LEFT JOIN pos_order AS orders ON (sessions.id=orders.session_id)
                LEFT JOIN pos_order_line AS line ON (line.order_id=orders.id)
                INNER JOIN (SELECT ps.id ,count(o.*) as order_count
	                    FROM pos_session AS ps
                        LEFT JOIN pos_order o ON ps.id=o.session_id
                        Group by ps.id) oc ON oc.id = sessions.id
        """

    def _group_by(self):
        return """
            GROUP BY
                orders.date_order, oc.order_count, sessions.id,orders.amount_total,orders.id,sessions.config_id
        """

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self._cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                %s
                %s
                %s
            )
        """ % (self._table, self._select(), self._from(), self._group_by()))
