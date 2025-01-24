# NodeBird API 서버

## 1. 프로젝트 세팅
### 1.1. package.json 세팅
- npm init -y 로 package.json 간편 생성
- name, scripts 등을 수정
- 기존 Nodebird 프로젝트의 package.json의 dependencies 를 복사한 후 **'npm i'** 로 패키지들 install
  
### 1.2. 기존 Nodebird 프로젝트 폴더들 복사
- controllers, lib, middlewares, models, passport, routes 등을 복사
- controllers, routes의 js 파일들을 **'auth.js'** 만 남기고 전부 삭제

### 1.3. app.js 복사
- auth 라우터를 제외한 다른 라우터들은 제거한다.
- '/img' static 라우터도 제거한다.
  
### 1.4. views/error.html, views.login.html 생성
- 완성된 코드를 가져온다.
  
--------

## 2. 프로젝트 진행 순서
### 2.1. 프로젝트 구조 갖추기
#### 2.1.1. 도메인 모델 생성
```js
const Sequelize = require('sequelize');

class Domain extends Sequelize.Model {
    static initiate(sequelize) {
        Domain.init({
            host: {
                type: Sequelize.STRING(80),
                allowNull: false,
            },
            type: {
                type: Sequelize.ENUM('free', 'premium'),
                allowNull: false,
            },
            clientSecret: {
                type: Sequelize.UUID,
                allowNull: false,
            }
        }, {
            sequelize,
            timestamps: true,
            paranoid: true,
            modelName: 'Domain',
            tableName: 'domains',
        })
    }

    static associate(db) {
        db.Domain.belongsTo(db.User);
    }
}

module.exports = Domain;
```
models 디렉토리안에 **'domain.js'** 파일을 생성한 후 위의 코드를 작성한다.
app.js 에서 'models/index.js' 의 db 객체 내의 'sequelize' 를 구조분해할당하여 가져온 뒤 이것을 sync 하면 db를 연동하고 모델을 mapping 한다.

#### 2.1.2. 도메인 라우터
```js
const indexRouter = require('./routes');
app.use('/', indexRouter);
```
app.js 내에 indexRouter를 생성한다.
#### 2.1.3. localhost/8002 포트 연결
<img width="379" alt="image" src="https://github.com/user-attachments/assets/e8c10800-5ce1-4683-8cec-3457dba2b795" />

- 사용자가 해당 주소로 접근
- views.login.html(클라이언트)에서 **'/domain'** 라우터 요청
- app.js의 indexRouter 라우터 실행
- routes/index.js 내의 router.get('/', renderLogin); 호출
- controllers/index.js 내의 exports.renderLogin 호출
- 로그인 되어있는 경우에만 제대로된 render 요청

#### 2.1.4. 도메인 등록 (시크릿키 발급)
<img width="489" alt="image" src="https://github.com/user-attachments/assets/c68a5c90-a00f-43ec-af29-7b24356686ef" />

- 사용자가 해당 페이지에서 도메인을 입력 후  **저장**을 입력
- app.js의 indexRouter 라우터 실행
- routes/index.js 내의 router.post('/domain', isLoggedIn, createDomain); 호출
- controllers/index.js 내의 exports.createDomain 호출
- Domain.create 에 의하여 데이터베이스 생성 후 localhost:8002 로 리다이렉트

### 2.2. JWT 토큰 발급하기

#### 2.2.1. npm i jsonwebtoken

#### 2.2.2. .env에 JWT_SECRET 추가
- JWT_SECRET=jwtSecret

#### 2.2.3. jwt 위조 체크 미들웨어 구성
```js
exports.verifyToken = (req, res, next) => {
    try {
        res.locals.decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
        return next();
    } catch (error) {
        console.error(error);
        if(error.name === 'TokenExpiredError') {
            res.status(419).json({
                code: 419,
                message: '토큰이 만료되었습니다.',
            });
        }
        
        return res.status(401).json({
            code: 401,
            message: '유효하지 않은 토큰입니다.',
        });
    }
}
```
middlewares/index 내의 미들웨어들은 라우터들이 필요할 때 쓸 수 있게 만든 라이브러리와 같은 것이다.
```js
res.locals.decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
```
jwt.verify가 위조여부를 판단하여 내용물을 가져오며, 이것을 라우터 공통 저장 변수인 res.locals 의 decoded라는 프로토타입을 만들어 저장한다. (다른 라우터에서 사용가능)

#### 2.2.3. jwt 발급 및 테스트 컨트롤러 구현
```js
const Domain = require("../models/domain");
const User = require("../models/user");
const jwt = require('jsonwebtoken');

exports.createToken = async (req, res) => {
    const { clientSecret } = req.body;
    try {
        const domain = await Domain.findOne({
            where: { clientSecret },
            include: [{
                model: User,
                attributes: ['id', 'nick'],
            }]
        });

        if(!domain) {
            return res.status(401).json({
                code: 401,
                message: '등록되지 않은 도메인입니다. 먼저 도메인을 등록해주세요.',
            });
        }

        const token = jwt.sign({
            id: domain.User.id,
            nick: domain.User.nick,
        }, process.env.JWT_SECRET, {
            expiresIn: '1m',
            issuer: 'nodebird',
        });

        return res.status(200).json({
            code: 200,
            message: '토큰 발급되었습니다.',
            token,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: '서버 에러',
        });
    }
}
exports.tokenTest = async (req, res) => {
    res.json(res.locals.decoded);
}
```
위의 코드에서 핵심은 두 가지이다.
- req.body 에서 clientSecret 을 가져온다. 이것은 도메인 등록 후 발급받는 키값이다.
- jwt.sign를 사용하여 토큰 발급

#### 2.2.4. 컨트롤러를 호출할 라우터 구성
```js
router.post('/token', createToken);
router.get('/test', verifyToken, tokenTest);
```
routes/v1.js 내에 해당 경로로 들어오는 요청에 대한 라우터를 구성한다.

#### 2.2.5. app.js에 라우터 호출
```js
const v1Router = require('./routes/v1');
app.use('/v1', v1Router);
```
실질적으로 라우터를 호출하는 부분을 기술한다.

### 2.3. 다른 서비스에서 호출하기
<img width="618" alt="image" src="https://github.com/user-attachments/assets/9230a784-b3ea-45ff-b2b7-379937eade6b" />

#### 2.3.1. 프로젝트 세팅
- API 서버에서 토큰을 발급할 서비스 구성
- 신규 디렉토리에서 **npm init -y** 한 후 세팅
- package.json 에서 axios 도 추가
- .env 파일 생성
- views/error.html 구성
- routes/index.js 추가
- controllers/index.js 추가

#### 2.3.2. 서비스 요청하는 컨트롤러 구현
```js
const axios = require('axios');

exports.test = async (req, res, next) => {
    try {
        if(!req.session.jwt) {
            const tokenResult = await axios.post('http://localhost:8002/v1/token', {
                clientSecret: process.env.CLIENT_SECRET,
            });
            if(tokenResult.data?.code === 200) {
                req.session.jwt = tokenResult.data.token;
            } else {
                return res.status(tokenResult.data?.code).json(tokenResult.data);
            }
        }
        const result = await axios.get('http://localhost:8002/v1/test', {
            headers: { authorization: req.session.jwt },
        });
        return res.json(result.data);
    } catch (error) {
        console.error(error);
        if(error.response?.status === 419) {
            return res.json(error.response.data);
        }
        return next(error);
    }
}
```
jwt API 서버에서 구성한 'v1/token', 'v1/test' 를 통해 토큰을 발급받고 테스트하는 컨트롤러를 구현한다.

#### 2.3.3. test 라우터 구현
```js
const express = require('express');
const { test } = require('../controllers');
const router = express.Router();

router.get('/test', test);

module.exports = router;
```
test 컨트롤러를 가져오는 test 라우터를 구현한다.

#### 2.3.4. app.js 에 test 경로를 받는 라우터 구성
```js
const indexRouter = require('./routes');
app.use('/', indexRouter);
```

### 2.4. SNS API 서버 만들기
API 서버를 통해 아래와 같은 것들을 구현할 수 있다.
- 나의 게시글들을 전부 가져오기
- 해쉬태그와 일치하는 게시글들 전부 가져오기

#### 2.4.1. 컨트롤러 구성하기
##### 1. getMyPosts
```js
exports.getMyPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: { userId: res.locals.decoded.id }
        });

        return res.json({
            code: 200,
            payload: posts
        });
    } catch (error) {
        return res.status(500).json({
            code: 500,
            message: '서버 에러',
        });
    }
}
```
코드상에서 where의 userId는 Post DB의 컬럼이고, res.locals.decoded.id는 '/posts/my' 라우터가 호출될 때, 미들웨어인 verifyToken가 호출되어 jwt를 검증하고 내용물을 받은 부분이다.

##### 2. getPostsByHashtag
```js
exports.getPostsByHashtag = async (req, res) => {
    try {
        const hashtag = await Hashtag.findOne({ where: { title: req.params.title } });
        if(!hashtag) {
            return res.status(404).json({
                code: 404,
                message: '검색 결과가 없습니다.',
            });
        }
        const posts = await hashtag.getPosts();
        if(posts.length === 0) {
            return res.status(404).json({
                code: 404,
                message: '검색 결과가 없습니다.',
            });
        }
        return res.json({
            code: 200,
            payload: posts,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: '서버 에러',
        });
    }
}
```
req.params.title과 일치하는 해쉬태그를 찾아 응답한다.

#### 2.4.2. 라우터 구성하기
```js
router.get('/posts/my', verifyToken, getMyPosts);
router.get('/posts/hashtag/:title', verifyToken, getPostsByHashtag);
```

#### 2.4.3. 서비스에서 API 요청을 위한 컨트롤러 구성
```js
const axios = require('axios');
const apiServerURL = process.env.API_URL;
axios.defaults.headers.origin = process.env.ORIGIN;

const request = async (req, api) => {
    try {
        if(!req.session.jwt) {
            const tokenResult = await axios.post(`${apiServerURL}/token`, {
                clientSecret: process.env.CLIENT_SECRET,
            });
            req.session.jwt = tokenResult.data.token;
        }

        return await axios.get(`${apiServerURL}${api}`, {
            headers: { authorization: req.session.jwt },
        });
    } catch (error) {
        if(error.response?.status === 419) {
            delete req.session.jwt;
            return request(req, api);
        }
        throw error.response;
    }
}

exports.getMyPosts = async (req, res, next) => {
    try {
        const result = await request(req, '/posts/my');   
        res.json(result.data);
    } catch (error) {
        console.error(error);
        next(error);
    }
}

exports.searchByHashtag = async (req, res, next) => {
    try {
        const result = await request(req, `/posts/hashtag/${encodeURIComponent(req.params.hashtag)}`);   
        res.json(result.data);
    } catch (error) {
        console.error(error);
        next(error);
    }
}
```
위 코드에서 핵심은 419 에러, 즉 토큰이 만료되었을 때 재귀함수로 다시 토큰을 발급받는 것과
request로 공통적인 부분을 함수로 만들어 각 미들웨어에서 호출해준 부분이다.
또한 해쉬태그 검색에서 한글이 작동하도록 하려면 encodeURIComponent로 감싸줘야한다.

#### 2.4.4. 서비스에서 라우터 구성하기
```js
router.get('/myposts', getMyPosts);
router.get('/search/:hashtag', searchByHashtag);
```

### 2.5. API 사용량 제한하기
<img width="406" alt="image" src="https://github.com/user-attachments/assets/ca37f73d-dc54-48cb-88be-1da649c58134" />

#### 2.5.1. npm i express-rate-limit
API의 횟수를 제한하기 위한 패키지 설치

#### 2.5.2. 미들웨어 구현
```js
const rateLimit = require('express-rate-limit');

exports.apiLimiter = async (req, res, next) => {
    let user;
    if(res.locals.decoded.id) {
        user = await User.findOne({ where: { id: res.locals.decoded} });
    }

    rateLimit({
        windowMs: 60 * 1000,
        max: user?.type === 'premium' ? 1000 : 10,
        handler(req, res) {
            res.status(this.statusCode).json({
                code: this.statusCode,
                message: '1분에 10번만 요청할 수 있습니다.',
            });
    }
    })(req, res, next)
}

exports.deprecated = (req, res) => {
    res.status(410).json({
        code: 410,
        message: '새로운 버전 나왔습니다. 새로운 버전을 사용하세요.',
    });
}
```
apiLimiter 는 미들웨어 확장패턴이며, rateLimit()가 API를 제한하는 미들웨어이다. rateLimit의 windowMs 는 제한시간(밀리초), max는 횟수, handler는 최대 요청 횟수를 초과한 경우 호출되는 콜백 함수이다.
deprecated는 새로운 버전일 경우에 클라이언트에 반환하는 미들웨어이다.

#### 2.5.3. 라우터 수정
```js
const express = require('express');
const { verifyToken, apiLimiter } = require('../middlewares');
const { createToken, tokenTest, getMyPosts, getPostsByHashtag } = require('../controllers/v2');
const router = express.Router();

router.post('/token', apiLimiter, createToken);
router.get('/test', verifyToken, apiLimiter, tokenTest);

router.get('/posts/my', verifyToken, apiLimiter, getMyPosts);
router.get('/posts/hashtag/:title', verifyToken, apiLimiter, getPostsByHashtag);

module.exports = router;
```
기존 라우터에 apiLimiter를 추가하여 

#### 2.5.4. routes/v1.js 수정
```js
const express = require('express');
const { verifyToken, deprecated } = require('../middlewares');
const { createToken, tokenTest, getMyPosts, getPostsByHashtag } = require('../controllers/v1');
const router = express.Router();

router.use(deprecated);

router.post('/token', createToken);
router.get('/test', verifyToken, tokenTest);

router.get('/posts/my', verifyToken, getMyPosts);
router.get('/posts/hashtag/:title', verifyToken, getPostsByHashtag);

module.exports = router;
```
기존 라우터들은 실행되지 못하도록 **'deprecated'** 를 실행된다. **router.use(deprecated);** 는 다른 라우터가 실행되기 전 공통적으로 실행되는 미들웨어이므로 deprecated가 실행된다.

#### 2.5.5. 서비스의 .env 수정
```js
API_URL=http://localhost:8002/v2
```
만약 기존의 v1으로 .env가 설정되어있는 경우, deprecated가 실행된다.

#### 2.5.6. v2 라우터 구현
```js
const v2Router = require('./routes/v2');

app.use('/v2', v2Router);
```

### 2.6. CORS에러 해결하기
<img width="681" alt="image" src="https://github.com/user-attachments/assets/c4e2023f-e57a-479a-89b6-03ca7576b929" />

클라이언트에서 서버로 요청을 보낼 때 허락되지 않은 도메인인 경우에 나타나는 에러.
#### 2.6.1. npm i cors

#### 2.6.2. 미들웨어 구현
```js
const cors = require('cors');

exports.corsWhenDomainMatches = async (req, res, next) => {
    const domain = await Domain.findOne({
        where: { host: new URL(req.get('origin')).host },   //new URL로 감싸면 http가 떨어짐.
    });
    if(domain) {
        cors({
            origin: req.get('origin'),
            credentials: true,
        })(req ,res, next);
    } else {
        next();
    }
}
```
cors 패키지가 해당 도메인에 대한 각종 헤더설정을 해주는 역할을 하여 에러를 발생하지 않게 한다.

<img width="628" alt="image" src="https://github.com/user-attachments/assets/db8f4981-6657-494c-878a-d1c7737eca0d" />
