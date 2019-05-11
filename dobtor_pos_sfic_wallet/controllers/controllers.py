# -*- coding: utf-8 -*-
from odoo import http

# class DobtorSficWallet(http.Controller):
#     @http.route('/dobtor_sfic_wallet/dobtor_sfic_wallet/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/dobtor_sfic_wallet/dobtor_sfic_wallet/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('dobtor_sfic_wallet.listing', {
#             'root': '/dobtor_sfic_wallet/dobtor_sfic_wallet',
#             'objects': http.request.env['dobtor_sfic_wallet.dobtor_sfic_wallet'].search([]),
#         })

#     @http.route('/dobtor_sfic_wallet/dobtor_sfic_wallet/objects/<model("dobtor_sfic_wallet.dobtor_sfic_wallet"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('dobtor_sfic_wallet.object', {
#             'object': obj
#         })