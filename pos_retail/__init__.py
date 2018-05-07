from . import controllers
from . import models
from . import reports
from . import wizards

import logging
from odoo import api, SUPERUSER_ID
_logger = logging.getLogger(__name__)

def _remove_cache_for_first_install(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    env['pos.cache.database'].search([]).unlink()
    _logger.info('{FIRST INSTALL RETAIL} ---------------- INSTALLED                           ---------')
    _logger.info('{FIRST INSTALL RETAIL} CLEAN CACHE DONE')
    _logger.info('{FIRST INSTALL RETAIL} ---------------- THANKS FOR SUPPORT PURCHASED MODULE ---------')
    _logger.info('{FIRST INSTALL RETAIL} ---------------- thanhchatvn@gmail.com               ---------')
