import os
import logging
import requests
from datetime import datetime
import pytz
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Konfigurasi Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Mengambil TOKEN dari Environment Variable Railway (atau fallback string kosong)
TOKEN = os.getenv("TOKEN")

