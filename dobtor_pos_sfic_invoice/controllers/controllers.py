# -*- coding: utf-8 -*-
from odoo import http

# class DobtorPosSficInvoice(http.Controller):
#     @http.route('/dobtor_pos_sfic_invoice/dobtor_pos_sfic_invoice/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/dobtor_pos_sfic_invoice/dobtor_pos_sfic_invoice/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('dobtor_pos_sfic_invoice.listing', {
#             'root': '/dobtor_pos_sfic_invoice/dobtor_pos_sfic_invoice',
#             'objects': http.request.env['dobtor_pos_sfic_invoice.dobtor_pos_sfic_invoice'].search([]),
#         })

#     @http.route('/dobtor_pos_sfic_invoice/dobtor_pos_sfic_invoice/objects/<model("dobtor_pos_sfic_invoice.dobtor_pos_sfic_invoice"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('dobtor_pos_sfic_invoice.object', {
#             'object': obj
#         })