import axios, { AxiosResponse, AxiosRequestConfig } from 'axios'
import { streamJSON } from './utils.js';
const OAUTH_URL = 'https://aip.baidubce.com/oauth/2.0/token'


export interface Configuration {
    accessToken?: string;
    apiKey?: string;
    secretKey?: string;

}
export enum Model {
    ERNIE_Bot = 'ERNIE_Bot',
    ERNIE_Bot_Turbo = 'ERNIE_Bot_Turbo',
    EMBEDDING_V1 = 'EMBEDDING_V1'
}
const QequestUrlMap = {
    [Model.ERNIE_Bot]: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
    [Model.ERNIE_Bot_Turbo]: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant',
    [Model.EMBEDDING_V1]: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/embeddings/embedding-v1'
}
export interface RequestBase {
    temperature?: number;
    topP?: number;
    penaltyScore?: number;
    stream?: boolean;
    userId?: string;
    model?: Model;
}
export enum Role {
    USER = 'user',
    ASSISTANT = 'assistant'
}
export interface ChatCompletionRequestMessage {
    role: Role;
    content: string;
}
export interface CreateChatCompletionRequest extends RequestBase {
    messages: ChatCompletionRequestMessage[];
}
export interface CreateCompletionRequest extends RequestBase {
    prompt: string;
}
export type CompletionResponse = {
    id: string;
    object: string;
    created: number;
    result: string;
    is_truncated: boolean;
    need_clear_history: boolean;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};
export type CreateEmbeddingRequest = {
    input: string[];
}
// export type CompletionStreamResponse = {

// }
export class ERNIEBotApi {
    accessToken = ''
    apiKey = ''
    secretKey = ''
    constructor(config: Configuration) {
        const accessToken = config.accessToken;
        const apiKey = config.apiKey;
        const secretKey = config.secretKey;
        if (!(apiKey && secretKey) && !accessToken) {
            throw new Error('ERNIE Bot requires either an access token or an API key and secret key pair')
        }
        this.accessToken = accessToken ?? '';
        this.apiKey = apiKey ?? '';
        this.secretKey = secretKey ?? '';
    }

    public async createChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig): Promise<AxiosResponse<CompletionResponse>> {
        const url = this.requestUrl(createChatCompletionRequest.model)
        const data = this.completionData(createChatCompletionRequest)
        const response = await this.request(url, data, options)
        return response
    }
    public async createCompletion(createCompletionRequest: CreateCompletionRequest, options?: AxiosRequestConfig): Promise<AxiosResponse<CompletionResponse>> {
        const url = this.requestUrl(createCompletionRequest.model)
        const data = this.completionData(createCompletionRequest)
        const response = await this.request(url, data, options)
        return response
    }
    // TODO 多字节字符被切割
    public async createChatCompletionStream(createCompletionRequest: CreateCompletionRequest, options?: AxiosRequestConfig) {
        const url = this.requestUrl(createCompletionRequest.model)
        const data = this.completionData({ ...createCompletionRequest, stream: true })
        const response = await this.request(url, data, { ...options, responseType: 'stream' })

        let deferredResolve = Promise.resolve
        let lastString = ''
        response.data.on('data', async (data: string) => {
            const string = data.toString()
            lastString += string
            let removeString: string[] = []
            for await (const msg of streamJSON(lastString, removeString)) {
                deferredResolve({ value: msg, done: false })
            }
            lastString = lastString.slice(removeString.join('').length)
        })
        response.data.on('end', async () => {
            for await (const msg of streamJSON(lastString, [])) {
                deferredResolve({ value: msg, done: false })
            }
            deferredResolve({ value: {} as CompletionResponse, done: true })
        })
        response.data = {
            [Symbol.asyncIterator]() {
                return {
                    next() {
                        return new Promise<{ value: CompletionResponse, done: boolean }>(resolve => {
                            deferredResolve = resolve as any
                        })
                    }
                }
            }
        }
        return response
    }
    public async createCompletionStream(createCompletionRequest: CreateCompletionRequest, options?: AxiosRequestConfig) {
        const url = this.requestUrl(createCompletionRequest.model)
        const data = this.completionData({ ...createCompletionRequest, stream: true })
        const response = await this.request(url, data, { ...options, responseType: 'stream' })
        let deferredResolve = Promise.resolve

        response.data.on('data', (data: string) => {
            const string = data.toString().replace(/^data: /, '')
            if (string.includes('"is_end":true')) {
                deferredResolve({ value: {}, done: true })
            } else {
                const item = JSON.parse(string)
                deferredResolve({ value: item, done: false })
            }
        })
        response.data.on('end', () => {
            deferredResolve({ value: {} as CompletionResponse, done: true })
        })
        response.data = {
            [Symbol.asyncIterator]() {
                return {
                    next() {
                        return new Promise<{ value: CompletionResponse, done: boolean }>(resolve => {
                            deferredResolve = resolve as any
                        })
                    }
                }
            }
        }
        return response
    }
    public async createEmbedding(createEmbeddingRequest: CreateEmbeddingRequest, options?: AxiosRequestConfig) {
        const url = this.requestUrl(Model.EMBEDDING_V1)
        const response = await this.request(url, createEmbeddingRequest, options)
        return response
    }
    private async getAccessToken(): Promise<string> {
        if (this.isUseAPIKey) {
            const { data } = await axios({
                url: OAUTH_URL,
                method: 'GET',
                params: {
                    grant_type: 'client_credentials',
                    client_id: this.apiKey,
                    client_secret: this.secretKey
                }
            })
            // TODO 过期重试
            if (data.error_code !== 0) {
                throw new Error(data.error_msg)
            }
            this.accessToken = data.access_token
            return data.access_token
        } else {
            return this.accessToken
        }
    }
    // prefer using APIKey
    private get isUseAPIKey() {
        return this.apiKey && this.secretKey
    }
    private requestUrl(modelType: Model = Model.ERNIE_Bot) {
        return QequestUrlMap[modelType]
    }
    private getDefaultParams(requestBase: RequestBase) {
        const { temperature = 0.95, topP = 0.8, penaltyScore = 1.0, stream = false, userId = '' } = requestBase
        return {
            temperature,
            topP,
            penaltyScore,
            stream,
            userId,
        }
    }
    private completionData(completionRequest: CreateCompletionRequest | CreateChatCompletionRequest) {
        let messages
        if ('messages' in completionRequest) {
            messages = completionRequest.messages
        } else {
            messages = [{ role: Role.USER, content: completionRequest.prompt }]
        }
        return {
            messages,
            ...this.getDefaultParams(completionRequest)
        };
    }
    private async request(url: string, data: any, options: AxiosRequestConfig) {
        return await axios({
            method: 'POST',
            url,
            params: {
                access_token: await this.getAccessToken()
            },
            data,
            ...options
        })
    }
}