const passport = require('passport');
const local = require('./localStrategy');
const kakao = require('./kakaoStrategy');
const User = require('../models/user');

module.exports = () => {
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        (async () => {
            try{
                const user = await User.findOne({
                    where: { id },
                    include: [
                        {
                            model: User,
                            attributes: ['id', 'nick'],
                            as: 'Followers',
                        }, //팔로잉
                        {
                            model: User,
                            attributes: ['id', 'nick'],
                            as: 'Followings',
                        }, //팔로워
                    ]
                });
                done(null, user);
            } catch(err) {
                done(err);
            }
        })();
    });

    local();
    kakao();
}