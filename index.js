require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.GTC_API_KEY;
const BASE_URL = 'https://gtc.topupcuy.com/api/v1';

bot.start((ctx) => {
    ctx.reply('Halo! Kirimkan nomor yang ingin dicek dengan format:\n`/cek 08123456789`', { parse_mode: 'Markdown' });
});

bot.command('cek', async (ctx) => {
    const input = ctx.message.text.split(' ')[1];
    if (!input) {
        return ctx.reply('Contoh penggunaan: `/cek 08123456789`', { parse_mode: 'Markdown' });
    }

    const processingMsg = await ctx.reply('🔄 Sedang memproses pengecekan nomor...');

    try {
        // 1. Inisiasi Cek Nomor (sesuai dokumentasi gambar 1 & 2)
        const initResponse = await axios.post(`${BASE_URL}/check`, {
            number: input,
            strategy: "smart",
            wait: false
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            }
        });

        const { transaction_id, status } = initResponse.data;

        if (!transaction_id) {
            return ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, '❌ Gagal memulai transaksi.');
        }

        // Jika langsung sukses (mengambil dari cache)
        if (status === 'sukses') {
            return formatAndSendResult(ctx, processingMsg.message_id, initResponse.data);
        }

        // 2. Polling Status (jika status masih pending/scraping - gambar 3)
        let attempts = 0;
        const maxAttempts = 10; // Maksimal percobaan polling
        
        const interval = setInterval(async () => {
            attempts++;
            try {
                const statusResponse = await axios.get(`${BASE_URL}/status/${transaction_id}`, {
                    headers: { 'x-api-key': API_KEY }
                });

                const trxStatus = statusResponse.data.status;

                if (trxStatus === 'sukses') {
                    clearInterval(interval);
                    formatAndSendResult(ctx, processingMsg.message_id, statusResponse.data);
                } else if (trxStatus === 'gagal') {
                    clearInterval(interval);
                    ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, '❌ Pengecekan gagal (Captcha expired / limit habis). Saldo telah direfund.');
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, '⏱️ Waktu habis (Timeout). Silakan coba beberapa saat lagi.');
                }
            } catch (err) {
                clearInterval(interval);
                ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, '⚠️ Terjadi kesalahan saat memeriksa status.');
            }
        }, 3000); // Polling tiap 3 detik

    } catch (error) {
        console.error(error.response?.data || error.message);
        ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, '❌ Terjadi kesalahan pada server API.');
    }
});

// Fungsi pembantu untuk merapikan hasil tag
function formatAndSendResult(ctx, messageId, data) {
    let tagsText = '';
    const tags = data.data?.tags || data.tags;

    if (tags && tags.length > 0) {
        tagsText = tags.map((t, i) => `${i + 1}. ${t.tag || t}`).join('\n');
    } else {
        tagsText = 'Tidak ada tag ditemukan untuk nomor ini.';
    }

    const replyMessage = `✅ **Hasil Pengecekan Getcontact**\n\nNomor: \`${data.number || 'N/A'}\`\n\n**Daftar Tag:**\n${tagsText}`;
    ctx.telegram.editMessageText(ctx.chat.id, messageId, null, replyMessage, { parse_mode: 'Markdown' });
}

bot.launch();
console.log('Bot Telegram berjalan...');
                  
