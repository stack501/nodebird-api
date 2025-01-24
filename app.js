const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const nunjucks = require('nunjucks');
const dotenv = require('dotenv');
const passport = require('passport');
const { sequelize } = require('./models');

dotenv.config();
const authRouter = require('./routes/auth');
const indexRouter = require('./routes');
const v1Router = require('./routes/v1');
const v2Router = require('./routes/v2');

const passportConfig = require('./passport');

const app = express();
passportConfig();
app.set('port', process.env.PORT || 8002);
app.set('view engine', 'html');
nunjucks.configure('views', {
    express: app,
    watch: true,
});

(async () => {
    try {
        await sequelize.sync({ force: false });
        console.log('데이터베이스 연결 성공');
    } catch (err) {
        console.error(err);
    }
})();

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded( { extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.COOKIE_SECRET,
    cookie: {
        httpOnly: true,
        secure: false,
    }
}));
app.use(passport.initialize()); //passport.initialize()는 반드시 session밑에 호출해야함. (req.user, req.login, req.isAuthenticate, req.logout)
app.use(passport.session());    //connect.sid라는 이름으로 세션 쿠키가 브라우저에 전송

app.use('/auth', authRouter);
app.use('/', indexRouter);
app.use('/v1', v1Router);
app.use('/v2', v2Router);

app.use((req, res, next) => {   //404 NOT FOUND
    const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
    error.status = 404;
    next(error);
});
app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = process.env.NODE_ENV !== 'production' ? err : {};
    res.status(err.status || 500);
    res.render('error');
});

app.listen(app.get('port'), () => {
    console.log(app.get('port'), '번 포트에서 실행 중');
});