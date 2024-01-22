# ernie-bot-js
ernie bot js api

## 安装

```bash
npm install ernie-bot-js
```

## 使用

```js
import { ERNIEBotApi } from 'ernie-bot-js'

const ernie = new ERNIEBotApi({
        accessToken: 'your access token',
    })
const res = await ernie.createChatCompletion({
    messages: [{
        role: 'user',
        content: "写一首关于太阳的诗歌",
    }],
})
console.log(res.data)
```

## 版本

* 0.5.0 function_call 支持
* 0.4.0 EB4 支持
* 0.3.0 cjs 版本
* 0.2.0 支持 createChatCompletionStream(beta), createCompletionStream(beta)
* 0.1.0 支持 ERNIE_BOT, ERNIE_Bot_Turbo, Embedding_v1。支持 createChatCompletion, createCompletion