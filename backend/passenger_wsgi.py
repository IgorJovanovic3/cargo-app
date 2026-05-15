import sys
import os

APP_PATH = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, APP_PATH)
sys.path.insert(0, os.path.join(APP_PATH, 'app'))

from app.main import app as application