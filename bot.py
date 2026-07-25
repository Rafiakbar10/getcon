import logging
import os
import requests
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# Logging setup
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Token Bot Telegram Anda
TOKEN = "8676467602:AAHbMT_18pcCl0i5DkYJt-bkW08WFiu-gUo"
DEFAULT_CITY = "Jakarta"

# Fungsi untuk mengambil jadwal sholat dari API
def get_prayer_times(city):
    url = f"http://api.aladhan.com/v1/timingsByCity?city={city}&country=Indonesia&method=11"
    try:
        response = requests.get(url)
        data = response.json()
        if data["code"] == 200:
            timings = data["data"]["timings"]
            return {
                "Subuh": timings.get("Fajr"),
                "Dzuhur": timings.get("Dhuhr"),
                "Ashar": timings.get("Asr"),
                "Maghrib": timings.get("Maghrib"),
                "Isya": timings.get("Isha")
            }
    except Exception as e:
        logger.error(f"Gagal mengambil jadwal sholat: {e}")
    return None

# Command /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_name = update.effective_user.first_name
    welcome_message = (
        f"Halo, {user_name}! 🙏\n\n"
        "Saya adalah Bot Pengingat Waktu Sholat.\n"
        "Gunakan perintah berikut:\n"
        "• /jadwal [nama_kota] - Melihat jadwal sholat hari ini\n"
        "• /setkota [nama_kota] - Mengatur kota default Anda\n"
        "\n_Contoh: /jadwal Surabaya_"
    )
    await update.message.reply_text(welcome_message, parse_mode="Markdown")

# Command /jadwal
async def jadwal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    city = " ".join(args) if args else DEFAULT_CITY
    
    times = get_prayer_times(city)
    if times:
        msg = f"🕌 **Jadwal Sholat untuk wilayah {city.capitalize()}**\n\n"
        for prayer, time in times.items():
            msg += f"• {prayer}: `{time}`\n"
        await update.message.reply_text(msg, parse_mode="Markdown")
    else:
        await update.message.reply_text(f"❌ Gagal memuat jadwal untuk kota '{city}'. Pastikan penulisan kota benar.")

# Command /setkota
async def set_kota(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global DEFAULT_CITY
    if context.args:
        DEFAULT_CITY = " ".join(context.args)
        await update.message.reply_text(f"✅ Kota default berhasil diubah ke: *{DEFAULT_CITY}*", parse_mode="Markdown")
    else:
        await update.message.reply_text("⚠️ Harap sertakan nama kota. Contoh: `/setkota Bandung`", parse_mode="Markdown")

def main():
    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("jadwal", jadwal))
    app.add_handler(CommandHandler("setkota", set_kota))

    logger.info("Bot sedang berjalan...")
    app.run_polling()

if __name__ == "__main__":
    main()
