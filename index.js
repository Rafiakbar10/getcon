require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.GTC_API_KEY;
const BASE_URL = 'https://gtc.topupcuy.com/api/v1';

// Header khusus untuk menyamar sebagai browser asli agar lolos dari Cloudflare
const customHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Referer': 'https://gtc.topupcuy.com/'
};

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
        // 1. Inisiasi Cek Nomor dengan Header Penyamaran
        const initResponse = await axios.post(`${BASE_URL}/check`, {
            number: input,
            strategy: "smart",
            wait: false
        }, {
            headers: customHeaders
        });

        const { transaction_id, status } = initResponse.data;

        if (!transaction_id) {
            return ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, '❌ Gagal memulai transaksi.');
        }

        // Jika langsung sukses (dari cache)
        if (status === 'sukses') {
            return formatAndSendResult(ctx, processingMsg.message_id, initResponse.data);
        }

        // 2. Polling Status
        let attempts = 0;
        const maxAttempts = 10;
        
        const interval = setInterval(async () => {
            attempts++;
            try {
                const statusResponse = await axios.get(`${BASE_URL}/status/${transaction_id}`, {
                    headers: customHeaders
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
        }, 3000);

    } catch (error) {
        // Menangkap detail error jika masih terblokir atau masalah lain
        const errData = error.response?.data;
        let errorDetail = error.message;
        
        if (typeof errData === 'string' && errData.includes('Cloudflare')) {
            errorDetail = 'Terblokir Cloudflare (IP Railway terdeteksi data center).';
        } else if (errData) {
            errorDetail = JSON.stringify(errData);
        }

        console.error("Detail Error:", errorDetail);
        ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, `❌ Error API:\n\`${errorDetail}\``, { parse_mode: 'Markdown' });
    }
});

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
