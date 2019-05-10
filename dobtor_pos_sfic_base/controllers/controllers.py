# -*- coding: utf-8 -*-
from odoo import http

# class DobtorSficBase(http.Controller):
#     @http.route('/dobtor_sfic_base/dobtor_sfic_base/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/dobtor_sfic_base/dobtor_sfic_base/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('dobtor_sfic_base.listing', {
#             'root': '/dobtor_sfic_base/dobtor_sfic_base',
#             'objects': http.request.env['dobtor_sfic_base.dobtor_sfic_base'].search([]),
#         })

#     @http.route('/dobtor_sfic_base/dobtor_sfic_base/objects/<model("dobtor_sfic_base.dobtor_sfic_base"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('dobtor_sfic_base.object', {
#             'object': obj
#         })