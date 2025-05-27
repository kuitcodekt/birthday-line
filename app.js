require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// --- お祝いする誕生日を設定 ---
// 例: 5月28日生まれの場合
const BIRTHDAY_MONTH = 5; // 月
const BIRTHDAY_DAY = 28;  // 日
// --------------------------

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));

// トップページ
app.get('/', (req, res) => {
    let message = '';
    if (req.session.user) {
        const userName = req.session.user.displayName;
        if (isBirthdayWeek(BIRTHDAY_MONTH, BIRTHDAY_DAY)) {
            message = `${userName}さん、お誕生日おめでとう！`;
        }
    }
    res.render('index', { user: req.session.user, message: message });
});

// LINEログインを開始する
app.get('/login', (req, res) => {
    const state = Math.random().toString(36).substring(7);
    req.session.state = state;
    const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=<span class="math-inline">\{process\.env\.LINE\_CHANNEL\_ID\}&redirect\_uri\=</span>{req.protocol}://<span class="math-inline">\{req\.get\('host'\)\}/auth/line/callback&state\=</span>{state}&scope=profile%20openid`;
    res.redirect(url);
});

// LINEからのコールバックを処理する
app.get('/auth/line/callback', async (req, res) => {
    if (req.query.state !== req.session.state) {
        return res.status(400).send('不正なアクセスです');
    }

    try {
        // アクセストークンを取得
        const tokenResponse = await axios.post('https://api.line.me/oauth2/v2.1/token', new URLSearchParams({
            grant_type: 'authorization_code',
            code: req.query.code,
            redirect_uri: `<span class="math-inline">\{req\.protocol\}\://</span>{req.get('host')}/auth/line/callback`,
            client_id: process.env.LINE_CHANNEL_ID,
            client_secret: process.env.LINE_CHANNEL_SECRET
        }));

        const accessToken = tokenResponse.data.access_token;

        // ユーザープロフィールを取得
        const profileResponse = await axios.get('https://api.line.me/v2/profile', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        req.session.user = profileResponse.data;
        res.redirect('/');

    } catch (error) {
        console.error('LINEログインエラー:', error.response ? error.response.data : error.message);
        res.redirect('/');
    }
});

// ログアウト
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// 誕生日から1週間以内かチェックする関数
function isBirthdayWeek(month, day) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const birthdayThisYear = new Date(currentYear, month - 1, day);

    // 誕生日の7日前を計算
    const oneWeekBefore = new Date(birthdayThisYear);
    oneWeekBefore.setDate(birthdayThisYear.getDate() - 6);

    // 今日が「誕生日の6日前」から「誕生日当日」までの間にあるかチェック
    return today >= oneWeekBefore && today <= birthdayThisYear;
}


app.listen(port, () => {
    console.log(`サーバーがポート${port}で起動しました`);
});
