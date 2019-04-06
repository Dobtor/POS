import xmlrpclib
import json
import time
import logging

__logger = logging.getLogger(__name__)

start_time = time.time()


database = 'v12_pos_retail'
login = 'admin'
password = '1'
url = 'http://localhost:8888'

common = xmlrpclib.ServerProxy('{}/xmlrpc/2/common'.format(url))
uid = common.authenticate(database, login, password, {})

models = xmlrpclib.ServerProxy(url + '/xmlrpc/object')

with open("cafe.png", "rb") as f:
    data = f.read()
    for i in range(0, 100):
        vals = {
            'list_price': i,
            'description': u'description',
            'display_name': 'new product -  %s' % str(i),
            'name': ' test0112 -  / %s' % str(i),
            'pos_categ_id': 1,
            'to_weight': u'True',
            'image': data.encode("base64"),
            'available_in_pos': True,
        }
        models.execute_kw(database, uid, password, 'product.product', 'create', [vals])
        __logger.info('created: %s' % i)
